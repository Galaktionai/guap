import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Card,
  confirmDelete,
  EmptyView,
  ErrorView,
  GroupLabel,
  IconButton,
  LoadingView,
  SwipeToDelete,
  T,
  TransactionRow,
  transactionTitle,
} from '@/components/ui';
import { countLabel, dayLabel, formatMoney, formatTxAmount, groupByDay, inMonth, sameMonth } from '@/format';
import { goBack } from '@/navigation';
import { useAsset, useDeleteAsset, useDeleteTransaction, useTransactions } from '@/queries';
import { colors, radius, space } from '@/theme';

export default function AssetScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const assetId = Number(id);

  const asset = useAsset(assetId);
  const txs = useTransactions({ asset_id: assetId, limit: 200 });
  const deleteAsset = useDeleteAsset();
  const deleteTx = useDeleteTransaction();

  const now = useMemo(() => new Date(), []);
  const monthFlow = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txs.data ?? []) {
      if (t.is_initial || !sameMonth(new Date(t.occurred_at), now)) continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense };
  }, [txs.data, now]);

  const groups = useMemo(() => groupByDay(txs.data ?? [], (t) => new Date(t.occurred_at)), [txs.data]);

  const onDeleteAsset = () => {
    const a = asset.data;
    if (!a) return;
    confirmDelete(
      `Удалить «${a.name}»?`,
      `Баланс ${formatMoney(a.balance)} и ${countLabel(a.transactions_count, ['операция', 'операции', 'операций'])} будут удалены. Это действие нельзя отменить.`,
      () => deleteAsset.mutate(a.id, { onSuccess: goBack }),
    );
  };

  const refresh = async () => {
    await Promise.all([asset.refetch(), txs.refetch()]);
  };

  let body;
  if (asset.isPending || txs.isPending) body = <LoadingView />;
  else if (asset.error || txs.error)
    body = (
      <ErrorView
        message={(asset.error ?? txs.error)!.message}
        onRetry={refresh}
      />
    );
  else {
    const a = asset.data;
    body = (
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={asset.isRefetching || txs.isRefetching}
            onRefresh={refresh}
          />
        }
      >
        <View style={styles.balanceCard}>
          <Badge icon={a.icon} tint={a.color} size={56} shape="tile" />
          <View style={{ alignItems: 'center', gap: space.xs }}>
            <T variant="footnote" color={colors.textSecondary}>
              Баланс
            </T>
            <T
              variant="display"
              numeric
              adjustsFontSizeToFit
              numberOfLines={1}
              color={a.balance < 0 ? colors.expense : colors.textPrimary}
            >
              {formatMoney(a.balance)}
            </T>
            {(monthFlow.income > 0 || monthFlow.expense > 0) && (
              <View style={styles.flows}>
                <T variant="footnote" color={colors.textSecondary}>
                  {inMonth(now)}
                </T>
                <T variant="subhead" color={colors.income} numeric>
                  ↓ {formatMoney(monthFlow.income, { sign: true })}
                </T>
                <T variant="subhead" color={colors.expense} numeric>
                  ↑ {formatMoney(-monthFlow.expense)}
                </T>
              </View>
            )}
          </View>
          <View style={styles.actions}>
            <Button
              label="Пополнить"
              icon="plus"
              variant="income"
              style={styles.flex}
              onPress={() => router.push({ pathname: '/new-transaction', params: { assetId: a.id, type: 'income' } })}
            />
            <Button
              label="Расход"
              icon="minus"
              variant="expense"
              style={styles.flex}
              onPress={() => router.push({ pathname: '/new-transaction', params: { assetId: a.id, type: 'expense' } })}
            />
          </View>
        </View>

        <View style={{ gap: space.md }}>
          <T variant="titleMedium">Операции</T>
          {groups.length === 0 ? (
            <EmptyView icon="history" title="Операций пока нет" />
          ) : (
            groups.map((g) => (
              <View key={g.key} style={{ gap: space.sm }}>
                <GroupLabel
                  title={dayLabel(g.date)}
                  total={formatMoney(
                    g.items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
                    { sign: true },
                  )}
                />
                <Card>
                  {g.items.map((t) => (
                    <SwipeToDelete
                      key={t.id}
                      confirmTitle="Удалить операцию?"
                      confirmMessage={`${transactionTitle(t)}, ${formatTxAmount(t.type, t.amount)}`}
                      onDelete={() => deleteTx.mutate(t.id)}
                    >
                      <TransactionRow tx={t} context="asset" />
                    </SwipeToDelete>
                  ))}
                </Card>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <IconButton icon="chevron-left" accessibilityLabel="Назад" onPress={goBack} />
        <T variant="headline" numberOfLines={1} style={styles.title}>
          {asset.data?.name ?? ''}
        </T>
        <IconButton
          icon="trash"
          color={colors.expense}
          accessibilityLabel="Удалить актив"
          onPress={onDeleteAsset}
        />
      </View>
      {body}
    </SafeAreaView>
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
    gap: space.md,
  },
  title: { flex: 1, textAlign: 'center' },
  content: { padding: space.lg, paddingTop: space.sm, gap: space.xxl, paddingBottom: space.xxxl },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.lg,
  },
  flows: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', gap: space.md, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
