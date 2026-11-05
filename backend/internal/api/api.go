// Package api exposes the REST API over HTTP.
package api

import (
	"log/slog"
	"net/http"

	"guap/backend/internal/store"
)

type handler struct {
	store *store.Store
	log   *slog.Logger
}

// New returns the HTTP handler with all API routes.
func New(st *store.Store, log *slog.Logger) http.Handler {
	h := &handler{store: st, log: log}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/categories", h.listCategories)
	mux.HandleFunc("GET /api/summary", h.summary)

	mux.HandleFunc("GET /api/assets", h.listAssets)
	mux.HandleFunc("POST /api/assets", h.createAsset)
	mux.HandleFunc("GET /api/assets/{id}", h.getAsset)
	mux.HandleFunc("DELETE /api/assets/{id}", h.deleteAsset)

	mux.HandleFunc("GET /api/transactions", h.listTransactions)
	mux.HandleFunc("POST /api/transactions", h.createTransaction)
	mux.HandleFunc("DELETE /api/transactions/{id}", h.deleteTransaction)

	mux.HandleFunc("GET /api/stats/categories", h.categoryStats)

	return logRequests(log, cors(mux))
}
