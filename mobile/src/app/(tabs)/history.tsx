import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Transaction, TxType } from '@/api';
import {
  EmptyView,
  ErrorView,
  GroupLabel,
  LoadingView,
  SegmentedControl,
  SwipeToDelete,
  T,
  TransactionRow,
  transactionTitle,
} from '@/components/ui';
import { dayLabel, formatMoney, formatTxAmount, groupByDay, monthRange, monthTitle } from '@/format';
import { useDeleteTransaction, useSummary, useTransactions } from '@/queries';
import { colors, radius, space } from '@/theme';

type Filter = 'all' | TxType;

const HISTORY_LIMIT = 200;

export default function HistoryScreen() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => monthRange(now), [now]);
  const [filter, setFilter] = useState<Filter>('all');

  const summary = useSummary(range);
  const txs = useTransactions({ type: filter === 'all' ? undefined : filter, limit: HISTORY_LIMIT });
  const remove = useDeleteTransaction();

  const sections = useMemo(
    () =>
      groupByDay(txs.data ?? [], (t) => new Date(t.occurred_at)).map((g) => ({
        key: g.key,
        title: dayLabel(g.date),
        total: g.items.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0),
        data: g.items,
      })),
    [txs.data],
  );

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.sm }}>
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Все' },
          { value: 'income', label: 'Пополнения' },
          { value: 'expense', label: 'Расходы' },
        ]}
      />
      {summary.data && (
        <View style={styles.summary}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Открывает пополнения по категориям"
            onPress={() => router.push({ pathname: '/stats', params: { type: 'income' } })}
            style={({ pressed }) => [styles.summaryTile, pressed && { opacity: 0.7 }]}
          >
            <T variant="footnote" color={colors.textSecondary}>
              Пополнения
            </T>
            <T variant="headline" color={colors.income} numeric>
              {formatMoney(summary.data.income, { sign: true })}
            </T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Открывает расходы по категориям"
            onPress={() => router.push('/stats')}
            style={({ pressed }) => [styles.summaryTile, pressed && { opacity: 0.7 }]}
          >
            <T variant="footnote" color={colors.textSecondary}>
              Расходы
            </T>
            <T variant="headline" color={colors.expense} numeric>
              {formatMoney(-summary.data.expense)}
            </T>
          </Pressable>
        </View>
      )}
    </View>
  );

  let body;
  if (txs.isPending) body = <LoadingView />;
  else if (txs.error) body = <ErrorView message={txs.error.message} onRetry={() => txs.refetch()} />;
  else
    body = (
      <SectionList<Transaction, (typeof sections)[number]>
        sections={sections}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyView
            icon="history"
            title="Операций пока нет"
            text="Нажмите «+» внизу, чтобы добавить пополнение или расход."
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <GroupLabel title={section.title} total={formatMoney(section.total, { sign: true })} />
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              styles.rowWrap,
              index === 0 && styles.first,
              index === section.data.length - 1 && styles.last,
            ]}
          >
            <SwipeToDelete
              confirmTitle="Удалить операцию?"
              confirmMessage={`${transactionTitle(item)}, ${formatTxAmount(item.type, item.amount)}`}
              onDelete={() => remove.mutate(item.id)}
            >
              <TransactionRow tx={item} context="history" />
            </SwipeToDelete>
          </View>
        )}
        ListFooterComponent={
          (txs.data?.length ?? 0) >= HISTORY_LIMIT ? (
            <T variant="footnote" color={colors.textTertiary} style={styles.footer}>
              Показаны последние {HISTORY_LIMIT} операций
            </T>
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={txs.isRefetching || summary.isRefetching}
            onRefresh={async () => {
              await Promise.all([txs.refetch(), summary.refetch()]);
            }}
          />
        }
      />
    );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <T variant="subhead" color={colors.textSecondary}>
          {monthTitle(now)}
        </T>
        <T variant="titleLarge">История</T>
      </View>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.sm, gap: 2 },
  list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxxl },
  summary: { flexDirection: 'row', gap: space.md },
  summaryTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.xs,
  },
  sectionHeader: { paddingTop: space.lg, paddingBottom: space.sm },
  // Rows of one day form a single rounded card.
  rowWrap: { backgroundColor: colors.surface, overflow: 'hidden' },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space.xs },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, paddingBottom: space.xs },
  footer: { textAlign: 'center', marginTop: space.lg },
});
