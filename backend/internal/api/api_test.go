package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"guap/backend/internal/api"
	"guap/backend/internal/store"
)

type client struct {
	t     *testing.T
	srv   *httptest.Server
	token string
}

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	st, err := store.Open(context.Background(), ":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	srv := httptest.NewServer(api.New(st, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(srv.Close)
	return srv
}

// newClient starts a fresh server and registers a user on it.
func newClient(t *testing.T) *client {
	t.Helper()
	return signUp(t, newServer(t), "user@example.com")
}

// signUp registers email on srv and returns a client signed in as that user.
func signUp(t *testing.T, srv *httptest.Server, email string) *client {
	t.Helper()
	c := &client{t: t, srv: srv}
	var res struct {
		Token string `json:"token"`
	}
	if st := c.do("POST", "/api/auth/register", map[string]any{"email": email, "password": "correct horse"}, &res); st != http.StatusCreated {
		t.Fatalf("register %s: status %d", email, st)
	}
	c.token = res.Token
	return c
}

// do sends a request and decodes the JSON response into out (if non-nil).
func (c *client) do(method, path string, body any, out any) int {
	c.t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, c.srv.URL+path, r)
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			c.t.Fatalf("%s %s: decode: %v", method, path, err)
		}
	}
	return resp.StatusCode
}

func (c *client) createAsset(name string, initial int64) store.Asset {
	c.t.Helper()
	var a store.Asset
	status := c.do("POST", "/api/assets", map[string]any{
		"name": name, "icon": "credit-card", "color": "blue", "initial_balance": initial,
	}, &a)
	if status != http.StatusCreated {
		c.t.Fatalf("create asset: status %d", status)
	}
	return a
}

func (c *client) createTx(body map[string]any) (store.Transaction, int) {
	c.t.Helper()
	var tx store.Transaction
	var raw json.RawMessage
	status := c.do("POST", "/api/transactions", body, &raw)
	if status == http.StatusCreated {
		_ = json.Unmarshal(raw, &tx)
	}
	return tx, status
}

func TestAssetLifecycle(t *testing.T) {
	c := newClient(t)

	a := c.createAsset("Основная карта", 100_000_00)
	if a.Balance != 100_000_00 || a.TransactionsCount != 1 {
		t.Fatalf("new asset: balance=%d count=%d, want 10000000 and 1", a.Balance, a.TransactionsCount)
	}

	food := "groceries"
	if _, st := c.createTx(map[string]any{"asset_id": a.ID, "type": "expense", "amount": 2_340_00, "category": food, "comment": "На неделю"}); st != http.StatusCreated {
		t.Fatalf("expense: status %d", st)
	}
	if _, st := c.createTx(map[string]any{"asset_id": a.ID, "type": "income", "amount": 95_000_00, "category": "salary"}); st != http.StatusCreated {
		t.Fatalf("income: status %d", st)
	}

	var got store.Asset
	c.do("GET", "/api/assets/"+itoa(a.ID), nil, &got)
	if want := int64(100_000_00 - 2_340_00 + 95_000_00); got.Balance != want {
		t.Fatalf("balance = %d, want %d", got.Balance, want)
	}

	var list []store.Transaction
	c.do("GET", "/api/transactions?asset_id="+itoa(a.ID), nil, &list)
	if len(list) != 3 {
		t.Fatalf("history has %d transactions, want 3", len(list))
	}
	var initial *store.Transaction
	for i := range list {
		if list[i].IsInitial {
			initial = &list[i]
		}
	}
	if initial == nil || initial.Type != "income" || initial.Amount != 100_000_00 {
		t.Fatalf("opening balance not recorded as initial income: %+v", list)
	}

	if st := c.do("DELETE", "/api/assets/"+itoa(a.ID), nil, nil); st != http.StatusNoContent {
		t.Fatalf("delete asset: status %d", st)
	}
	if st := c.do("GET", "/api/assets/"+itoa(a.ID), nil, nil); st != http.StatusNotFound {
		t.Fatalf("get deleted asset: status %d, want 404", st)
	}
	c.do("GET", "/api/transactions", nil, &list)
	if len(list) != 0 {
		t.Fatalf("transactions of deleted asset remain: %d", len(list))
	}
}

func TestDeleteTransactionRestoresBalance(t *testing.T) {
	c := newClient(t)
	a := c.createAsset("Наличные", 5_000_00)
	tx, _ := c.createTx(map[string]any{"asset_id": a.ID, "type": "expense", "amount": 1_000_00, "category": "cafe"})

	if st := c.do("DELETE", "/api/transactions/"+itoa(tx.ID), nil, nil); st != http.StatusNoContent {
		t.Fatalf("delete: status %d", st)
	}
	if st := c.do("DELETE", "/api/transactions/"+itoa(tx.ID), nil, nil); st != http.StatusNotFound {
		t.Fatalf("second delete: status %d, want 404", st)
	}
	var got store.Asset
	c.do("GET", "/api/assets/"+itoa(a.ID), nil, &got)
	if got.Balance != 5_000_00 {
		t.Fatalf("balance = %d, want 500000", got.Balance)
	}
}

func TestValidation(t *testing.T) {
	c := newClient(t)
	a := c.createAsset("Карта", 0)

	cases := []struct {
		name  string
		body  map[string]any
		field string
	}{
		{"expense without category", map[string]any{"asset_id": a.ID, "type": "expense", "amount": 100}, "category"},
		{"unknown category", map[string]any{"asset_id": a.ID, "type": "expense", "amount": 100, "category": "yachts"}, "category"},
		{"income with expense category", map[string]any{"asset_id": a.ID, "type": "income", "amount": 100, "category": "cafe"}, "category"},
		{"expense with income category", map[string]any{"asset_id": a.ID, "type": "expense", "amount": 100, "category": "salary"}, "category"},
		{"income without category", map[string]any{"asset_id": a.ID, "type": "income", "amount": 100}, "category"},
		{"zero amount", map[string]any{"asset_id": a.ID, "type": "income", "amount": 0}, "amount"},
		{"bad type", map[string]any{"asset_id": a.ID, "type": "transfer", "amount": 100}, "type"},
		{"missing asset", map[string]any{"asset_id": 999, "type": "income", "amount": 100, "category": "salary"}, "asset_id"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var body struct {
				Fields map[string]string `json:"fields"`
			}
			st := c.do("POST", "/api/transactions", tc.body, &body)
			if st != http.StatusUnprocessableEntity {
				t.Fatalf("status %d, want 422", st)
			}
			if body.Fields[tc.field] == "" {
				t.Fatalf("no error for field %q: %v", tc.field, body.Fields)
			}
		})
	}

	var body struct {
		Fields map[string]string `json:"fields"`
	}
	if st := c.do("POST", "/api/assets", map[string]any{"name": "  ", "icon": "rocket", "color": "blue"}, &body); st != http.StatusUnprocessableEntity {
		t.Fatalf("asset validation: status %d", st)
	}
	if body.Fields["name"] == "" || body.Fields["icon"] == "" {
		t.Fatalf("asset field errors missing: %v", body.Fields)
	}
	if st := c.do("POST", "/api/assets", map[string]any{"name": "X", "icon": "wallet", "color": "blue", "extra": 1}, nil); st != http.StatusBadRequest {
		t.Fatalf("unknown field: status %d, want 400", st)
	}
}

func TestSummaryAndCategoryStats(t *testing.T) {
	c := newClient(t)
	card := c.createAsset("Карта", 50_000_00)
	cash := c.createAsset("Наличные", 10_000_00)

	nov := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	oct := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	for _, tx := range []map[string]any{
		{"asset_id": card.ID, "type": "expense", "amount": 3_000_00, "category": "groceries", "occurred_at": nov},
		{"asset_id": cash.ID, "type": "expense", "amount": 1_000_00, "category": "groceries", "occurred_at": nov},
		{"asset_id": card.ID, "type": "expense", "amount": 2_500_00, "category": "transport", "occurred_at": nov},
		{"asset_id": card.ID, "type": "income", "amount": 20_000_00, "category": "salary", "occurred_at": nov},
		{"asset_id": cash.ID, "type": "income", "amount": 500_00, "category": "cashback", "occurred_at": nov},
		{"asset_id": card.ID, "type": "expense", "amount": 9_999_00, "category": "home", "occurred_at": oct},
	} {
		if _, st := c.createTx(tx); st != http.StatusCreated {
			t.Fatalf("create %v: status %d", tx, st)
		}
	}

	q := "?" + url.Values{"from": {"2026-11-01T00:00:00Z"}, "to": {"2026-12-01T00:00:00Z"}}.Encode()

	var sum store.Summary
	c.do("GET", "/api/summary"+q, nil, &sum)
	wantTotal := int64(50_000_00 + 10_000_00 - 3_000_00 - 1_000_00 - 2_500_00 + 20_000_00 + 500_00 - 9_999_00)
	if sum.TotalBalance != wantTotal || sum.AssetsCount != 2 {
		t.Fatalf("summary total=%d assets=%d, want %d and 2", sum.TotalBalance, sum.AssetsCount, wantTotal)
	}
	// Opening balances are not income; October expenses are out of range.
	if sum.Income != 20_500_00 || sum.Expense != 6_500_00 {
		t.Fatalf("november income=%d expense=%d, want 2050000 and 650000", sum.Income, sum.Expense)
	}

	var stats store.CategoryStats
	c.do("GET", "/api/stats/categories"+q, nil, &stats)
	if stats.Total != 6_500_00 || len(stats.Items) != 2 {
		t.Fatalf("stats = %+v", stats)
	}
	if *stats.Items[0].Category != "groceries" || stats.Items[0].Amount != 4_000_00 {
		t.Fatalf("largest category = %+v, want groceries 400000", stats.Items[0])
	}

	// Income breakdown: opening balances are not income.
	var income store.CategoryStats
	c.do("GET", "/api/stats/categories"+q+"&type=income", nil, &income)
	if income.Total != 20_500_00 || len(income.Items) != 2 || *income.Items[0].Category != "salary" {
		t.Fatalf("income stats = %+v, want salary 2000000 + cashback 50000", income)
	}
	if st := c.do("GET", "/api/stats/categories?type=transfer", nil, nil); st != http.StatusBadRequest {
		t.Fatalf("bad stats type: status %d, want 400", st)
	}

	if st := c.do("GET", "/api/summary?from=yesterday", nil, nil); st != http.StatusBadRequest {
		t.Fatalf("bad range: status %d, want 400", st)
	}
}

func TestListFilters(t *testing.T) {
	c := newClient(t)
	a := c.createAsset("Карта", 1_000_00)
	c.createTx(map[string]any{"asset_id": a.ID, "type": "expense", "amount": 100, "category": "cafe"})
	c.createTx(map[string]any{"asset_id": a.ID, "type": "expense", "amount": 200, "category": "transport"})

	var list []store.Transaction
	c.do("GET", "/api/transactions?type=expense", nil, &list)
	if len(list) != 2 {
		t.Fatalf("expenses: %d, want 2", len(list))
	}
	c.do("GET", "/api/transactions?category=cafe", nil, &list)
	if len(list) != 1 || *list[0].Category != "cafe" {
		t.Fatalf("cafe filter: %+v", list)
	}
	c.do("GET", "/api/transactions?limit=1", nil, &list)
	if len(list) != 1 || list[0].Amount != 200 {
		t.Fatalf("limit/order: %+v, want newest (200) only", list)
	}

	var cats []store.Category
	c.do("GET", "/api/categories", nil, &cats)
	if len(cats) != len(store.DefaultCategories) {
		t.Fatalf("categories: %d", len(cats))
	}
}

func TestCategoryCRUD(t *testing.T) {
	c := newClient(t)
	a := c.createAsset("Карта", 10_000_00)

	var pets store.Category
	if st := c.do("POST", "/api/categories", map[string]any{"type": "expense", "name": "Питомцы", "icon": "paw-print", "color": "orange"}, &pets); st != http.StatusCreated {
		t.Fatalf("create: status %d", st)
	}
	if pets.ID == "" || pets.Type != "expense" {
		t.Fatalf("created category = %+v", pets)
	}

	// Names are unique per type, ignoring case (Cyrillic included)...
	var body struct {
		Fields map[string]string `json:"fields"`
	}
	if st := c.do("POST", "/api/categories", map[string]any{"type": "expense", "name": "питомцы", "icon": "gift", "color": "red"}, &body); st != http.StatusUnprocessableEntity || body.Fields["name"] == "" {
		t.Fatalf("duplicate name: status %d, fields %v", st, body.Fields)
	}
	// ...but the same name is fine for the other type.
	if st := c.do("POST", "/api/categories", map[string]any{"type": "income", "name": "Питомцы", "icon": "gift", "color": "red"}, nil); st != http.StatusCreated {
		t.Fatalf("same name, other type: status %d", st)
	}
	if st := c.do("POST", "/api/categories", map[string]any{"type": "expense", "name": "X", "icon": "rocket", "color": "red"}, nil); st != http.StatusUnprocessableEntity {
		t.Fatalf("unknown icon: status %d", st)
	}

	tx, st := c.createTx(map[string]any{"asset_id": a.ID, "type": "expense", "amount": 700_00, "category": pets.ID})
	if st != http.StatusCreated {
		t.Fatalf("expense in custom category: status %d", st)
	}
	if _, st := c.createTx(map[string]any{"asset_id": a.ID, "type": "income", "amount": 100, "category": pets.ID}); st != http.StatusUnprocessableEntity {
		t.Fatalf("income in expense category: status %d", st)
	}

	var renamed store.Category
	if st := c.do("PUT", "/api/categories/"+pets.ID, map[string]any{"name": "Кот", "icon": "paw-print", "color": "pink"}, &renamed); st != http.StatusOK {
		t.Fatalf("update: status %d", st)
	}
	if renamed.Name != "Кот" || renamed.Color != "pink" || renamed.TransactionsCount != 1 {
		t.Fatalf("updated category = %+v", renamed)
	}
	if st := c.do("PUT", "/api/categories/"+pets.ID, map[string]any{"type": "income", "name": "Кот", "icon": "paw-print", "color": "pink"}, nil); st != http.StatusUnprocessableEntity {
		t.Fatalf("type change: status %d, want 422", st)
	}

	// Deleting a category keeps its transactions, now without a category.
	if st := c.do("DELETE", "/api/categories/"+pets.ID, nil, nil); st != http.StatusNoContent {
		t.Fatalf("delete: status %d", st)
	}
	if st := c.do("DELETE", "/api/categories/"+pets.ID, nil, nil); st != http.StatusNotFound {
		t.Fatalf("second delete: status %d, want 404", st)
	}
	var list []store.Transaction
	c.do("GET", "/api/transactions?type=expense", nil, &list)
	if len(list) != 1 || list[0].ID != tx.ID || list[0].Category != nil {
		t.Fatalf("transaction after category delete: %+v", list)
	}
	var stats store.CategoryStats
	c.do("GET", "/api/stats/categories", nil, &stats)
	if len(stats.Items) != 1 || stats.Items[0].Category != nil || stats.Items[0].Amount != 700_00 {
		t.Fatalf("stats after category delete: %+v", stats)
	}
	if _, st := c.createTx(map[string]any{"asset_id": a.ID, "type": "expense", "amount": 100, "category": pets.ID}); st != http.StatusUnprocessableEntity {
		t.Fatalf("expense in deleted category: status %d", st)
	}
}

func itoa(n int64) string { b, _ := json.Marshal(n); return string(b) }
