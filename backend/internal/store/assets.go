package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

const assetSelect = `
SELECT a.id, a.name, a.icon, a.color, a.created_at,
       COALESCE(SUM(CASE t.type WHEN 'income' THEN t.amount WHEN 'expense' THEN -t.amount END), 0),
       COUNT(t.id)
FROM assets a
LEFT JOIN transactions t ON t.asset_id = a.id`

type scanner interface{ Scan(dest ...any) error }

func scanAsset(row scanner) (Asset, error) {
	var a Asset
	var created int64
	if err := row.Scan(&a.ID, &a.Name, &a.Icon, &a.Color, &created, &a.Balance, &a.TransactionsCount); err != nil {
		return Asset{}, err
	}
	a.CreatedAt = fromMs(created)
	return a, nil
}

// ListAssets returns all assets with their balances, oldest first.
func (s *Store) ListAssets(ctx context.Context) ([]Asset, error) {
	rows, err := s.db.QueryContext(ctx, assetSelect+` GROUP BY a.id ORDER BY a.created_at, a.id`)
	if err != nil {
		return nil, fmt.Errorf("list assets: %w", err)
	}
	defer rows.Close()

	assets := []Asset{}
	for rows.Next() {
		a, err := scanAsset(rows)
		if err != nil {
			return nil, fmt.Errorf("scan asset: %w", err)
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

// GetAsset returns one asset with its balance.
func (s *Store) GetAsset(ctx context.Context, id int64) (Asset, error) {
	a, err := scanAsset(s.db.QueryRowContext(ctx, assetSelect+` WHERE a.id = ? GROUP BY a.id`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Asset{}, ErrNotFound
	}
	if err != nil {
		return Asset{}, fmt.Errorf("get asset: %w", err)
	}
	return a, nil
}

// CreateAsset creates an asset. A positive initial balance is recorded as an
// opening income transaction so that it shows up in the history.
func (s *Store) CreateAsset(ctx context.Context, in NewAsset) (Asset, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Asset{}, err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	now := ms(time.Now())
	res, err := tx.ExecContext(ctx,
		`INSERT INTO assets (name, icon, color, created_at) VALUES (?, ?, ?, ?)`,
		in.Name, in.Icon, in.Color, now)
	if err != nil {
		return Asset{}, fmt.Errorf("insert asset: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Asset{}, err
	}

	if in.InitialBalance > 0 {
		_, err = tx.ExecContext(ctx,
			`INSERT INTO transactions (asset_id, type, amount, comment, is_initial, occurred_at, created_at)
			 VALUES (?, 'income', ?, 'Начальный баланс', 1, ?, ?)`,
			id, in.InitialBalance, now, now)
		if err != nil {
			return Asset{}, fmt.Errorf("insert initial balance: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return Asset{}, err
	}
	return s.GetAsset(ctx, id)
}

// DeleteAsset deletes an asset together with all its transactions.
func (s *Store) DeleteAsset(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM assets WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete asset: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}
