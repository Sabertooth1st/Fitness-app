// RevenueCat webhook (billing is disabled by default). Verifies the shared
// authorization secret, stores each event once (idempotent by event id) and
// updates server-owned entitlements. NOT YET VERIFIED against a RevenueCat
// sandbox; confirm payload fields against current RevenueCat docs first.
import { adminClient, json } from '../_shared/admin.ts';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ACTIVE = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const INACTIVE = new Set(['EXPIRATION']);

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  const header = req.headers.get('Authorization') ?? '';
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) return json(401, { error: 'unauthorized' });

  // deno-lint-ignore no-explicit-any
  const body = (await req.json().catch(() => null)) as any;
  const event = body?.event;
  if (!event?.id || !event?.type) return json(400, { error: 'invalid_event' });

  const admin = adminClient();
  const userId: string | null = event.app_user_id ?? null; // must be the Supabase user id set via Purchases.logIn
  const { error: insertError, count } = await admin
    .from('billing_events')
    .insert({ event_id: event.id, user_id: userId, event_type: event.type, payload: body }, { count: 'exact' });
  if (insertError?.code === '23505') return json(200, { duplicate: true });
  if (insertError) return json(500, { error: 'store_failed' });

  if (userId && count && (ACTIVE.has(event.type) || INACTIVE.has(event.type))) {
    for (const entitlement of (event.entitlement_ids ?? []) as string[]) {
      await admin.from('entitlements').upsert({
        user_id: userId,
        entitlement,
        active: ACTIVE.has(event.type),
        expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
        store: event.store ?? null,
        updated_at: new Date().toISOString(),
      });
    }
  }
  // CANCELLATION keeps access until expiry; BILLING_ISSUE relies on store grace periods.
  return json(200, { ok: true });
});
