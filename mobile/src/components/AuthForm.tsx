import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api';
import { colors, space } from '../theme';
import { inputStyle } from './Sheet';
import { Badge, Button, FieldError, FieldLabel, T } from './ui';

type Mode = 'sign-in' | 'sign-up';

const TEXT: Record<Mode, { title: string; subtitle: string; submit: string; switchText: string; switchLink: string; switchHref: '/sign-in' | '/sign-up' }> = {
  'sign-in': {
    title: 'Вход',
    subtitle: 'Войдите, чтобы увидеть свои финансы.',
    submit: 'Войти',
    switchText: 'Нет аккаунта?',
    switchLink: 'Зарегистрироваться',
    switchHref: '/sign-up',
  },
  'sign-up': {
    title: 'Регистрация',
    subtitle: 'Создайте аккаунт — ваши данные будут видны только вам.',
    submit: 'Создать аккаунт',
    switchText: 'Уже есть аккаунт?',
    switchLink: 'Войти',
    switchHref: '/sign-in',
  },
};

/** Shared email + password form for the sign-in and sign-up screens. */
export function AuthForm({ mode, onSubmit }: { mode: Mode; onSubmit: (email: string, password: string) => Promise<void> }) {
  const t = TEXT[mode];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'Что-то пошло не так'));
      setBusy(false);
    }
  };
  const fields = error?.fields ?? {};

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Badge icon="wallet" tint="blue" size={64} shape="tile" />
            <T variant="titleLarge">{t.title}</T>
            <T variant="callout" color={colors.textSecondary} style={{ textAlign: 'center' }}>
              {t.subtitle}
            </T>
          </View>

          <View>
            <FieldLabel>Email</FieldLabel>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType={mode === 'sign-up' ? 'emailAddress' : 'username'}
              returnKeyType="next"
              style={inputStyle}
            />
            <FieldError message={fields.email} />
          </View>

          <View>
            <FieldLabel>Пароль</FieldLabel>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'sign-up' ? 'Не короче 8 символов' : 'Пароль'}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
              style={inputStyle}
            />
            <FieldError message={fields.password} />
          </View>

          {error && !Object.keys(fields).length && <FieldError message={error.message} />}
          <Button label={t.submit} onPress={submit} disabled={!canSubmit} loading={busy} />

          <View style={styles.switch}>
            <T variant="callout" color={colors.textSecondary}>
              {t.switchText}
            </T>
            <Link href={t.switchHref} replace>
              <T variant="subhead" color={colors.accent}>
                {t.switchLink}
              </T>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xxl, gap: space.xl },
  header: { alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  switch: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
