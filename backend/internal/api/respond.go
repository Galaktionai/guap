package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// errorBody is the JSON shape of every error response.
type errorBody struct {
	Error  string            `json:"error"`
	Fields map[string]string `json:"fields,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

func writeValidation(w http.ResponseWriter, fields map[string]string) {
	writeJSON(w, http.StatusUnprocessableEntity, errorBody{Error: "Проверьте введённые данные", Fields: fields})
}

func (h *handler) internal(w http.ResponseWriter, r *http.Request, err error) {
	h.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	writeError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
}

// decode reads a JSON body into dst, rejecting unknown fields and bodies over 1 MB.
func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		msg := "Некорректный JSON"
		if errors.Is(err, io.EOF) {
			msg = "Пустое тело запроса"
		}
		writeError(w, http.StatusBadRequest, msg)
		return false
	}
	return true
}
