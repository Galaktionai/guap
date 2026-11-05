package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

// Category groups expenses or income. Users can add, edit and delete them;
// the type is fixed at creation so existing transactions stay consistent.
type Category struct {
	ID                string `json:"id"`
	Type              string `json:"type"`
	Name              string `json:"name"`
	Icon              string `json:"icon"`
	Color             string `json:"color"`
	TransactionsCount int64  `json:"transactions_count"`
}

// DefaultCategories are created with a new database, in display order.
var DefaultCategories = []Category{
	{ID: "groceries", Type: TypeExpense, Name: "Продукты", Icon: "shopping-cart", Color: "orange"},
	{ID: "cafe", Type: TypeExpense, Name: "Кафе", Icon: "coffee", Color: "yellow"},
	{ID: "transport", Type: TypeExpense, Name: "Транспорт", Icon: "car", Color: "blue"},
	{ID: "home", Type: TypeExpense, Name: "Дом", Icon: "house", Color: "teal"},
	{ID: "health", Type: TypeExpense, Name: "Здоровье", Icon: "heart-pulse", Color: "red"},
	{ID: "entertainment", Type: TypeExpense, Name: "Развлечения", Icon: "gamepad", Color: "purple"},
	{ID: "clothes", Type: TypeExpense, Name: "Одежда", Icon: "shirt", Color: "pink"},
	{ID: "connection", Type: TypeExpense, Name: "Связь", Icon: "smartphone", Color: "indigo"},
	{ID: "gifts", Type: TypeExpense, Name: "Подарки", Icon: "gift", Color: "green"},
	{ID: "other", Type: TypeExpense, Name: "Другое", Icon: "more-horizontal", Color: "gray"},

	{ID: "salary", Type: TypeIncome, Name: "Зарплата", Icon: "briefcase", Color: "green"},
	{ID: "side_job", Type: TypeIncome, Name: "Подработка", Icon: "laptop", Color: "blue"},
	{ID: "transfer_in", Type: TypeIncome, Name: "Перевод", Icon: "arrow-left-right", Color: "teal"},
	{ID: "cashback", Type: TypeIncome, Name: "Кэшбэк", Icon: "percent", Color: "orange"},
	{ID: "interest", Type: TypeIncome, Name: "Проценты", Icon: "trending-up", Color: "indigo"},
	{ID: "gift_in", Type: TypeIncome, Name: "Подарок", Icon: "gift", Color: "pink"},
	{ID: "refund", Type: TypeIncome, Name: "Возврат", Icon: "rotate-ccw", Color: "yellow"},
	{ID: "other_income", Type: TypeIncome, Name: "Другое", Icon: "more-horizontal", Color: "gray"},
}

// CategoryIcons and CategoryColors are the options offered by the app.
var (
	CategoryIcons = []string{
		"shopping-cart", "coffee", "utensils", "car", "bus", "fuel", "plane", "house", "zap",
		"heart-pulse", "pill", "dumbbell", "gamepad", "film", "music", "book-open", "graduation-cap",
		"shirt", "scissors", "smartphone", "wifi", "gift", "baby", "paw-print", "wrench",
		"briefcase", "laptop", "arrow-left-right", "percent", "trending-up", "rotate-ccw",
		"piggy-bank", "wallet", "banknote", "credit-card", "sparkles", "more-horizontal",
	}
	CategoryColors = []string{"blue", "green", "orange", "teal", "red", "yellow", "pink", "purple", "indigo", "gray"}
)

// CategoryInput is what the user can set on a category.
type CategoryInput struct {
	Name  string
	Icon  string
	Color string
}

// Validate returns field errors, or nil if the input is valid.
func (c CategoryInput) Validate() map[string]string {
	errs := map[string]string{}
	if n := utf8.RuneCountInString(c.Name); n == 0 {
		errs["name"] = "Введите название"
	} else if n > 32 {
		errs["name"] = "Название должно быть не длиннее 32 символов"
	}
	if !slices.Contains(CategoryIcons, c.Icon) {
		errs["icon"] = "Неизвестная иконка"
	}
	if !slices.Contains(CategoryColors, c.Color) {
		errs["color"] = "Неизвестный цвет"
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

const categorySelect = `
SELECT c.id, c.type, c.name, c.icon, c.color,
       (SELECT COUNT(*) FROM transactions t WHERE t.category = c.id)
FROM categories c`

func scanCategory(row scanner) (Category, error) {
	var c Category
	err := row.Scan(&c.ID, &c.Type, &c.Name, &c.Icon, &c.Color, &c.TransactionsCount)
	return c, err
}

// ListCategories returns the user's categories of txType ("" for all): expense first,
// each type in display order.
func (s *Store) ListCategories(ctx context.Context, userID int64, txType string) ([]Category, error) {
	q := categorySelect + " WHERE c.user_id = ?"
	args := []any{userID}
	if txType != "" {
		q += " AND c.type = ?"
		args = append(args, txType)
	}
	q += " ORDER BY CASE c.type WHEN 'expense' THEN 0 ELSE 1 END, c.position, c.created_at"
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}
	defer rows.Close()

	list := []Category{}
	for rows.Next() {
		c, err := scanCategory(rows)
		if err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

// GetCategory returns one of the user's categories.
func (s *Store) GetCategory(ctx context.Context, userID int64, id string) (Category, error) {
	c, err := scanCategory(s.db.QueryRowContext(ctx, categorySelect+" WHERE c.id = ? AND c.user_id = ?", id, userID))
	if errors.Is(err, sql.ErrNoRows) {
		return Category{}, ErrNotFound
	}
	if err != nil {
		return Category{}, fmt.Errorf("get category: %w", err)
	}
	return c, nil
}

// nameTaken reports whether another of the user's categories of txType has this
// name, ignoring case. The comparison is done in Go because SQLite's lower()
// only folds ASCII letters.
func nameTaken(ctx context.Context, tx *sql.Tx, userID int64, txType, name, exceptID string) (bool, error) {
	rows, err := tx.QueryContext(ctx, `SELECT id, name FROM categories WHERE user_id = ? AND type = ?`, userID, txType)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, n string
		if err := rows.Scan(&id, &n); err != nil {
			return false, err
		}
		if id != exceptID && strings.EqualFold(strings.TrimSpace(n), name) {
			return true, nil
		}
	}
	return false, rows.Err()
}

func newCategoryID() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "c_" + hex.EncodeToString(b), nil
}

// CreateCategory adds a category at the end of its type's list.
func (s *Store) CreateCategory(ctx context.Context, userID int64, txType string, in CategoryInput) (Category, error) {
	id, err := newCategoryID()
	if err != nil {
		return Category{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Category{}, err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	if taken, err := nameTaken(ctx, tx, userID, txType, in.Name, ""); err != nil {
		return Category{}, err
	} else if taken {
		return Category{}, ErrDuplicateCategory
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO categories (id, user_id, type, name, icon, color, position, created_at)
		VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM categories WHERE user_id = ? AND type = ?), ?)`,
		id, userID, txType, in.Name, in.Icon, in.Color, userID, txType, ms(time.Now()))
	if err != nil {
		return Category{}, fmt.Errorf("insert category: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Category{}, err
	}
	return s.GetCategory(ctx, userID, id)
}

// UpdateCategory changes a category's name, icon and color.
func (s *Store) UpdateCategory(ctx context.Context, userID int64, id string, in CategoryInput) (Category, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Category{}, err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	var txType string
	err = tx.QueryRowContext(ctx, `SELECT type FROM categories WHERE id = ? AND user_id = ?`, id, userID).Scan(&txType)
	if errors.Is(err, sql.ErrNoRows) {
		return Category{}, ErrNotFound
	}
	if err != nil {
		return Category{}, err
	}
	if taken, err := nameTaken(ctx, tx, userID, txType, in.Name, id); err != nil {
		return Category{}, err
	} else if taken {
		return Category{}, ErrDuplicateCategory
	}
	if _, err := tx.ExecContext(ctx, `UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?`,
		in.Name, in.Icon, in.Color, id, userID); err != nil {
		return Category{}, fmt.Errorf("update category: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Category{}, err
	}
	return s.GetCategory(ctx, userID, id)
}

// DeleteCategory deletes a category. Its transactions are kept and become
// uncategorized.
func (s *Store) DeleteCategory(ctx context.Context, userID int64, id string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	res, err := tx.ExecContext(ctx, `DELETE FROM categories WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return fmt.Errorf("delete category: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	if _, err := tx.ExecContext(ctx, `UPDATE transactions SET category = NULL WHERE category = ?`, id); err != nil {
		return fmt.Errorf("uncategorize transactions: %w", err)
	}
	return tx.Commit()
}
