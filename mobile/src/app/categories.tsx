import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { TxType } from '@/api';
import { categoriesOfType, categoryLook } from '@/categories';
import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  CategoryBadge,
  EmptyView,
  ErrorView,
  IconButton,
  LoadingView,
  SegmentedControl,
  SwipeToDelete,
  T,
} from '@/components/ui';
import { countLabel } from '@/format';
import { goBack } from '@/navigation';
import { useCategories, useDeleteCategory } from '@/queries';
import { colors, space } from '@/theme';

const OPERATIONS: [string, string, string] = ['операция', 'операции', 'операций'];

export default function CategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<TxType>(params.type === 'income' ? 'income' : 'expense');
  const categories = useCategories();
  const remove = useDeleteCategory();

  let body;
  if (categories.isPending) body = <LoadingView />;
  else if (categories.error)
    body = <ErrorView message={categories.error.message} onRetry={() => categories.refetch()} />;
  else {
    const list = categoriesOfType(categories.data, type);
    body = (
      <ScrollView contentContainerStyle={styles.content}>
        {list.length === 0 ? (
          <EmptyView icon="tags" title="Категорий нет" text="Добавьте первую категорию кнопкой ниже." />
        ) : (
          <Card>
            {list.map((c) => (
              <SwipeToDelete
                key={c.id}
                confirmTitle={`Удалить «${c.name}»?`}
                confirmMessage={
                  c.transactions_count > 0
                    ? `${countLabel(c.transactions_count, OPERATIONS)} останутся без категории.`
                    : 'Операций в этой категории нет.'
                }
                onDelete={() => remove.mutate(c.id)}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Открывает редактирование категории"
                  onPress={() => router.push({ pathname: '/category-edit', params: { id: c.id } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                >
                  <CategoryBadge category={categoryLook(c)} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="subhead" numberOfLines={1}>
                      {c.name}
                    </T>
                    <T variant="footnote" color={colors.textSecondary}>
                      {c.transactions_count > 0 ? countLabel(c.transactions_count, OPERATIONS) : 'Нет операций'}
                    </T>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.textTertiary} />
                </Pressable>
              </SwipeToDelete>
            ))}
          </Card>
        )}
        {list.length > 0 && (
          <T variant="footnote" color={colors.textTertiary} style={styles.hint}>
            Нажмите на категорию, чтобы изменить её, или смахните влево, чтобы удалить. Операции удалённой категории
            сохранятся без категории.
          </T>
        )}
        {remove.error && (
          <T variant="footnote" color={colors.expense} style={styles.hint}>
            {remove.error.message}
          </T>
        )}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <IconButton icon="chevron-left" accessibilityLabel="Назад" onPress={goBack} />
        <T variant="headline">Категории</T>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.switch}>
        <SegmentedControl
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Пополнения' },
          ]}
        />
      </View>
      {body}
      <View style={styles.footer}>
        <Button
          label="Добавить категорию"
          icon="plus"
          variant="secondary"
          onPress={() => router.push({ pathname: '/category-edit', params: { type } })}
        />
      </View>
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
  },
  switch: { paddingHorizontal: space.lg, paddingTop: space.xs },
  content: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  hint: { paddingHorizontal: space.xs },
  footer: { paddingHorizontal: space.lg, paddingVertical: space.sm },
});
