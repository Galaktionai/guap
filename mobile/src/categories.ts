import type { Category, TxType } from './api';
import { type IconName, isIconName } from './components/Icon';
import { type Tint, tints } from './theme';

// Categories live on the server and are editable; these are the appearance
// options. They mirror store.CategoryIcons / store.CategoryColors.
export const CATEGORY_ICONS = [
  'shopping-cart', 'coffee', 'utensils', 'car', 'bus', 'fuel', 'plane', 'house', 'zap',
  'heart-pulse', 'pill', 'dumbbell', 'gamepad', 'film', 'music', 'book-open', 'graduation-cap',
  'shirt', 'scissors', 'smartphone', 'wifi', 'gift', 'baby', 'paw-print', 'wrench',
  'briefcase', 'laptop', 'arrow-left-right', 'percent', 'trending-up', 'rotate-ccw',
  'piggy-bank', 'wallet', 'banknote', 'credit-card', 'sparkles', 'more-horizontal',
] as const satisfies readonly IconName[];

export const CATEGORY_COLORS = [
  'blue', 'green', 'orange', 'teal', 'red', 'yellow', 'pink', 'purple', 'indigo', 'gray',
] as const satisfies readonly Tint[];

/** What a row or chart needs to draw a category. */
export type CategoryLook = { id: string | null; name: string; icon: IconName; tint: Tint };

/** Shown for transactions whose category was deleted. */
export const UNCATEGORIZED: CategoryLook = { id: null, name: 'Без категории', icon: 'more-horizontal', tint: 'gray' };

export function categoryLook(c: Pick<Category, 'id' | 'name' | 'icon' | 'color'>): CategoryLook {
  return {
    id: c.id,
    name: c.name,
    // Fall back gracefully if the server knows an icon or color this build does not.
    icon: isIconName(c.icon) ? c.icon : 'more-horizontal',
    tint: c.color in tints ? (c.color as Tint) : 'gray',
  };
}

/** Finds a category by id; null or deleted ids give UNCATEGORIZED. */
export function findCategory(list: Category[] | undefined, id: string | null | undefined): CategoryLook {
  const c = id ? list?.find((x) => x.id === id) : undefined;
  return c ? categoryLook(c) : UNCATEGORIZED;
}

export function categoriesOfType(list: Category[] | undefined, type: TxType): Category[] {
  return (list ?? []).filter((c) => c.type === type);
}

// Asset appearance options; mirror store.AssetIcons / store.AssetColors.
export const ASSET_ICONS = ['credit-card', 'wallet', 'piggy-bank', 'trending-up', 'banknote'] as const satisfies readonly IconName[];
export const ASSET_COLORS = ['blue', 'green', 'orange', 'teal', 'red'] as const satisfies readonly Tint[];

export type AssetIcon = (typeof ASSET_ICONS)[number];
export type AssetColor = (typeof ASSET_COLORS)[number];
