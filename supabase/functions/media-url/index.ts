// Returns a short-lived signed URL for ONE approved licensed asset. There is no
// listing endpoint and the bucket is private, preventing bulk catalogue download.
import { adminClient, json, requireUser } from '../_shared/admin.ts';

const BUCKET = 'exercise-media';
const TTL_SECONDS = 300;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const admin = adminClient();
  if (!(await requireUser(req, admin))) return json(401, { error: 'unauthenticated' });
  const { assetId } = (await req.json().catch(() => ({}))) as { assetId?: string };
  if (!assetId || typeof assetId !== 'string') return json(400, { error: 'asset_required' });

  const { data: asset } = await admin
    .from('exercise_assets')
    .select('storage_path, review_status, distribution_mode, exercises!inner(review_status, disabled)')
    .eq('id', assetId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const ex = (asset as any)?.exercises;
  if (!asset || asset.review_status !== 'approved' || !ex || ex.review_status !== 'approved' || ex.disabled) {
    return json(404, { error: 'not_found' });
  }
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(asset.storage_path, TTL_SECONDS);
  if (error || !data) return json(500, { error: 'sign_failed' });
  return json(200, { url: data.signedUrl, distributionMode: asset.distribution_mode, expiresIn: TTL_SECONDS });
});
