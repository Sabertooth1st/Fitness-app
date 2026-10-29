// Deletes the caller's account and all user-owned rows (ON DELETE CASCADE).
// Requires a recent sign-in (re-authentication) to prevent deletion from a
// stolen long-lived session. Store subscriptions are separate and must be
// cancelled in the App Store / Google Play; deletion is never blocked by them.
import { adminClient, json, requireUser } from '../_shared/admin.ts';

const MAX_AUTH_AGE_SECONDS = 10 * 60;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const admin = adminClient();
  const auth = await requireUser(req, admin);
  if (!auth) return json(401, { error: 'unauthenticated' });

  const lastSignIn = auth.user.last_sign_in_at ? Date.parse(auth.user.last_sign_in_at) : 0;
  if (Date.now() - lastSignIn > MAX_AUTH_AGE_SECONDS * 1000) return json(403, { error: 'reauthentication_required' });

  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return json(500, { error: 'deletion_failed' });
  // Database backups are retained by the provider for a limited period; see docs/PRIVACY_DATA_MAP.md.
  return json(200, { deleted: true });
});
