package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"guap/backend/internal/store"
)

// GET /api/summary?from=&to=
func (h *handler) summary(w http.ResponseWriter, r *http.Request) {
	rng, ok := parseRange(w, r)
	if !ok {
		return
	}
	sum, err := h.store.Summary(r.Context(), rng)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, sum)
}

func (h *handler) listAssets(w http.ResponseWriter, r *http.Request) {
	assets, err := h.store.ListAssets(r.Context())
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, assets)
}

func (h *handler) getAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	a, err := h.store.GetAsset(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Актив не найден")
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

type createAssetRequest struct {
	Name           string `json:"name"`
	Icon           string `json:"icon"`
	Color          string `json:"color"`
	InitialBalance int64  `json:"initial_balance"`
}

func (h *handler) createAsset(w http.ResponseWriter, r *http.Request) {
	var req createAssetRequest
	if !decode(w, r, &req) {
		return
	}
	in := store.NewAsset{
		Name:           strings.TrimSpace(req.Name),
		Icon:           req.Icon,
		Color:          req.Color,
		InitialBalance: req.InitialBalance,
	}
	if errs := in.Validate(); errs != nil {
		writeValidation(w, errs)
		return
	}
	a, err := h.store.CreateAsset(r.Context(), in)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (h *handler) deleteAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	err := h.store.DeleteAsset(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Актив не найден")
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/transactions?asset_id=&type=&category=&from=&to=&limit=&offset=
func (h *handler) listTransactions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.TxFilter{Type: q.Get("type"), Category: q.Get("category"), Limit: 50}

	if f.Type != "" && f.Type != store.TypeIncome && f.Type != store.TypeExpense {
		writeError(w, http.StatusBadRequest, "Параметр type должен быть income или expense")
		return
	}
	for _, p := range []struct {
		name     string
		dst      *int
		min, max int
	}{
		{"limit", &f.Limit, 1, 200},
		{"offset", &f.Offset, 0, 1 << 30},
	} {
		if v := q.Get(p.name); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < p.min || n > p.max {
				writeError(w, http.StatusBadRequest, "Некорректный параметр "+p.name)
				return
			}
			*p.dst = n
		}
	}
	if v := q.Get("asset_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "Некорректный параметр asset_id")
			return
		}
		f.AssetID = id
	}
	rng, ok := parseRange(w, r)
	if !ok {
		return
	}
	f.Range = rng

	list, err := h.store.ListTransactions(r.Context(), f)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

type createTransactionRequest struct {
	AssetID    int64      `json:"asset_id"`
	Type       string     `json:"type"`
	Amount     int64      `json:"amount"`
	Category   *string    `json:"category"`
	Comment    string     `json:"comment"`
	OccurredAt *time.Time `json:"occurred_at"`
}

func (h *handler) createTransaction(w http.ResponseWriter, r *http.Request) {
	var req createTransactionRequest
	if !decode(w, r, &req) {
		return
	}
	in := store.NewTransaction{
		AssetID:    req.AssetID,
		Type:       req.Type,
		Amount:     req.Amount,
		Category:   req.Category,
		Comment:    req.Comment,
		OccurredAt: time.Now(),
	}
	if req.OccurredAt != nil {
		in.OccurredAt = *req.OccurredAt
	}
	if errs := in.Validate(); errs != nil {
		writeValidation(w, errs)
		return
	}
	t, err := h.store.CreateTransaction(r.Context(), in)
	switch {
	case errors.Is(err, store.ErrAssetNotFound):
		writeValidation(w, map[string]string{"asset_id": "Актив не найден"})
		return
	case errors.Is(err, store.ErrCategoryNotFound):
		writeValidation(w, map[string]string{"category": "Категория не найдена — возможно, её удалили"})
		return
	case errors.Is(err, store.ErrCategoryType):
		msg := map[string]string{store.TypeIncome: "Эта категория для расходов, а не пополнений",
			store.TypeExpense: "Эта категория для пополнений, а не расходов"}[in.Type]
		writeValidation(w, map[string]string{"category": msg})
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *handler) deleteTransaction(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	err := h.store.DeleteTransaction(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "Операция не найдена")
		return
	}
	if err != nil {
		h.internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/stats/categories?type=expense|income&from=&to=  (type defaults to expense)
func (h *handler) categoryStats(w http.ResponseWriter, r *http.Request) {
	txType := r.URL.Query().Get("type")
	if txType == "" {
		txType = store.TypeExpense
	}
	if txType != store.TypeIncome && txType != store.TypeExpense {
		writeError(w, http.StatusBadRequest, "Параметр type должен быть income или expense")
		return
	}
	rng, ok := parseRange(w, r)
	if !ok {
		return
	}
	stats, err := h.store.CategoryStats(r.Context(), rng, txType)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// parseRange reads optional RFC 3339 "from" (inclusive) and "to" (exclusive)
// query parameters. The client sends local month bounds, so time zones stay
// on the client.
func parseRange(w http.ResponseWriter, r *http.Request) (store.Range, bool) {
	var rng store.Range
	for _, p := range []struct {
		name string
		dst  **time.Time
	}{{"from", &rng.From}, {"to", &rng.To}} {
		v := r.URL.Query().Get(p.name)
		if v == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Параметр "+p.name+" должен быть в формате RFC 3339")
			return store.Range{}, false
		}
		*p.dst = &t
	}
	if rng.From != nil && rng.To != nil && !rng.From.Before(*rng.To) {
		writeError(w, http.StatusBadRequest, "Параметр from должен быть раньше to")
		return store.Range{}, false
	}
	return rng, true
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Некорректный id")
		return 0, false
	}
	return id, true
}
