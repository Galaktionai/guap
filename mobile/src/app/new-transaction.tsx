import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, type TxType } from '@/api';
import { categoriesOfType, categoryLook } from '@/categories';
import { Icon } from '@/components/Icon';
import { inputStyle, Sheet } from '@/components/Sheet';
import {
  Badge,
  Button,
  CategoryBadge,
  EmptyView,
  FieldError,
  FieldLabel,
  LoadingView,
  SegmentedControl,
  T,
} from '@/components/ui';
import { dateTimeLabel, formatAmountInput, formatMoney, parseAmount, sanitizeAmountInput } from '@/format';
import { goBack } from '@/navigation';
import { useAssets, useCategories, useCreateTransaction } from '@/queries';
import { colors, radius, space, typography } from '@/theme';

export default function NewTransactionSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string; type?: string }>();
  const assets = useAssets();
  const categories = useCategories();
  const create = useCreateTransaction();

  const [type, setType] = useState<TxType>(params.type === 'income' ? 'income' : 'expense');
  const [amountRaw, setAmountRaw] = useState('');
  // Expense and income have separate category lists; each keeps its own choice.
  const [categoryByType, setCategoryByType] = useState<Record<TxType, string | null>>({
    expense: null,
    income: null,
  });
  const [assetId, setAssetId] = useState<number | null>(params.assetId ? Number(params.assetId) : null);
  const [assetListOpen, setAssetListOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(() => new Date());

  if (assets.isPending) return <LoadingView />;
  if (assets.data?.length === 0 || assets.error) {
    return (
      <Sheet title="Новая операция" footer={<Button label="Добавить актив" onPress={() => router.replace('/new-asset')} />}>
        <EmptyView
          icon="wallet"
          title={assets.error ? 'Не удалось загрузить активы' : 'Сначала добавьте актив'}
          text={assets.error?.message ?? 'Операции записываются на карту, наличные или другой актив.'}
        />
      </Sheet>
    );
  }

  const list = assets.data ?? [];
  const selectedAsset = list.find((a) => a.id === assetId) ?? list[0];
  const amount = parseAmount(amountRaw);
  const typeCategories = categoriesOfType(categories.data, type);
  // The chosen category may have been deleted on the categories screen.
  const category = typeCategories.some((c) => c.id === categoryByType[type]) ? categoryByType[type] : null;
  const canSave = amount !== null && category !== null;
  const fields = create.error instanceof ApiError ? create.error.fields : {};

  const save = () => {
    if (!canSave || amount === null || category === null) return;
    create.mutate(
      {
        asset_id: selectedAsset.id,
        type,
        amount,
        category,
        comment: comment.trim(),
        occurred_at: date.toISOString(),
      },
      { onSuccess: goBack },
    );
  };

  const openAndroidPicker = () =>
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      maximumDate: new Date(),
      onChange: (_, d) => d && setDate(d),
    });

  return (
    <Sheet
      title="Новая операция"
      footer={
        <>
          {create.error && !Object.keys(fields).length && <FieldError message={create.error.message} />}
          <Button
            label={type === 'expense' ? 'Сохранить расход' : 'Сохранить пополнение'}
            onPress={save}
            disabled={!canSave}
            loading={create.isPending}
          />
        </>
      }
    >
      <SegmentedControl
        value={type}
        onChange={setType}
        options={[
          { value: 'expense', label: 'Расход' },
          { value: 'income', label: 'Пополнение' },
        ]}
      />

      <View style={styles.amount}>
        <T variant="footnote" color={colors.textSecondary}>
          Сумма
        </T>
        <View style={styles.amountRow}>
          {/* The hidden text sizes the box, so the field grows with the amount
              and stays centred next to "₽" on every platform. */}
          <View style={styles.amountBox}>
            <T variant="display" numeric style={styles.amountSizer} accessibilityElementsHidden>
              {formatAmountInput(amountRaw) || '0'}
            </T>
            <TextInput
              value={formatAmountInput(amountRaw)}
              onChangeText={(t) => setAmountRaw(sanitizeAmountInput(t))}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus
              accessibilityLabel="Сумма"
              style={styles.amountInput}
            />
          </View>
          <T variant="display" color={colors.textTertiary}>
            {' ₽'}
          </T>
        </View>
        <FieldError message={fields.amount} />
      </View>

      <View>
        <FieldLabel>{type === 'expense' ? 'Категория расхода' : 'Источник пополнения'}</FieldLabel>
        <ScrollView
          key={type}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {typeCategories.map((c) => {
            const selected = c.id === category;
            const look = categoryLook(c);
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={c.name}
                onPress={() => setCategoryByType((prev) => ({ ...prev, [type]: c.id }))}
                style={styles.chip}
              >
                <View style={[styles.ring, selected && { borderColor: colors.accent }]}>
                  <CategoryBadge category={look} size={52} />
                </View>
                <T
                  variant="caption"
                  color={selected ? colors.textPrimary : colors.textSecondary}
                  numberOfLines={1}
                  style={selected && { fontWeight: '600' }}
                >
                  {c.name}
                </T>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Настроить категории"
            onPress={() => router.push({ pathname: '/categories', params: { type } })}
            style={styles.chip}
          >
            <View style={styles.ring}>
              <View style={styles.manage}>
                <Icon name="tags" size={24} color={colors.textSecondary} />
              </View>
            </View>
            <T variant="caption" color={colors.textSecondary} numberOfLines={1}>
              Настроить
            </T>
          </Pressable>
        </ScrollView>
        {categories.error && <FieldError message={`Категории не загрузились: ${categories.error.message}`} />}
        <FieldError message={fields.category} />
      </View>

      <View>
        <FieldLabel>Актив</FieldLabel>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAssetListOpen((o) => !o)}
          style={[inputStyle, styles.select]}
        >
          <Badge icon={selectedAsset.icon} tint={selectedAsset.color} size={28} shape="tile" />
          <T variant="body" style={{ flex: 1 }} numberOfLines={1}>
            {selectedAsset.name}
          </T>
          <T variant="footnote" color={colors.textSecondary} numeric>
            {formatMoney(selectedAsset.balance)}
          </T>
          <Icon name={assetListOpen ? 'chevron-left' : 'chevron-right'} size={20} color={colors.textTertiary} />
        </Pressable>
        {assetListOpen && (
          <View style={styles.options}>
            {list.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: a.id === selectedAsset.id }}
                onPress={() => {
                  setAssetId(a.id);
                  setAssetListOpen(false);
                }}
                style={styles.option}
              >
                <Badge icon={a.icon} tint={a.color} size={28} shape="tile" />
                <T variant="body" style={{ flex: 1 }} numberOfLines={1}>
                  {a.name}
                </T>
                {a.id === selectedAsset.id && <Icon name="check" size={20} color={colors.accent} />}
              </Pressable>
            ))}
          </View>
        )}
        <FieldError message={fields.asset_id} />
      </View>

      <View>
        <FieldLabel>Комментарий</FieldLabel>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={type === 'expense' ? 'Например, «на неделю»' : 'Например, «аванс за ноябрь»'}
          placeholderTextColor={colors.textTertiary}
          maxLength={200}
          returnKeyType="done"
          style={inputStyle}
        />
        <FieldError message={fields.comment} />
      </View>

      <View>
        <FieldLabel>Дата</FieldLabel>
        {Platform.OS === 'ios' ? (
          <View style={[inputStyle, styles.select]}>
            <Icon name="calendar" size={20} color={colors.textTertiary} />
            <View style={{ flex: 1 }} />
            <DateTimePicker
              value={date}
              mode="datetime"
              display="compact"
              locale="ru-RU"
              maximumDate={new Date()}
              onChange={(_, d) => d && setDate(d)}
            />
          </View>
        ) : (
          <Pressable onPress={openAndroidPicker} style={[inputStyle, styles.select]}>
            <T variant="body" style={{ flex: 1 }}>
              {dateTimeLabel(date)}
            </T>
            <Icon name="calendar" size={20} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  amount: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  amountBox: { flexShrink: 1, minWidth: 24 },
  amountSizer: { opacity: 0, paddingRight: 4 },
  amountInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    ...typography.display,
    color: colors.textPrimary,
    width: '100%',
    padding: 0,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chips: { gap: 6, paddingRight: space.lg },
  chip: { width: 76, alignItems: 'center', gap: 6, paddingTop: 2 },
  ring: { borderWidth: 2.5, borderColor: 'transparent', borderRadius: 32, padding: 2 },
  manage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  select: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  options: { marginTop: space.sm, backgroundColor: colors.muted, borderRadius: radius.md, paddingVertical: space.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
