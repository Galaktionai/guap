// Package store keeps assets and transactions in SQLite.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite" // pure-Go SQLite driver, no cgo needed
)

var (
	// ErrNotFound is returned when the requested record does not exist.
	ErrNotFound = errors.New("not found")
	// ErrAssetNotFound is returned when a transaction references a missing asset.
	ErrAssetNotFound = errors.New("asset not found")
)

// Store is the data access layer.
type Store struct {
	db *sql.DB
}

// Open opens (or creates) the database at path and applies the schema.
// Use ":memory:" for an in-memory database.
func Open(ctx context.Context, path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// SQLite has a single writer; one connection avoids "database is locked"
	// errors and keeps an in-memory database alive between queries.
	db.SetMaxOpenConns(1)

	s := &Store{db: db}
	if err := s.migrate(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// Close closes the database.
func (s *Store) Close() error { return s.db.Close() }

const schema = `
CREATE TABLE IF NOT EXISTS assets (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	name       TEXT    NOT NULL,
	icon       TEXT    NOT NULL,
	color      TEXT    NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
	type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
	amount      INTEGER NOT NULL CHECK (amount > 0),
	category    TEXT,
	comment     TEXT    NOT NULL DEFAULT '',
	is_initial  INTEGER NOT NULL DEFAULT 0,
	occurred_at INTEGER NOT NULL,
	created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_asset ON transactions(asset_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_time  ON transactions(occurred_at DESC);
`

func (s *Store) migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, schema); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}

// Times are stored as Unix milliseconds (UTC).
func ms(t time.Time) int64     { return t.UnixMilli() }
func fromMs(v int64) time.Time { return time.UnixMilli(v).UTC() }

// Range limits a query to [From, To). Nil bounds are open.
type Range struct {
	From *time.Time
	To   *time.Time
}

func (r Range) where(column string) (string, []any) {
	var clause string
	var args []any
	if r.From != nil {
		clause += " AND " + column + " >= ?"
		args = append(args, ms(*r.From))
	}
	if r.To != nil {
		clause += " AND " + column + " < ?"
		args = append(args, ms(*r.To))
	}
	return clause, args
}
