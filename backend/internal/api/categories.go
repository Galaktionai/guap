package api

import (
	"errors"
	"net/http"
	"strings"

	"guap/backend/internal/store"
)

// GET /api/categories?type=expense|income
func (h *handler) listCategories(w http.ResponseWriter, r *http.Request) {
	txType := r.URL.Query().Get("type")
	if txType != "" && txType != store.TypeIncome && txType != store.TypeExpense {
		writeError(w, http.StatusBadRequest, "Параметр type должен быть income или expense")
		return
	}
	list, err := h.store.ListCategories(r.Context(), userID(r), txType)
	if err != nil {
		h.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

type categoryRequest struct {
	Type  string `json:"type"` // only on create; the type cannot be changed
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

func (req categoryRequest) input() store.CategoryInput {
	return store.CategoryInput{Name: strings.TrimSpace(req.Name), Icon: req.Icon, Color: req.Color}
}

func (h *handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var req categoryRequest
	if !decode(w, r, &req) {
		return
	}
	in := req.input()
	errs := in.Validate()
	if req.Type != store.TypeIncome && req.Type != store.TypeExpense {
		if errs == nil {
			errs = map[string]string{}
		}
		errs["type"] = "Тип должен быть income или expense"
	}
	if errs != nil {
		writeValidation(w, errs)
		return
	}
	c, err := h.store.CreateCategory(r.Context(), userID(r), req.Type, in)
	if h.categoryError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *handler) updateCategory(w http.ResponseWriter, r *http.Request) {
	var req categoryRequest
	if !decode(w, r, &req) {
		return
	}
	in := req.input()
	if errs := in.Validate(); errs != nil {
		writeValidation(w, errs)
		return
	}
	id := r.PathValue("id")
	if req.Type != "" {
		// Silently ignoring a new type would be surprising; reject it instead.
		cur, err := h.store.GetCategory(r.Context(), userID(r), id)
		if h.categoryError(w, r, err) {
			return
		}
		if req.Type != cur.Type {
			writeValidation(w, map[string]string{"type": "Тип категории изменить нельзя"})
			return
		}
	}
	c, err := h.store.UpdateCategory(r.Context(), userID(r), id, in)
	if h.categoryError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *handler) deleteCategory(w http.ResponseWriter, r *http.Request) {
	err := h.store.DeleteCategory(r.Context(), userID(r), r.PathValue("id"))
	if h.categoryError(w, r, err) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// categoryError writes the response for a store error and reports whether
// there was one.
func (h *handler) categoryError(w http.ResponseWriter, r *http.Request, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "Категория не найдена")
	case errors.Is(err, store.ErrDuplicateCategory):
		writeValidation(w, map[string]string{"name": "Категория с таким названием уже есть"})
	default:
		h.internal(w, r, err)
	}
	return true
}
