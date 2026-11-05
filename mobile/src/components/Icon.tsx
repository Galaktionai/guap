import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  CreditCard,
  Ellipsis,
  Gamepad2,
  Gift,
  HeartPulse,
  History,
  House,
  type LucideIcon,
  Minus,
  PiggyBank,
  Plus,
  Shirt,
  ShoppingCart,
  Smartphone,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react-native';

import { colors } from '../theme';

// Icon names match the components in the Figma file (Icon/<name>).
const ICONS = {
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  trash: Trash2,
  house: House,
  history: History,
  'arrow-down-left': ArrowDownLeft,
  'arrow-up-right': ArrowUpRight,
  wallet: Wallet,
  'credit-card': CreditCard,
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  calendar: Calendar,
  'more-horizontal': Ellipsis,
  'shopping-cart': ShoppingCart,
  coffee: Coffee,
  car: Car,
  'heart-pulse': HeartPulse,
  gamepad: Gamepad2,
  shirt: Shirt,
  smartphone: Smartphone,
  gift: Gift,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, color = colors.textPrimary }: { name: IconName; size?: number; color?: string }) {
  const Component = ICONS[name];
  // flexShrink: 0 keeps icons from being squeezed by long labels in a row.
  return <Component size={size} color={color} strokeWidth={2} style={{ flexShrink: 0 }} />;
}
