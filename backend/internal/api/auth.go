package api

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"guap/backend/internal/auth"
	"guap/backend/internal/store"
)

type ctxKey struct{}

// userID returns the signed-in user set by requireUser.
func userID(r *http.Request) int64 {
	id, _ := r.Context().Value(ctxKey{}).(int64)
	return id
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if t, ok := strings.CutPrefix(h, "Bearer "); ok {
		return strings.TrimSpace(t)
	}
	return ""
}

// requireUser lets the request through only with a valid session token, and
// keeps sessions that are in use from expiring.
func (h *handler) requireUser(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			writeError(w, http.StatusUnauthorized, "Нужно войти в аккаунт")
			return
		}
		hash := auth.HashToken(token)
		uid, expires, err := h.store.SessionUser(r.Context(), hash)
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusUnauthorized, "Сессия истекла, войдите снова")
			return
		}
		if err != nil {
			h.internal(w, r, err)
			return
		}
		if time.Until(expires) < auth.SessionTTL/2 {
			if err := h.store.ExtendSession(r.Context(), hash, time.Now().Add(auth.SessionTTL)); err != nil {
				h.log.Warn("extend session", "err", err)
			}
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, uid)))
	})
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string     `json:"token"`
	User  store.User `json:"user"`
}

func normalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func validateCredentials(c credentials) map[string]string {
	errs := map[string]string{}
	if addr, err := mail.ParseAddress(c.Email); err != nil || addr.Address != c.Email || len(c.Email) > 254 {
		errs["email"] = "Введите корректный email"
	}
	if n := utf8.RuneCountInString(c.Password); n < 8 {
		errs["password"] = "Пароль должен быть не короче 8 символов"
	} else if n > 128 {
		errs["password"] = "Пароль должен быть не длиннее 128 символов"
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// startSession issues a token for the user and writes the auth response.
func (h *handler) startSession(w http.ResponseWriter, r *http.Request, status int, u store.User) {
	token, hash, err := auth.NewToken()
	if err != nil {
		h.internal(w, r, err)
		return
	}
	if err := h.store.CreateSession(r.Context(), u.ID, hash, time.Now().Add(auth.SessionTTL)); err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, status, authResponse{Token: token, User: u})
}

// POST /api/auth/register {email, password}
func (h *handler) register(w http.ResponseWriter, r *http.Request) {
	ip := "ip:" + clientIP(r)
	if !h.registerLimiter.Allowed(ip) {
		writeError(w, http.StatusTooManyRequests, "Слишком много регистраций. Попробуйте позже.")
		return
	}
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	c.Email = normalizeEmail(c.Email)
	if errs := validateCredentials(c); errs != nil {
		writeValidation(w, errs)
		return
	}
	hash, err := auth.HashPassword(c.Password)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	u, err := h.store.CreateUser(r.Context(), c.Email, hash)
	if errors.Is(err, store.ErrEmailTaken) {
		writeValidation(w, map[string]string{"email": "Этот email уже зарегистрирован. Войдите в аккаунт."})
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	h.registerLimiter.Fail(ip) // counts registrations, not failures
	h.startSession(w, r, http.StatusCreated, u)
}

// POST /api/auth/login {email, password}
func (h *handler) login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	c.Email = normalizeEmail(c.Email)
	emailKey, ipKey := "email:"+c.Email, "ip:"+clientIP(r)
	if !h.loginLimiter.Allowed(emailKey) || !h.loginLimiter.Allowed(ipKey) {
		writeError(w, http.StatusTooManyRequests, "Слишком много неудачных попыток. Попробуйте через 15 минут.")
		return
	}
	fail := func() {
		h.loginLimiter.Fail(emailKey)
		h.loginLimiter.Fail(ipKey)
		// One message for both cases, so it does not reveal which emails exist.
		writeError(w, http.StatusUnauthorized, "Неверный email или пароль")
	}

	u, hash, err := h.store.UserByEmail(r.Context(), c.Email)
	if errors.Is(err, store.ErrNotFound) {
		auth.BurnTime(c.Password)
		fail()
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	ok, err := auth.CheckPassword(c.Password, hash)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	if !ok {
		fail()
		return
	}
	h.loginLimiter.Reset(emailKey)
	h.startSession(w, r, http.StatusOK, u)
}

// POST /api/auth/logout ends the current session.
func (h *handler) logout(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteSession(r.Context(), auth.HashToken(bearerToken(r))); err != nil {
		h.internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/auth/me
func (h *handler) me(w http.ResponseWriter, r *http.Request) {
	u, err := h.store.GetUser(r.Context(), userID(r))
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}
