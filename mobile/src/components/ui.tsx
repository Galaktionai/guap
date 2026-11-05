import { type ReactNode, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import type { Asset, Transaction } from '../api';
import { type CategoryLook, findCategory } from '../categories';
import { countLabel, formatMoney, formatTxAmount, timeLabel } from '../format';
import { useCategories } from '../queries';
import { colors, radius, space, type Tint, tints, typography, type TypographyVariant } from '../theme';
import { Icon, type IconName } from './Icon';

// ---------- Text ----------

export function T({
  variant = 'body',
  color = colors.textPrimary,
  numeric,
  style,
  ...rest
}: TextProps & { variant?: TypographyVariant; color?: string; numeric?: boolean }) {
  return (
    <Text
      {...rest}
      style={[typography[variant], { color }, numeric && { fontVariant: ['tabular-nums'] }, style]}
    />
  );
}

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'income' | 'expense' | 'danger' | 'neutral';

const buttonColors: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.accentStrong, fg: colors.onAccent },
  secondary: { bg: colors.accentSoft, fg: colors.accent },
  income: { bg: colors.incomeSoft, fg: colors.income },
  expense: { bg: colors.expenseSoft, fg: colors.expense },
  danger: { bg: colors.expense, fg: colors.onAccent },
  neutral: { bg: colors.muted, fg: colors.textPrimary },
};

export function Button({
  label,
  icon,
  variant = 'primary',
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  icon?: IconName;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = buttonColors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={20} color={c.fg} />}
          <T variant="headline" color={c.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = colors.textPrimary,
  background = colors.surface,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress?: () => void;
  color?: string;
  background?: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: background, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}

// ---------- Badges ----------

export function Badge({
  icon,
  tint,
  size = 40,
  shape = 'circle',
}: {
  icon: IconName;
  tint: Tint;
  size?: number;
  shape?: 'circle' | 'tile';
}) {
  const t = tints[tint];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'circle' ? size / 2 : size * 0.32,
        backgroundColor: t.soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={t.strong} />
    </View>
  );
}

export function CategoryBadge({ category, size = 40 }: { category: CategoryLook; size?: number }) {
  return <Badge icon={category.icon} tint={category.tint} size={size} />;
}

function TransactionBadge({ tx, category }: { tx: Transaction; category: CategoryLook }) {
  if (tx.category || tx.type === 'expense') return <CategoryBadge category={category} />;
  // Opening balances (and income saved before income categories existed).
  return (
    <View style={[styles.round40, { backgroundColor: colors.incomeSoft }]}>
      <Icon name="arrow-down-left" size={20} color={colors.income} />
    </View>
  );
}

// ---------- Layout pieces ----------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="titleMedium">{title}</T>
      {action && (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction} style={styles.sectionAction}>
          <Icon name="plus" size={18} color={colors.accent} />
          <T variant="subhead" color={colors.accent}>
            {action}
          </T>
        </Pressable>
      )}
    </View>
  );
}

export function GroupLabel({ title, total }: { title: string; total?: string }) {
  return (
    <View style={styles.groupLabel}>
      <T variant="subhead" color={colors.textSecondary}>
        {title}
      </T>
      {total && (
        <T variant="footnote" color={colors.textTertiary} numeric>
          {total}
        </T>
      )}
    </View>
  );
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <T variant="subhead" color={selected ? colors.textPrimary : colors.textSecondary}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <T variant="footnote" color={colors.textSecondary} style={{ marginBottom: space.sm }}>
      {children}
    </T>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <T variant="footnote" color={colors.expense} style={{ marginTop: space.xs }}>
      {message}
    </T>
  );
}

// ---------- Rows ----------

export function AssetRow({ asset, onPress }: { asset: Asset; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.assetRow, pressed && { opacity: 0.7 }]}
    >
      <Badge icon={asset.icon} tint={asset.color} size={44} shape="tile" />
      <View style={styles.flex}>
        <T variant="headline" numberOfLines={1}>
          {asset.name}
        </T>
        <T variant="footnote" color={colors.textSecondary}>
          {countLabel(asset.transactions_count, ['операция', 'операции', 'операций'])}
        </T>
      </View>
      <T variant="headline" numeric color={asset.balance < 0 ? colors.expense : colors.textPrimary}>
        {formatMoney(asset.balance)}
      </T>
    </Pressable>
  );
}

/** Resolves category ids against the categories loaded from the server. */
export function useFindCategory() {
  const { data } = useCategories();
  return (id: string | null | undefined) => findCategory(data, id);
}

export function transactionTitle(tx: Transaction, category: CategoryLook): string {
  if (tx.is_initial) return 'Начальный баланс';
  if (tx.category || tx.type === 'expense') return category.name;
  return tx.comment || 'Пополнение';
}

/** True when the title is the category name, so the comment goes into the subtitle. */
function titleIsCategory(tx: Transaction): boolean {
  return !tx.is_initial && (tx.category !== null || tx.type === 'expense');
}

/**
 * One operation. `context` decides the subtitle: on an asset screen the asset
 * is obvious, in the history it is shown.
 */
export function TransactionRow({ tx, context }: { tx: Transaction; context: 'asset' | 'history' }) {
  const category = useFindCategory()(tx.category);
  const time = timeLabel(new Date(tx.occurred_at));
  const comment = titleIsCategory(tx) ? tx.comment : '';
  const parts = context === 'history' ? [comment, tx.asset_name, time] : [comment, time];
  return (
    <View style={styles.txRow}>
      <TransactionBadge tx={tx} category={category} />
      <View style={styles.flex}>
        <T variant="subhead" numberOfLines={1}>
          {transactionTitle(tx, category)}
        </T>
        <T variant="footnote" color={colors.textSecondary} numberOfLines={1}>
          {parts.filter(Boolean).join(' · ')}
        </T>
      </View>
      <T variant="headline" numeric color={tx.type === 'income' ? colors.income : colors.textPrimary}>
        {formatTxAmount(tx.type, tx.amount)}
      </T>
    </View>
  );
}

/** Swipe left to reveal "Удалить"; asks for confirmation before deleting. */
export function SwipeToDelete({
  children,
  confirmTitle,
  confirmMessage,
  onDelete,
}: {
  children: ReactNode;
  confirmTitle: string;
  confirmMessage?: string;
  onDelete: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  const ask = () =>
    confirmDelete(confirmTitle, confirmMessage, onDelete, () => ref.current?.close());
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(progress) => <DeleteAction progress={progress} onPress={ask} />}
    >
      <View style={{ backgroundColor: colors.surface }}>{children}</View>
    </ReanimatedSwipeable>
  );
}

// Hidden until the row moves, so its edge never peeks out from under the row.
function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({ opacity: progress.value > 0.01 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.deleteAction, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Удалить" onPress={onPress} style={styles.deleteButton}>
        <Icon name="trash" size={20} color={colors.onAccent} />
        <T variant="caption" color={colors.onAccent}>
          Удалить
        </T>
      </Pressable>
    </Animated.View>
  );
}

export function confirmDelete(title: string, message: string | undefined, onConfirm: () => void, onCancel?: () => void) {
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel', onPress: onCancel },
    { text: 'Удалить', style: 'destructive', onPress: onConfirm },
  ]);
}

// ---------- States ----------

export function LoadingView() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <T variant="headline" style={{ textAlign: 'center' }}>
        Не удалось загрузить данные
      </T>
      <T variant="footnote" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: space.xs }}>
        {message}
      </T>
      {onRetry && <Button label="Повторить" variant="secondary" onPress={onRetry} style={{ marginTop: space.lg }} />}
    </View>
  );
}

export function EmptyView({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.round56, { backgroundColor: colors.muted }]}>
        <Icon name={icon} size={26} color={colors.textSecondary} />
      </View>
      <T variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {text && (
        <T variant="footnote" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          {text}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  button: {
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  round40: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  round56: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.xs, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  groupLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.md, padding: 3, gap: 2 },
  segment: { flex: 1, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: {
    backgroundColor: colors.surface,
    shadowColor: '#0F1115',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  deleteAction: { width: 88, backgroundColor: colors.expense },
  deleteButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl, paddingHorizontal: space.xxl },
});
