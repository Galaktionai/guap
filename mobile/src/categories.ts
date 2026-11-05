import type { TxType } from './api';
import type { IconName } from './components/Icon';
import type { Tint } from './theme';

type Meta = { id: string; name: string; icon: IconName; tint: Tint };

// Mirrors store.Categories in the Go backend (the server validates ids).
// Expense and income categories are separate lists with unique ids.
export const EXPENSE_CATEGORIES = [
  { id: 'groceries', name: 'Продукты', icon: 'shopping-cart', tint: 'orange' },
  { id: 'cafe', name: 'Кафе', icon: 'coffee', tint: 'yellow' },
  { id: 'transport', name: 'Транспорт', icon: 'car', tint: 'blue' },
  { id: 'home', name: 'Дом', icon: 'house', tint: 'teal' },
  { id: 'health', name: 'Здоровье', icon: 'heart-pulse', tint: 'red' },
  { id: 'entertainment', name: 'Развлечения', icon: 'gamepad', tint: 'purple' },
  { id: 'clothes', name: 'Одежда', icon: 'shirt', tint: 'pink' },
  { id: 'connection', name: 'Связь', icon: 'smartphone', tint: 'indigo' },
  { id: 'gifts', name: 'Подарки', icon: 'gift', tint: 'green' },
  { id: 'other', name: 'Другое', icon: 'more-horizontal', tint: 'gray' },
] as const satisfies readonly Meta[];

export const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Зарплата', icon: 'briefcase', tint: 'green' },
  { id: 'side_job', name: 'Подработка', icon: 'laptop', tint: 'blue' },
  { id: 'transfer_in', name: 'Перевод', icon: 'arrow-left-right', tint: 'teal' },
  { id: 'cashback', name: 'Кэшбэк', icon: 'percent', tint: 'orange' },
  { id: 'interest', name: 'Проценты', icon: 'trending-up', tint: 'indigo' },
  { id: 'gift_in', name: 'Подарок', icon: 'gift', tint: 'pink' },
  { id: 'refund', name: 'Возврат', icon: 'rotate-ccw', tint: 'yellow' },
  { id: 'other_income', name: 'Другое', icon: 'more-horizontal', tint: 'gray' },
] as const satisfies readonly Meta[];

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id'];
export type IncomeCategoryId = (typeof INCOME_CATEGORIES)[number]['id'];
export type CategoryId = ExpenseCategoryId | IncomeCategoryId;
export type CategoryMeta = (typeof EXPENSE_CATEGORIES)[number] | (typeof INCOME_CATEGORIES)[number];

export function categoriesFor(type: TxType): readonly CategoryMeta[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/** Category for display; unknown or missing ids fall back to "Другое" of that type. */
export function categoryMeta(id: string | null | undefined, type: TxType = 'expense'): CategoryMeta {
  const list = categoriesFor(type);
  return list.find((c) => c.id === id) ?? list[list.length - 1];
}

// Asset appearance options; mirror store.AssetIcons / store.AssetColors.
export const ASSET_ICONS = ['credit-card', 'wallet', 'piggy-bank', 'trending-up', 'banknote'] as const satisfies readonly IconName[];
export const ASSET_COLORS = ['blue', 'green', 'orange', 'teal', 'red'] as const satisfies readonly Tint[];

export type AssetIcon = (typeof ASSET_ICONS)[number];
export type AssetColor = (typeof ASSET_COLORS)[number];
