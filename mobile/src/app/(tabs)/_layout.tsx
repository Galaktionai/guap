import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { T } from '@/components/ui';
import { colors } from '@/theme';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Главная', icon: 'house' },
  history: { label: 'История', icon: 'history' },
};

/** Bottom bar from the design: Главная · (+) · История. */
function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tab = (index: number) => {
    const route = state.routes[index];
    const meta = TAB_META[route.name];
    const active = state.index === index;
    const color = active ? colors.accent : colors.textTertiary;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={styles.tab}
      >
        <Icon name={meta.icon} size={24} color={color} />
        <T variant="tab" color={color}>
          {meta.label}
        </T>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tab(0)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Добавить операцию"
        onPress={() => router.push('/new-transaction')}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Icon name="plus" size={26} color={colors.onAccent} />
      </Pressable>
      {tab(1)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { width: 96, alignItems: 'center', gap: 3, paddingVertical: 4 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
