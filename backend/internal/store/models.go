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
	case TypeExpense, TypeIncome:
		if t.Category == nil {
			errs["category"] = "Выберите категорию"
		} else if c, ok := FindCategory(*t.Category); !ok {
			errs["category"] = "Неизвестная категория"
		} else if c.Type != t.Type {
			errs["category"] = "Эта категория не подходит для " + map[string]string{TypeIncome: "пополнения", TypeExpense: "расхода"}[t.Type]
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

// Category is an expense or income category. Expense and income categories
// are separate lists; ids are unique across both.
type Category struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

// Categories lists expense categories, then income ones, in display order.
var Categories = []Category{
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

// FindCategory returns the category with the given id.
func FindCategory(id string) (Category, bool) {
	i := slices.IndexFunc(Categories, func(c Category) bool { return c.ID == id })
	if i < 0 {
		return Category{}, false
	}
	return Categories[i], true
}

// IsCategory reports whether id is a known category of either type.
func IsCategory(id string) bool {
	_, ok := FindCategory(id)
	return ok
}
