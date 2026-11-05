package store

import (
	"context"
	"database/sql"
	"fmt"
)

// Summary is the overall budget plus money flow for a period.
// Income excludes opening balances of newly created assets.
type Summary struct {
	TotalBalance int64 `json:"total_balance"`
	AssetsCount  int64 `json:"assets_count"`
	Income       int64 `json:"income"`
	Expense      int64 `json:"expense"`
}

// Summary returns the total balance across the user's assets and the
// income and expense totals within r.
func (s *Store) Summary(ctx context.Context, userID int64, r Range) (Summary, error) {
	var sum Summary
	err := s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*) FROM assets WHERE user_id = ?),
			COALESCE(SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END), 0)
		FROM transactions t
		JOIN assets a ON a.id = t.asset_id
		WHERE a.user_id = ?`, userID, userID).Scan(&sum.AssetsCount, &sum.TotalBalance)
	if err != nil {
		return Summary{}, fmt.Errorf("total balance: %w", err)
	}

	rangeSQL, rangeArgs := r.where("t.occurred_at")
	err = s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN t.type = 'income' AND t.is_initial = 0 THEN t.amount END), 0),
			COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0)
		FROM transactions t
		JOIN assets a ON a.id = t.asset_id
		WHERE a.user_id = ?`+rangeSQL, append([]any{userID}, rangeArgs...)...).Scan(&sum.Income, &sum.Expense)
	if err != nil {
		return Summary{}, fmt.Errorf("period totals: %w", err)
	}
	return sum, nil
}

// CategoryTotal is the amount spent in one category.
// Category is nil for transactions without a category (for example after
// their category was deleted).
type CategoryTotal struct {
	Category *string `json:"category"`
	Amount   int64   `json:"amount"`
}

// CategoryStats is the breakdown of expenses or income for a period,
// largest first.
type CategoryStats struct {
	Total int64           `json:"total"`
	Items []CategoryTotal `json:"items"`
}

// CategoryStats sums the user's transactions of type txType (TypeExpense or TypeIncome)
// within r by category. Opening balances are not income and are left out.
func (s *Store) CategoryStats(ctx context.Context, userID int64, r Range, txType string) (CategoryStats, error) {
	rangeSQL, rangeArgs := r.where("t.occurred_at")
	args := append([]any{userID, txType}, rangeArgs...)
	rows, err := s.db.QueryContext(ctx, `
		SELECT t.category, SUM(t.amount)
		FROM transactions t
		JOIN assets a ON a.id = t.asset_id
		WHERE a.user_id = ? AND t.type = ? AND t.is_initial = 0`+rangeSQL+`
		GROUP BY t.category
		ORDER BY 2 DESC, 1`, args...)
	if err != nil {
		return CategoryStats{}, fmt.Errorf("category stats: %w", err)
	}
	defer rows.Close()

	stats := CategoryStats{Items: []CategoryTotal{}}
	for rows.Next() {
		var (
			c        CategoryTotal
			category sql.NullString
		)
		if err := rows.Scan(&category, &c.Amount); err != nil {
			return CategoryStats{}, err
		}
		if category.Valid {
			c.Category = &category.String
		}
		stats.Total += c.Amount
		stats.Items = append(stats.Items, c)
	}
	return stats, rows.Err()
}
