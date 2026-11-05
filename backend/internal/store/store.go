// Package store keeps assets, transactions and categories in SQLite.
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
	// ErrCategoryNotFound is returned when a transaction references a missing category.
	ErrCategoryNotFound = errors.New("category not found")
	// ErrCategoryType is returned when a transaction's category is of the other type.
	ErrCategoryType = errors.New("category type does not match transaction type")
	// ErrDuplicateCategory is returned when a category name is already taken for that type.
	ErrDuplicateCategory = errors.New("duplicate category name")
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

// migrations upgrade the schema step by step. PRAGMA user_version stores how
// many have been applied, so each runs exactly once per database. Never edit
// a migration that has shipped; append a new one instead.
var migrations = []func(ctx context.Context, tx *sql.Tx) error{
	// 1: assets and transactions. IF NOT EXISTS keeps databases created
	// before versioning was introduced working.
	func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `
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
			CREATE INDEX IF NOT EXISTS idx_transactions_time  ON transactions(occurred_at DESC);`)
		return err
	},
	// 2: user-editable categories, seeded with the defaults. Default ids match
	// the ones transactions already reference.
	func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `
			CREATE TABLE categories (
				id         TEXT    PRIMARY KEY,
				type       TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
				name       TEXT    NOT NULL,
				icon       TEXT    NOT NULL,
				color      TEXT    NOT NULL,
				position   INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			);
			CREATE INDEX idx_categories_type ON categories(type, position);
			CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);`)
		if err != nil {
			return err
		}
		now := ms(time.Now())
		for i, c := range DefaultCategories {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO categories (id, type, name, icon, color, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				c.ID, c.Type, c.Name, c.Icon, c.Color, i, now); err != nil {
				return err
			}
		}
		return nil
	},
}

func (s *Store) migrate(ctx context.Context) error {
	var version int
	if err := s.db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return fmt.Errorf("read schema version: %w", err)
	}
	for i := version; i < len(migrations); i++ {
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		if err := migrations[i](ctx, tx); err != nil {
			tx.Rollback() //nolint:errcheck
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", i+1)); err != nil {
			tx.Rollback() //nolint:errcheck
			return fmt.Errorf("migration %d: set version: %w", i+1, err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("migration %d: commit: %w", i+1, err)
		}
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
