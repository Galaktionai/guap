package store

import (
	"context"
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

// Summary returns the total balance across all assets and the income and
// expense totals within r.
func (s *Store) Summary(ctx context.Context, r Range) (Summary, error) {
	var sum Summary
	err := s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*) FROM assets),
			COALESCE(SUM(CASE type WHEN 'income' THEN amount ELSE -amount END), 0)
		FROM transactions`).Scan(&sum.AssetsCount, &sum.TotalBalance)
	if err != nil {
		return Summary{}, fmt.Errorf("total balance: %w", err)
	}

	rangeSQL, args := r.where("occurred_at")
	err = s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN type = 'income' AND is_initial = 0 THEN amount END), 0),
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)
		FROM transactions
		WHERE 1 = 1`+rangeSQL, args...).Scan(&sum.Income, &sum.Expense)
	if err != nil {
		return Summary{}, fmt.Errorf("period totals: %w", err)
	}
	return sum, nil
}

// CategoryTotal is the amount spent in one category.
type CategoryTotal struct {
	Category string `json:"category"`
	Amount   int64  `json:"amount"`
}

// CategoryStats is the expense breakdown for a period, largest first.
type CategoryStats struct {
	Total int64           `json:"total"`
	Items []CategoryTotal `json:"items"`
}

// CategoryStats sums expenses within r by category.
func (s *Store) CategoryStats(ctx context.Context, r Range) (CategoryStats, error) {
	rangeSQL, args := r.where("occurred_at")
	rows, err := s.db.QueryContext(ctx, `
		SELECT COALESCE(category, 'other'), SUM(amount)
		FROM transactions
		WHERE type = 'expense'`+rangeSQL+`
		GROUP BY 1
		ORDER BY 2 DESC, 1`, args...)
	if err != nil {
		return CategoryStats{}, fmt.Errorf("category stats: %w", err)
	}
	defer rows.Close()

	stats := CategoryStats{Items: []CategoryTotal{}}
	for rows.Next() {
		var c CategoryTotal
		if err := rows.Scan(&c.Category, &c.Amount); err != nil {
			return CategoryStats{}, err
		}
		stats.Total += c.Amount
		stats.Items = append(stats.Items, c)
	}
	return stats, rows.Err()
}
