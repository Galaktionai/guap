import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '../navigation';
import { colors, radius, space } from '../theme';
import { IconButton, T } from './ui';

/** Layout of a modal sheet: grabber, title with close button, scrollable body. */
export function Sheet({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.grabber} />
      <View style={styles.head}>
        <T variant="titleMedium">{title}</T>
        <IconButton
          icon="x"
          background={colors.muted}
          color={colors.textSecondary}
          accessibilityLabel="Закрыть"
          onPress={goBack}
        />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

export const inputStyle = {
  height: 52,
  borderRadius: radius.md,
  backgroundColor: colors.muted,
  paddingHorizontal: space.lg,
  fontSize: 17,
  color: colors.textPrimary,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textTertiary,
    marginTop: 8,
    marginBottom: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  body: { padding: space.lg, gap: space.xl },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
