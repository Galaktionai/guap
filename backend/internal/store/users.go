package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// User is an account. Every asset and category belongs to one user;
// transactions belong to the user who owns their asset.
type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateUser registers an account. Data that predates accounts (rows
// without an owner) goes to the first user who registers; everyone else
// starts with the default categories.
func (s *Store) CreateUser(ctx context.Context, email, passwordHash string) (User, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	now := time.Now()
	res, err := tx.ExecContext(ctx,
		`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`, email, passwordHash, ms(now))
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return User{}, ErrEmailTaken
		}
		return User{}, fmt.Errorf("insert user: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return User{}, err
	}

	if _, err := tx.ExecContext(ctx, `UPDATE assets SET user_id = ? WHERE user_id IS NULL`, id); err != nil {
		return User{}, fmt.Errorf("claim assets: %w", err)
	}
	res, err = tx.ExecContext(ctx, `UPDATE categories SET user_id = ? WHERE user_id IS NULL`, id)
	if err != nil {
		return User{}, fmt.Errorf("claim categories: %w", err)
	}
	if claimed, _ := res.RowsAffected(); claimed == 0 {
		if err := seedCategories(ctx, tx, id); err != nil {
			return User{}, fmt.Errorf("seed categories: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return User{}, err
	}
	return User{ID: id, Email: email, CreatedAt: fromMs(ms(now))}, nil
}

// seedCategories gives a new user their own copy of the default categories.
// Ids are random because category ids are unique across all users.
func seedCategories(ctx context.Context, tx *sql.Tx, userID int64) error {
	now := ms(time.Now())
	for i, c := range DefaultCategories {
		id, err := newCategoryID()
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO categories (id, user_id, type, name, icon, color, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, userID, c.Type, c.Name, c.Icon, c.Color, i, now); err != nil {
			return err
		}
	}
	return nil
}

// UserByEmail returns the user and their password hash.
func (s *Store) UserByEmail(ctx context.Context, email string) (User, string, error) {
	var (
		u       User
		hash    string
		created int64
	)
	err := s.db.QueryRowContext(ctx, `SELECT id, email, password_hash, created_at FROM users WHERE email = ?`, email).
		Scan(&u.ID, &u.Email, &hash, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, "", ErrNotFound
	}
	if err != nil {
		return User{}, "", fmt.Errorf("get user: %w", err)
	}
	u.CreatedAt = fromMs(created)
	return u, hash, nil
}

// GetUser returns a user by id.
func (s *Store) GetUser(ctx context.Context, id int64) (User, error) {
	var (
		u       User
		created int64
	)
	err := s.db.QueryRowContext(ctx, `SELECT id, email, created_at FROM users WHERE id = ?`, id).Scan(&u.ID, &u.Email, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user: %w", err)
	}
	u.CreatedAt = fromMs(created)
	return u, nil
}

// CreateSession stores a session. Only a hash of the token is kept, so a
// leaked database does not leak working tokens.
func (s *Store) CreateSession(ctx context.Context, userID int64, tokenHash string, expires time.Time) error {
	now := time.Now()
	// Housekeeping: drop expired sessions while we are writing anyway.
	if _, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, ms(now)); err != nil {
		return fmt.Errorf("delete expired sessions: %w", err)
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
		tokenHash, userID, ms(now), ms(expires))
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

// SessionUser returns the user of a session that has not expired, and when it expires.
func (s *Store) SessionUser(ctx context.Context, tokenHash string) (int64, time.Time, error) {
	var userID, expires int64
	err := s.db.QueryRowContext(ctx,
		`SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?`,
		tokenHash, ms(time.Now())).Scan(&userID, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, time.Time{}, ErrNotFound
	}
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("get session: %w", err)
	}
	return userID, fromMs(expires), nil
}

// ExtendSession moves a session's expiry forward.
func (s *Store) ExtendSession(ctx context.Context, tokenHash string, expires time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE sessions SET expires_at = ? WHERE token_hash = ?`, ms(expires), tokenHash)
	return err
}

// DeleteSession ends a session (logout).
func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}
