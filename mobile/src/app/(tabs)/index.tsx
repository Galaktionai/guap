import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { AssetRow, EmptyView, ErrorView, IconButton, LoadingView, SectionHeader, T } from '@/components/ui';
import { countLabel, formatMoney, monthRange, monthTitle } from '@/format';
import { useAssets, useSummary } from '@/queries';
import { colors, radius, space } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => monthRange(now), [now]);
  const summary = useSummary(range);
  const assets = useAssets();

  const refresh = async () => {
    await Promise.all([summary.refetch(), assets.refetch()]);
  };

  let body;
  if (summary.isPending || assets.isPending) {
    body = <LoadingView />;
  } else if (summary.error || assets.error) {
    body = <ErrorView message={(summary.error ?? assets.error)!.message} onRetry={refresh} />;
  } else {
    const s = summary.data;
    body = (
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={summary.isRefetching || assets.isRefetching} onRefresh={refresh} />
        }
      >
        <View style={styles.hero}>
          <View style={{ gap: space.xs }}>
            <T variant="callout" color="rgba(255,255,255,0.8)">
              Общий бюджет
            </T>
            <T variant="display" color={colors.onAccent} numeric adjustsFontSizeToFit numberOfLines={1}>
              {formatMoney(s.total_balance)}
            </T>
            <T variant="footnote" color="rgba(255,255,255,0.7)">
              {countLabel(s.assets_count, ['актив', 'актива', 'активов'])}
            </T>
          </View>
          <View style={styles.stats}>
            <HeroStat
              kind="income"
              amount={s.income}
              onPress={() => router.push({ pathname: '/stats', params: { type: 'income' } })}
            />
            <HeroStat kind="expense" amount={s.expense} onPress={() => router.push('/stats')} />
          </View>
        </View>

        <View style={{ gap: space.md }}>
          <SectionHeader title="Активы" action="Добавить" onAction={() => router.push('/new-asset')} />
          {assets.data.length === 0 ? (
            <EmptyView
              icon="wallet"
              title="Пока нет активов"
              text="Добавьте карту, наличные или накопительный счёт, чтобы начать учёт."
            />
          ) : (
            <View style={{ gap: space.sm }}>
              {assets.data.map((a) => (
                <AssetRow key={a.id} asset={a} onPress={() => router.push(`/asset/${a.id}`)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="subhead" color={colors.textSecondary}>
            {monthTitle(now)}
          </T>
          <T variant="titleLarge">Мои финансы</T>
        </View>
        <View style={styles.headerActions}>
          <IconButton icon="tags" accessibilityLabel="Категории" onPress={() => router.push('/categories')} />
          <IconButton icon="user" accessibilityLabel="Аккаунт" onPress={() => router.push('/account')} />
        </View>
      </View>
      {body}
    </SafeAreaView>
  );
}

function HeroStat({ kind, amount, onPress }: { kind: 'income' | 'expense'; amount: number; onPress: () => void }) {
  const income = kind === 'income';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.statTop}>
        <View style={styles.statBadge}>
          <Icon name={income ? 'arrow-down-left' : 'arrow-up-right'} size={14} color={colors.onAccent} />
        </View>
        <T variant="footnote" color="rgba(255,255,255,0.8)">
          {income ? 'Пополнения' : 'Расходы'}
        </T>
      </View>
      <T variant="headline" color={colors.onAccent} numeric numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(income ? amount : -amount, { sign: true })}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
  headerActions: { flexDirection: 'row', gap: space.sm },
  content: { padding: space.lg, paddingTop: space.md, gap: space.xxl, paddingBottom: space.xxxl },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.lg,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, padding: space.md, gap: space.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
