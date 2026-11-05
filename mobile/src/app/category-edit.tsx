import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, type Category, type TxType } from '@/api';
import { CATEGORY_COLORS, CATEGORY_ICONS, categoryLook } from '@/categories';
import { Icon, type IconName, isIconName } from '@/components/Icon';
import { inputStyle, Sheet } from '@/components/Sheet';
import {
  Button,
  CategoryBadge,
  confirmDelete,
  EmptyView,
  FieldError,
  FieldLabel,
  LoadingView,
  T,
} from '@/components/ui';
import { countLabel } from '@/format';
import { goBack } from '@/navigation';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/queries';
import { colors, radius, space, type Tint, tints } from '@/theme';

/** /category-edit?id=… edits a category, /category-edit?type=expense|income creates one. */
export default function CategoryEditSheet() {
  const params = useLocalSearchParams<{ id?: string; type?: string }>();
  const categories = useCategories();

  if (!params.id) {
    return <CategoryForm type={params.type === 'income' ? 'income' : 'expense'} />;
  }
  if (categories.isPending) return <LoadingView />;
  const category = categories.data?.find((c) => c.id === params.id);
  if (!category) {
    return (
      <Sheet title="Категория" footer={<Button label="Закрыть" variant="neutral" onPress={goBack} />}>
        <EmptyView icon="tags" title="Категория не найдена" text="Возможно, её уже удалили." />
      </Sheet>
    );
  }
  // key: start from fresh state if another category is opened in place.
  return <CategoryForm key={category.id} type={category.type} category={category} />;
}

function CategoryForm({ type, category }: { type: TxType; category?: Category }) {
  const save = useSaveCategory();
  const remove = useDeleteCategory();

  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState<IconName>(category && isIconName(category.icon) ? category.icon : 'more-horizontal');
  const [color, setColor] = useState<Tint>(category ? categoryLook(category).tint : 'blue');

  const fields = save.error instanceof ApiError ? save.error.fields : {};
  const canSave = name.trim().length > 0;
  const kind = type === 'expense' ? 'расхода' : 'пополнения';

  const onSave = () =>
    save.mutate({ id: category?.id, type, input: { name: name.trim(), icon, color } }, { onSuccess: goBack });

  const onDelete = () => {
    if (!category) return;
    confirmDelete(
      `Удалить «${category.name}»?`,
      category.transactions_count > 0
        ? `${countLabel(category.transactions_count, ['операция', 'операции', 'операций'])} останутся без категории.`
        : 'Операций в этой категории нет.',
      () => remove.mutate(category.id, { onSuccess: goBack }),
    );
  };

  return (
    <Sheet
      title={category ? 'Категория' : `Новая категория ${kind}`}
      footer={
        <View style={{ gap: space.sm }}>
          {save.error && !Object.keys(fields).length && <FieldError message={save.error.message} />}
          {remove.error && <FieldError message={remove.error.message} />}
          <Button
            label={category ? 'Сохранить' : 'Создать категорию'}
            onPress={onSave}
            disabled={!canSave}
            loading={save.isPending}
          />
          {category && (
            <Button label="Удалить категорию" icon="trash" variant="expense" onPress={onDelete} loading={remove.isPending} />
          )}
        </View>
      }
    >
      <View style={styles.preview}>
        <CategoryBadge category={{ id: null, name, icon, tint: color }} size={64} />
        <T variant="headline" numberOfLines={1}>
          {name.trim() || 'Название'}
        </T>
        <T variant="footnote" color={colors.textSecondary}>
          {type === 'expense' ? 'Категория расходов' : 'Категория пополнений'}
        </T>
      </View>

      <View>
        <FieldLabel>Название</FieldLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={type === 'expense' ? 'Например, «Питомцы»' : 'Например, «Стипендия»'}
          placeholderTextColor={colors.textTertiary}
          maxLength={32}
          autoFocus={!category}
          returnKeyType="done"
          style={inputStyle}
        />
        <FieldError message={fields.name} />
      </View>

      <View>
        <FieldLabel>Цвет</FieldLabel>
        <View style={styles.colors}>
          {CATEGORY_COLORS.map((c) => {
            const selected = c === color;
            return (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={c}
                onPress={() => setColor(c)}
                style={[styles.colorRing, selected && { borderColor: tints[c].soft }]}
              >
                <View style={[styles.colorDot, { backgroundColor: tints[c].strong }]}>
                  {selected && <Icon name="check" size={18} color={colors.onAccent} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <FieldError message={fields.color} />
      </View>

      <View>
        <FieldLabel>Иконка</FieldLabel>
        <View style={styles.icons}>
          {CATEGORY_ICONS.map((i) => {
            const selected = i === icon;
            const t = tints[color];
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={i}
                onPress={() => setIcon(i)}
                style={[
                  styles.iconOption,
                  { backgroundColor: selected ? t.soft : colors.muted, borderColor: selected ? t.strong : 'transparent' },
                ]}
              >
                <Icon name={i} size={22} color={selected ? t.strong : colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
        <FieldError message={fields.icon} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  colorRing: { borderWidth: 3, borderColor: 'transparent', borderRadius: 26 },
  colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
