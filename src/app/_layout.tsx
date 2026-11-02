import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate } from '../data/local/db';
import { DbProvider } from '../data/local/DbProvider';
import { AppProvider, useApp } from '../features/app/AppState';
import { dark, fonts } from '../theme/tokens';

function Navigator() {
  const { palette } = useApp();
  return (
    <>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerTitleStyle: { fontFamily: fonts.displaySemi, fontSize: 20 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: '' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="check-in" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="hard-day" options={{ title: '' }} />
        <Stack.Screen name="readiness" options={{ title: '' }} />
        <Stack.Screen name="workout" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="safety" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="summary/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_800ExtraBold,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_700Bold,
  });
  // If a font fails to load, continue with system fonts rather than blocking the app.
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: dark.background }} />;
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
