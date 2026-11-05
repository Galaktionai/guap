import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '@/api';
import { ASSET_COLORS, ASSET_ICONS, type AssetColor, type AssetIcon } from '@/categories';
import { Icon } from '@/components/Icon';
import { inputStyle, Sheet } from '@/components/Sheet';
import { Button, FieldError, FieldLabel, T } from '@/components/ui';
import { formatAmountInput, parseAmount, sanitizeAmountInput } from '@/format';
import { useCreateAsset } from '@/queries';
import { colors, radius, space, tints } from '@/theme';

export default function NewAssetSheet() {
  const router = useRouter();
  const create = useCreateAsset();

  const [name, setName] = useState('');
  const [balanceRaw, setBalanceRaw] = useState('');
  const [icon, setIcon] = useState<AssetIcon>('credit-card');
  const [color, setColor] = useState<AssetColor>('blue');

  const fields = create.error instanceof ApiError ? create.error.fields : {};
  const canSave = name.trim().length > 0;

  const save = () =>
    create.mutate(
      { name: name.trim(), icon, color, initial_balance: parseAmount(balanceRaw) ?? 0 },
      { onSuccess: (asset) => router.replace(`/asset/${asset.id}`) },
    );

  return (
    <Sheet
      title="Новый актив"
      footer={
        <>
          {create.error && !Object.keys(fields).length && <FieldError message={create.error.message} />}
          <Button label="Создать актив" onPress={save} disabled={!canSave} loading={create.isPending} />
        </>
      }
    >
      <View>
        <FieldLabel>Название</FieldLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Например, «Основная карта»"
          placeholderTextColor={colors.textTertiary}
          maxLength={64}
          autoFocus
          style={inputStyle}
        />
        <FieldError message={fields.name} />
      </View>

      <View>
        <FieldLabel>Начальный баланс</FieldLabel>
        <View style={[inputStyle, styles.row]}>
          <TextInput
            value={formatAmountInput(balanceRaw)}
            onChangeText={(t) => setBalanceRaw(sanitizeAmountInput(t))}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            style={styles.flexInput}
          />
          <T variant="body" color={colors.textSecondary}>
            ₽
          </T>
        </View>
        <FieldError message={fields.initial_balance} />
      </View>

      <View>
        <FieldLabel>Иконка</FieldLabel>
        <View style={styles.options}>
          {ASSET_ICONS.map((i) => {
            const selected = i === icon;
            const t = tints[color];
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setIcon(i)}
                style={[
                  styles.iconOption,
                  { backgroundColor: selected ? t.soft : colors.muted, borderColor: selected ? t.strong : 'transparent' },
                ]}
              >
                <Icon name={i} size={26} color={selected ? t.strong : colors.textSecondary} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <FieldLabel>Цвет</FieldLabel>
        <View style={[styles.options, { paddingHorizontal: space.sm }]}>
          {ASSET_COLORS.map((c) => {
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
                  {selected && <Icon name="check" size={22} color={colors.onAccent} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <T variant="footnote" color={colors.textSecondary}>
        Начальный баланс попадёт в историю как первое пополнение.
      </T>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flexInput: { flex: 1, fontSize: 17, color: colors.textPrimary, height: '100%' },
  options: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconOption: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRing: { borderWidth: 4, borderColor: 'transparent', borderRadius: 30 },
  colorDot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
