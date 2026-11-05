package api_test

import (
	"net/http"
	"strings"
	"testing"

	"guap/backend/internal/store"
)

func TestAuthFlow(t *testing.T) {
	srv := newServer(t)
	anon := &client{t: t, srv: srv}

	if st := anon.do("GET", "/api/assets", nil, nil); st != http.StatusUnauthorized {
		t.Fatalf("no token: status %d, want 401", st)
	}
	var body struct {
		Fields map[string]string `json:"fields"`
	}
	if st := anon.do("POST", "/api/auth/register", map[string]any{"email": "not-an-email", "password": "short"}, &body); st != http.StatusUnprocessableEntity || body.Fields["email"] == "" || body.Fields["password"] == "" {
		t.Fatalf("bad credentials: status %d, fields %v", st, body.Fields)
	}

	c := signUp(t, srv, "  Anna@Example.com ")
	var me store.User
	if st := c.do("GET", "/api/auth/me", nil, &me); st != http.StatusOK || me.Email != "anna@example.com" {
		t.Fatalf("me: status %d, user %+v (email should be normalized)", st, me)
	}
	if st := anon.do("POST", "/api/auth/register", map[string]any{"email": "ANNA@example.com", "password": "another password"}, &body); st != http.StatusUnprocessableEntity || body.Fields["email"] == "" {
		t.Fatalf("duplicate email: status %d", st)
	}

	if st := anon.do("POST", "/api/auth/login", map[string]any{"email": "anna@example.com", "password": "wrong password"}, nil); st != http.StatusUnauthorized {
		t.Fatalf("wrong password: status %d, want 401", st)
	}
	var unknown, wrong struct {
		Error string `json:"error"`
	}
	anon.do("POST", "/api/auth/login", map[string]any{"email": "nobody@example.com", "password": "whatever1"}, &unknown)
	anon.do("POST", "/api/auth/login", map[string]any{"email": "anna@example.com", "password": "whatever1"}, &wrong)
	if unknown.Error != wrong.Error {
		t.Fatalf("unknown email and wrong password must look the same: %q vs %q", unknown.Error, wrong.Error)
	}

	var login struct {
		Token string     `json:"token"`
		User  store.User `json:"user"`
	}
	if st := anon.do("POST", "/api/auth/login", map[string]any{"email": "ANNA@example.com", "password": "correct horse"}, &login); st != http.StatusOK || login.Token == "" {
		t.Fatalf("login: status %d", st)
	}
	second := &client{t: t, srv: srv, token: login.Token}
	if st := second.do("GET", "/api/assets", nil, nil); st != http.StatusOK {
		t.Fatalf("second session: status %d", st)
	}

	// Logout ends only that session.
	if st := second.do("POST", "/api/auth/logout", nil, nil); st != http.StatusNoContent {
		t.Fatalf("logout: status %d", st)
	}
	if st := second.do("GET", "/api/assets", nil, nil); st != http.StatusUnauthorized {
		t.Fatalf("after logout: status %d, want 401", st)
	}
	if st := c.do("GET", "/api/assets", nil, nil); st != http.StatusOK {
		t.Fatalf("other session after logout: status %d", st)
	}
}

func TestUsersSeeOnlyTheirOwnData(t *testing.T) {
	srv := newServer(t)
	anna := signUp(t, srv, "anna@example.com")
	boris := signUp(t, srv, "boris@example.com")

	asset := anna.createAsset("Карта Анны", 1_000_00)
	var annaCats, borisCats []store.Category
	anna.do("GET", "/api/categories?type=expense", nil, &annaCats)
	boris.do("GET", "/api/categories?type=expense", nil, &borisCats)
	if len(annaCats) == 0 || len(borisCats) != len(annaCats) {
		t.Fatalf("each user gets the default categories: anna %d, boris %d", len(annaCats), len(borisCats))
	}
	if annaCats[0].ID == borisCats[0].ID {
		t.Fatalf("users must not share category ids")
	}
	tx, _ := anna.createTx(map[string]any{"asset_id": asset.ID, "type": "expense", "amount": 100_00, "category": annaCats[0].ID})

	var assets []store.Asset
	boris.do("GET", "/api/assets", nil, &assets)
	var txs []store.Transaction
	boris.do("GET", "/api/transactions", nil, &txs)
	var sum store.Summary
	boris.do("GET", "/api/summary", nil, &sum)
	if len(assets) != 0 || len(txs) != 0 || sum.TotalBalance != 0 || sum.AssetsCount != 0 {
		t.Fatalf("boris sees anna's data: assets %d, txs %d, summary %+v", len(assets), len(txs), sum)
	}

	for _, req := range []struct{ method, path string }{
		{"GET", "/api/assets/" + itoa(asset.ID)},
		{"DELETE", "/api/assets/" + itoa(asset.ID)},
		{"DELETE", "/api/transactions/" + itoa(tx.ID)},
		{"DELETE", "/api/categories/" + annaCats[0].ID},
	} {
		if st := boris.do(req.method, req.path, nil, nil); st != http.StatusNotFound {
			t.Fatalf("boris %s %s: status %d, want 404", req.method, req.path, st)
		}
	}
	if st := boris.do("PUT", "/api/categories/"+annaCats[0].ID, map[string]any{"name": "Взлом", "icon": "gift", "color": "red"}, nil); st != http.StatusNotFound {
		t.Fatalf("boris renames anna's category: status %d, want 404", st)
	}
	if _, st := boris.createTx(map[string]any{"asset_id": asset.ID, "type": "income", "amount": 100, "category": borisCats[0].ID}); st != http.StatusUnprocessableEntity {
		t.Fatalf("boris writes to anna's asset: status %d, want 422", st)
	}
	borisAsset := boris.createAsset("Карта Бориса", 0)
	if _, st := boris.createTx(map[string]any{"asset_id": borisAsset.ID, "type": "expense", "amount": 100, "category": annaCats[0].ID}); st != http.StatusUnprocessableEntity {
		t.Fatalf("boris uses anna's category: status %d, want 422", st)
	}

	var got store.Asset
	if st := anna.do("GET", "/api/assets/"+itoa(asset.ID), nil, &got); st != http.StatusOK || got.Balance != 900_00 {
		t.Fatalf("anna's asset changed: status %d, balance %d", st, got.Balance)
	}
}

func TestFirstUserTakesOverExistingData(t *testing.T) {
	srv := newServer(t)
	// The database already has the default categories without an owner
	// (as databases created before accounts did).
	first := signUp(t, srv, "first@example.com")
	second := signUp(t, srv, "second@example.com")

	ids := func(c *client) string {
		var cats []store.Category
		c.do("GET", "/api/categories", nil, &cats)
		var b strings.Builder
		for _, x := range cats {
			b.WriteString(x.ID + " ")
		}
		return b.String()
	}
	if !strings.Contains(ids(first), "groceries ") {
		t.Fatalf("first user should own the original categories: %s", ids(first))
	}
	if strings.Contains(ids(second), "groceries ") {
		t.Fatalf("second user must get fresh copies: %s", ids(second))
	}
}

func TestLoginRateLimit(t *testing.T) {
	srv := newServer(t)
	signUp(t, srv, "anna@example.com")
	anon := &client{t: t, srv: srv}
	for i := 0; i < 10; i++ {
		anon.do("POST", "/api/auth/login", map[string]any{"email": "anna@example.com", "password": "guess" + itoa(int64(i))}, nil)
	}
	if st := anon.do("POST", "/api/auth/login", map[string]any{"email": "anna@example.com", "password": "correct horse"}, nil); st != http.StatusTooManyRequests {
		t.Fatalf("after 10 failures: status %d, want 429", st)
	}
}
