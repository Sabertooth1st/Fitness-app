import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate } from '../data/local/db';
import { DbProvider } from '../data/local/DbProvider';
import { AppProvider, useApp } from '../features/app/AppState';
import { dark } from '../theme/tokens';

function Navigator() {
  const { palette } = useApp();
  return (
    <>
      <StatusBar style={palette === dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: '' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="check-in" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="readiness" options={{ title: '' }} />
        <Stack.Screen name="workout" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="safety" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="summary/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DbProvider onInit={migrate}>
        <AppProvider>
          <Navigator />
        </AppProvider>
      </DbProvider>
    </SafeAreaProvider>
  );
}
