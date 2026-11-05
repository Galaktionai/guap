import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth';
import { Icon } from '@/components/Icon';
import { Button, Card, confirmAction, IconButton, T } from '@/components/ui';
import { goBack } from '@/navigation';
import { colors, radius, space } from '@/theme';

export default function AccountScreen() {
  const { state, signOut } = useAuth();
  const user = state.status === 'signedIn' ? state.user : null;

  const onSignOut = () =>
    confirmAction({
      title: 'Выйти из аккаунта?',
      message: 'Данные останутся на сервере. Чтобы снова их увидеть, войдите с тем же email и паролем.',
      confirmLabel: 'Выйти',
      onConfirm: () => void signOut(),
    });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <IconButton icon="chevron-left" accessibilityLabel="Назад" onPress={goBack} />
        <T variant="headline">Аккаунт</T>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.content}>
        <Card style={styles.card}>
          <View style={styles.avatar}>
            <Icon name="user" size={28} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="footnote" color={colors.textSecondary}>
              Вы вошли как
            </T>
            <T variant="headline" numberOfLines={1}>
              {user?.email ?? '…'}
            </T>
          </View>
        </Card>
        <Button label="Выйти" icon="log-out" variant="expense" onPress={onSignOut} />
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
  content: { padding: space.lg, gap: space.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
