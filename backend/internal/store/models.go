package store

import (
	"slices"
	"time"
	"unicode/utf8"
)

// Transaction types.
const (
	TypeIncome  = "income"
	TypeExpense = "expense"
)

// MaxAmount caps a single amount (in kopecks): 10 billion rubles.
const MaxAmount int64 = 1_000_000_000_000

// Asset is an account that holds money: a card, cash, savings, etc.
// Balance is derived from its transactions, in kopecks.
type Asset struct {
	ID                int64     `json:"id"`
	Name              string    `json:"name"`
	Icon              string    `json:"icon"`
	Color             string    `json:"color"`
	Balance           int64     `json:"balance"`
	TransactionsCount int64     `json:"transactions_count"`
	CreatedAt         time.Time `json:"created_at"`
}

// NewAsset is the input for creating an asset.
type NewAsset struct {
	Name           string
	Icon           string
	Color          string
	InitialBalance int64
}

// AssetIcons and AssetColors are the options offered by the app.
var (
	AssetIcons  = []string{"credit-card", "wallet", "piggy-bank", "trending-up", "banknote"}
	AssetColors = []string{"blue", "green", "orange", "teal", "red"}
)

// Validate returns field errors, or nil if the input is valid.
func (a NewAsset) Validate() map[string]string {
	errs := map[string]string{}
	if n := utf8.RuneCountInString(a.Name); n == 0 {
		errs["name"] = "Введите название"
	} else if n > 64 {
		errs["name"] = "Название должно быть не длиннее 64 символов"
	}
	if !slices.Contains(AssetIcons, a.Icon) {
		errs["icon"] = "Неизвестная иконка"
	}
	if !slices.Contains(AssetColors, a.Color) {
		errs["color"] = "Неизвестный цвет"
	}
	if a.InitialBalance < 0 || a.InitialBalance > MaxAmount {
		errs["initial_balance"] = "Начальный баланс должен быть от 0 до 10 млрд ₽"
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

// Transaction is a top-up (income) or an expense on an asset.
// IsInitial marks the opening balance entered when the asset was created;
// it counts toward the balance but not toward monthly income.
type Transaction struct {
	ID         int64     `json:"id"`
	AssetID    int64     `json:"asset_id"`
	AssetName  string    `json:"asset_name"`
	Type       string    `json:"type"`
	Amount     int64     `json:"amount"`
	Category   *string   `json:"category"`
	Comment    string    `json:"comment"`
	IsInitial  bool      `json:"is_initial"`
	OccurredAt time.Time `json:"occurred_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// NewTransaction is the input for creating a transaction.
type NewTransaction struct {
	AssetID    int64
	Type       string
	Amount     int64
	Category   *string
	Comment    string
	OccurredAt time.Time
}

// Validate returns field errors, or nil if the input is valid.
func (t NewTransaction) Validate() map[string]string {
	errs := map[string]string{}
	if t.AssetID <= 0 {
		errs["asset_id"] = "Выберите актив"
	}
	switch t.Type {
	case TypeExpense:
		if t.Category == nil || !IsCategory(*t.Category) {
			errs["category"] = "Выберите категорию"
		}
	case TypeIncome:
		if t.Category != nil {
			errs["category"] = "У пополнения нет категории"
		}
	default:
		errs["type"] = "Тип должен быть income или expense"
	}
	if t.Amount <= 0 || t.Amount > MaxAmount {
		errs["amount"] = "Сумма должна быть больше нуля и не больше 10 млрд ₽"
	}
	if utf8.RuneCountInString(t.Comment) > 200 {
		errs["comment"] = "Комментарий должен быть не длиннее 200 символов"
	}
	if t.OccurredAt.IsZero() {
		errs["occurred_at"] = "Укажите дату"
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

// Category is an expense category.
type Category struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

// Categories is the fixed list of expense categories, in display order.
var Categories = []Category{
	{ID: "groceries", Name: "Продукты", Icon: "shopping-cart", Color: "orange"},
	{ID: "cafe", Name: "Кафе", Icon: "coffee", Color: "yellow"},
	{ID: "transport", Name: "Транспорт", Icon: "car", Color: "blue"},
	{ID: "home", Name: "Дом", Icon: "house", Color: "teal"},
	{ID: "health", Name: "Здоровье", Icon: "heart-pulse", Color: "red"},
	{ID: "entertainment", Name: "Развлечения", Icon: "gamepad", Color: "purple"},
	{ID: "clothes", Name: "Одежда", Icon: "shirt", Color: "pink"},
	{ID: "connection", Name: "Связь", Icon: "smartphone", Color: "indigo"},
	{ID: "gifts", Name: "Подарки", Icon: "gift", Color: "green"},
	{ID: "other", Name: "Другое", Icon: "more-horizontal", Color: "gray"},
}

// IsCategory reports whether id is a known category.
func IsCategory(id string) bool {
	return slices.ContainsFunc(Categories, func(c Category) bool { return c.ID == id })
}
