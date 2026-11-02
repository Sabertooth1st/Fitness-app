import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useApp } from '../features/app/AppState';

export default function Index() {
  const { snapshot, palette } = useApp();
  if (!snapshot) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }
  if (!snapshot.profile || !snapshot.programme) return <Redirect href="/welcome" />;
  if (snapshot.active) return <Redirect href="/workout" />;
  return <Redirect href="/(tabs)" />;
}
