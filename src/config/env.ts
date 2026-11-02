import type { AppEnvironment } from '../domain/types';

/**
 * Public client configuration only. Anything here is embedded in the app
 * binary; server secrets must never use the EXPO_PUBLIC_ prefix.
 * Expo inlines process.env.EXPO_PUBLIC_* at build time, so each variable must
 * be referenced literally.
 */
function parseEnv(value: string | undefined): AppEnvironment {
  return value === 'production' || value === 'staging' ? value : 'development';
}

export const env = {
  appEnv: parseEnv(process.env.EXPO_PUBLIC_APP_ENV),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY ?? '',
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY ?? '',
  billingEnabled: process.env.EXPO_PUBLIC_BILLING_ENABLED === 'true',
  analyticsEnabled: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === 'true',
};

export const cloudConfigured = env.supabaseUrl !== '' && env.supabasePublishableKey !== '';
