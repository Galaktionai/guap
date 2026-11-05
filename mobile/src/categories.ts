import type { IconName } from './components/Icon';
import type { Tint } from './theme';

// Mirrors store.Categories in the Go backend (the server validates ids).
export const CATEGORIES = [
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
] as const satisfies readonly { id: string; name: string; icon: IconName; tint: Tint }[];

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export type CategoryMeta = (typeof CATEGORIES)[number];

const OTHER = CATEGORIES[CATEGORIES.length - 1];

export function categoryMeta(id: string | null | undefined): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id) ?? OTHER;
}

// Asset appearance options; mirror store.AssetIcons / store.AssetColors.
export const ASSET_ICONS = ['credit-card', 'wallet', 'piggy-bank', 'trending-up', 'banknote'] as const satisfies readonly IconName[];
export const ASSET_COLORS = ['blue', 'green', 'orange', 'teal', 'red'] as const satisfies readonly Tint[];

export type AssetIcon = (typeof ASSET_ICONS)[number];
export type AssetColor = (typeof ASSET_COLORS)[number];
