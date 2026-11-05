package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

const txSelect = `
SELECT t.id, t.asset_id, a.name, t.type, t.amount, t.category, t.comment, t.is_initial, t.occurred_at, t.created_at
FROM transactions t
JOIN assets a ON a.id = t.asset_id`

func scanTransaction(row scanner) (Transaction, error) {
	var (
		t                 Transaction
		category          sql.NullString
		occurred, created int64
	)
	if err := row.Scan(&t.ID, &t.AssetID, &t.AssetName, &t.Type, &t.Amount, &category,
		&t.Comment, &t.IsInitial, &occurred, &created); err != nil {
		return Transaction{}, err
	}
	if category.Valid {
		t.Category = &category.String
	}
	t.OccurredAt = fromMs(occurred)
	t.CreatedAt = fromMs(created)
	return t, nil
}

// TxFilter narrows ListTransactions. Zero values mean "any".
type TxFilter struct {
	AssetID  int64
	Type     string
	Category string
	Range    Range
	Limit    int
	Offset   int
}

// ListTransactions returns transactions, newest first.
func (s *Store) ListTransactions(ctx context.Context, f TxFilter) ([]Transaction, error) {
	q := txSelect + " WHERE 1 = 1"
	var args []any
	if f.AssetID != 0 {
		q += " AND t.asset_id = ?"
		args = append(args, f.AssetID)
	}
	if f.Type != "" {
		q += " AND t.type = ?"
		args = append(args, f.Type)
	}
	if f.Category != "" {
		q += " AND t.category = ?"
		args = append(args, f.Category)
	}
	rangeSQL, rangeArgs := f.Range.where("t.occurred_at")
	q += rangeSQL
	args = append(args, rangeArgs...)

	q += " ORDER BY t.occurred_at DESC, t.id DESC LIMIT ? OFFSET ?"
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list transactions: %w", err)
	}
	defer rows.Close()

	list := []Transaction{}
	for rows.Next() {
		t, err := scanTransaction(rows)
		if err != nil {
			return nil, fmt.Errorf("scan transaction: %w", err)
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

// GetTransaction returns one transaction.
func (s *Store) GetTransaction(ctx context.Context, id int64) (Transaction, error) {
	t, err := scanTransaction(s.db.QueryRowContext(ctx, txSelect+" WHERE t.id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return Transaction{}, ErrNotFound
	}
	if err != nil {
		return Transaction{}, fmt.Errorf("get transaction: %w", err)
	}
	return t, nil
}

// CreateTransaction adds a top-up or an expense to an asset.
func (s *Store) CreateTransaction(ctx context.Context, in NewTransaction) (Transaction, error) {
	var category any
	if in.Category != nil {
		category = *in.Category
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO transactions (asset_id, type, amount, category, comment, occurred_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		in.AssetID, in.Type, in.Amount, category, strings.TrimSpace(in.Comment),
		ms(in.OccurredAt), ms(time.Now()))
	if err != nil {
		// The foreign key rejects transactions for a missing asset.
		if strings.Contains(err.Error(), "FOREIGN KEY constraint failed") {
			return Transaction{}, ErrAssetNotFound
		}
		return Transaction{}, fmt.Errorf("insert transaction: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Transaction{}, err
	}
	return s.GetTransaction(ctx, id)
}

// DeleteTransaction deletes one transaction.
func (s *Store) DeleteTransaction(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM transactions WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete transaction: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}
