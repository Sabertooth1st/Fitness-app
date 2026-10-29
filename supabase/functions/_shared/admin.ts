// Server-only. Runs inside Supabase Edge Functions (Deno). The administrative
// key is provided by the Supabase runtime environment and is never shipped to
// the mobile app. Verify the variable names against current Supabase docs
// before deploying (docs/ARCHITECTURE.md, "Server-only configuration").
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Server configuration missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function requireUser(req: Request, admin: SupabaseClient) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
