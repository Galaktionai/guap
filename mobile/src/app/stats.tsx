import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { categoryMeta } from '@/categories';
import type { TxType } from '@/api';
import { CategoryBadge, EmptyView, ErrorView, IconButton, LoadingView, SegmentedControl, T } from '@/components/ui';
import { addMonths, formatMoney, inMonth, monthRange, monthTitle, sameMonth } from '@/format';
import { goBack } from '@/navigation';
import { useCategoryStats } from '@/queries';
import { colors, radius, space, tints } from '@/theme';

export default function StatsScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<TxType>(params.type === 'income' ? 'income' : 'expense');
  const income = type === 'income';
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => addMonths(today, 0));

  const range = useMemo(() => monthRange(month), [month]);
  const prevRange = useMemo(() => monthRange(addMonths(month, -1)), [month]);
  const stats = useCategoryStats(range, type);
  const prev = useCategoryStats(prevRange, type);

  const isCurrent = sameMonth(month, today);

  let body;
  if (stats.isPending) body = <LoadingView />;
  else if (stats.error) body = <ErrorView message={stats.error.message} onRetry={() => stats.refetch()} />;
  else if (stats.data.total === 0)
    body = (
      <EmptyView
        icon={income ? 'briefcase' : 'shopping-cart'}
        title={income ? 'Пополнений нет' : 'Расходов нет'}
        text={`${inMonth(month).replace('в', 'В')} ${income ? 'пополнений не было' : 'вы ничего не тратили'}.`}
      />
    );
  else {
    const { total, items } = stats.data;
    const max = items[0]?.amount ?? 1;
    const prevTotal = prev.data?.total ?? 0;
    const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    // Spending less is good news; earning less is not.
    const deltaIsGood = delta !== null && (income ? delta > 0 : delta < 0);

    body = (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.donutCard}>
          <Donut
            size={184}
            segments={items.map((i) => ({ value: i.amount, color: tints[categoryMeta(i.category, type).tint].strong }))}
          >
            <T variant="footnote" color={colors.textSecondary}>
              Всего
            </T>
            <T variant="titleMedium" numeric>
              {formatMoney(total)}
            </T>
          </Donut>
          {delta !== null && delta !== 0 && (
            <T variant="footnote" color={deltaIsGood ? colors.income : colors.expense}>
              {delta < 0 ? `На ${-delta}% меньше` : `На ${delta}% больше`}, чем {inMonth(addMonths(month, -1))}
            </T>
          )}
        </View>

        <View style={styles.list}>
          {items.map((i) => {
            const meta = categoryMeta(i.category, type);
            const percent = (i.amount / total) * 100;
            const share = percent > 0 && percent < 1 ? '<1' : String(Math.round(percent));
            return (
              <View key={i.category} style={styles.row}>
                <CategoryBadge category={meta} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <View style={styles.rowTop}>
                    <T variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
                      {meta.name}
                    </T>
                    <T variant="headline" numeric>
                      {formatMoney(i.amount)}
                    </T>
                  </View>
                  <View style={styles.rowBottom}>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.bar,
                          { width: `${Math.max(3, (i.amount / max) * 100)}%`, backgroundColor: tints[meta.tint].strong },
                        ]}
                      />
                    </View>
                    <T variant="footnote" color={colors.textSecondary} numeric style={styles.share}>
                      {share}%
                    </T>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <IconButton icon="chevron-left" accessibilityLabel="Назад" onPress={goBack} />
        <T variant="headline">По категориям</T>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.typeSwitch}>
        <SegmentedControl
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Пополнения' },
          ]}
        />
      </View>
      <View style={styles.period}>
        <IconButton
          icon="chevron-left"
          background={colors.muted}
          accessibilityLabel="Предыдущий месяц"
          onPress={() => setMonth((m) => addMonths(m, -1))}
        />
        <T variant="headline">{monthTitle(month)}</T>
        <IconButton
          icon="chevron-right"
          background={colors.muted}
          color={isCurrent ? colors.textTertiary : colors.textPrimary}
          accessibilityLabel="Следующий месяц"
          onPress={() => !isCurrent && setMonth((m) => addMonths(m, 1))}
        />
      </View>
      {body}
    </SafeAreaView>
  );
}

/** Ring chart: one arc per segment, starting at 12 o'clock. */
function Donut({
  size,
  segments,
  children,
}: {
  size: number;
  segments: { value: number; color: string }[];
  children: ReactNode;
}) {
  const stroke = Math.round(size * 0.13);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const gap = segments.length > 1 ? 3 : 0;

  // Each arc starts where the previous ones end.
  const lengths = segments.map((s) => (s.value / total) * c);
  const arcs = segments.map((s, i) => ({
    color: s.color,
    length: lengths[i],
    start: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {arcs.map((a, i) => (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(a.length - gap, 0.5)} ${c}`}
            strokeDashoffset={-a.start}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </Svg>
      <View style={{ alignItems: 'center', gap: 2 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  nav: {
    height: 56,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  period: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeSwitch: { paddingHorizontal: space.lg, paddingTop: space.xs },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  donutCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
  },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  share: { width: 36, textAlign: 'right' },
});
