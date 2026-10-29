import { Tabs } from 'expo-router/js-tabs';
import { LearnIcon, ProfileIcon, ProgressIcon, TodayIcon } from '../../components/icons';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';

export default function TabsLayout() {
  const t = useT();
  const { palette } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.today'), tabBarIcon: ({ color }) => <TodayIcon color={color} /> }} />
      <Tabs.Screen name="learn" options={{ title: t('tabs.learn'), tabBarIcon: ({ color }) => <LearnIcon color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: t('tabs.progress'), tabBarIcon: ({ color }) => <ProgressIcon color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }} />
    </Tabs>
  );
}
