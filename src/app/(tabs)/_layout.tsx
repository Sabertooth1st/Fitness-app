import { Tabs } from 'expo-router/js-tabs';
import { LearnIcon, ProfileIcon, ProgressIcon, TodayIcon } from '../../components/icons';
import { useApp } from '../../features/app/AppState';
import { useT } from '../../i18n';
import { fonts } from '../../theme/tokens';

export default function TabsLayout() {
  const t = useT();
  const { palette } = useApp();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accentInk,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border, minHeight: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.bodyBold, letterSpacing: 0.8, textTransform: 'uppercase' },
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
