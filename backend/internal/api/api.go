// Package api exposes the REST API over HTTP.
package api

import (
	"log/slog"
	"net/http"
	"time"

	"guap/backend/internal/auth"
	"guap/backend/internal/store"
)

type handler struct {
	store *store.Store
	log   *slog.Logger

	loginLimiter    *auth.Limiter
	registerLimiter *auth.Limiter
}

// New returns the HTTP handler with all API routes. Everything except
// health, register and login needs "Authorization: Bearer <token>".
func New(st *store.Store, log *slog.Logger) http.Handler {
	h := &handler{
		store:           st,
		log:             log,
		loginLimiter:    auth.NewLimiter(10, 15*time.Minute),
		registerLimiter: auth.NewLimiter(10, time.Hour),
	}
	mux := http.NewServeMux()
	private := func(pattern string, fn http.HandlerFunc) { mux.Handle(pattern, h.requireUser(fn)) }

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/auth/register", h.register)
	mux.HandleFunc("POST /api/auth/login", h.login)
	private("POST /api/auth/logout", h.logout)
	private("GET /api/auth/me", h.me)

	private("GET /api/categories", h.listCategories)
	private("POST /api/categories", h.createCategory)
	private("PUT /api/categories/{id}", h.updateCategory)
	private("DELETE /api/categories/{id}", h.deleteCategory)
	private("GET /api/summary", h.summary)

	private("GET /api/assets", h.listAssets)
	private("POST /api/assets", h.createAsset)
	private("GET /api/assets/{id}", h.getAsset)
	private("DELETE /api/assets/{id}", h.deleteAsset)

	private("GET /api/transactions", h.listTransactions)
	private("POST /api/transactions", h.createTransaction)
	private("DELETE /api/transactions/{id}", h.deleteTransaction)

	private("GET /api/stats/categories", h.categoryStats)

	return logRequests(log, cors(mux))
}
