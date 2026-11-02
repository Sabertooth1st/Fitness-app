/**
 * Optional cloud backup. Only created when public Supabase configuration is
 * present; the app is fully usable without it. Session tokens are stored with
 * expo-secure-store (Keychain / Android Keystore). SecureStore values have a
 * platform size limit (about 2 KB historically on Android); see
 * docs/ARCHITECTURE.md for the chunking caveat before enabling accounts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { cloudConfigured, env } from '../../config/env';
import type { OpResult, OutboxOp, RemoteGateway } from '../sync/syncEngine';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  client ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  return client;
}

export function supabaseGateway(sb: SupabaseClient): RemoteGateway {
  return {
    async push(ops: OutboxOp[]) {
      const { data, error } = await sb.rpc('apply_sync_operations', {
        ops: ops.map((o) => ({ opId: o.opId, entity: o.entity, entityId: o.entityId, payload: o.payload })),
      });
      if (error) throw new Error(error.message);
      return data as { opId: string; result: OpResult }[];
    },
  };
}
