/**
 * Release gate. Fails for missing production configuration, unreviewed
 * assignable content or rules, missing licences/media, failing tests,
 * unresolved legal/support placeholders, incomplete store information and
 * open release blockers.
 *
 *   npm run release-check            # full run including tests
 *   npm run release-check -- --skip-tests
 *
 * Passing this check does NOT certify legal compliance or exercise safety.
 * Those require real evidence from qualified people (docs/CONTENT_REVIEW.md).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_EXERCISES } from '../src/content/exercises.dev';
import { COACH_RULES } from '../src/domain/rules';
import { auditContent } from './content-audit';

const root = join(__dirname, '..');
const failures: string[] = [];
const fail = (area: string, msg: string) => failures.push(`[${area}] ${msg}`);

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

// 1. Configuration
const env = { ...loadEnvFile(join(root, '.env.production')), ...process.env } as Record<string, string | undefined>;
if (env.EXPO_PUBLIC_APP_ENV !== 'production') fail('config', 'EXPO_PUBLIC_APP_ENV is not "production"');
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) if (!env[key]) fail('config', `${key} is not set`);
if (env.EXPO_PUBLIC_BILLING_ENABLED === 'true') {
  for (const key of ['EXPO_PUBLIC_REVENUECAT_IOS_PUBLIC_KEY', 'EXPO_PUBLIC_REVENUECAT_ANDROID_PUBLIC_KEY']) if (!env[key]) fail('config', `${key} is required when billing is enabled`);
}
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith('EXPO_PUBLIC_') && /SECRET|SERVICE_ROLE|WEBHOOK/i.test(k) && v) fail('config', `${k} looks like a server secret exposed to the client`);
}

// 2. Content and rules
const cataloguePath = join(root, 'content-private/generated/catalogue.json');
const manifestPath = join(root, 'content-private/generated/asset-manifest.json');
const catalogue = existsSync(cataloguePath) ? JSON.parse(readFileSync(cataloguePath, 'utf8')) : DEV_EXERCISES;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
for (const p of auditContent(catalogue, manifest)) fail('content', p);
if (COACH_RULES.reviewStatus !== 'approved') fail('rules', `coach rules ${COACH_RULES.version} are ${COACH_RULES.reviewStatus}`);

// 3. Legal, support and store information
const website = join(root, 'website');
if (existsSync(website)) {
  for (const f of readdirSync(website).filter((n) => n.endsWith('.html'))) {
    const n = (readFileSync(join(website, f), 'utf8').match(/\[\[UNRESOLVED/g) ?? []).length;
    if (n) fail('legal', `website/${f} has ${n} unresolved placeholder(s)`);
  }
} else fail('legal', 'website/ pages are missing');
const listingPath = join(root, 'store/listing.json');
if (!existsSync(listingPath)) fail('store', 'store/listing.json is missing');
else {
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'string' && (v.trim() === '' || v.includes('[[UNRESOLVED'))) fail('store', `${path} is not filled in`);
    else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) walk(c, path ? `${path}.${k}` : k);
  };
  walk(JSON.parse(readFileSync(listingPath, 'utf8')), '');
}

// 4. Open blockers
const blockers = join(root, 'docs/RELEASE_BLOCKERS.md');
if (existsSync(blockers)) {
  const open = readFileSync(blockers, 'utf8').split('\n').filter((l) => /^\s*- \[ \]/.test(l));
  if (open.length) fail('blockers', `${open.length} open item(s) in docs/RELEASE_BLOCKERS.md`);
}

// 5. Automated tests
if (!process.argv.includes('--skip-tests')) {
  for (const [name, cmd, args] of [
    ['typecheck', 'npx', ['tsc', '--noEmit']],
    ['unit tests', 'npx', ['jest', '--silent']],
  ] as const) {
    const r = spawnSync(cmd, args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) fail('tests', `${name} failed`);
  }
}

if (failures.length) {
  console.error(`Release check FAILED (${failures.length}):`);
  for (const f of failures.filter((x) => !x.startsWith('[content]'))) console.error(`  ${f}`);
  const content = failures.filter((x) => x.startsWith('[content]'));
  if (content.length) console.error(`  [content] ${content.length} problem(s); run "npm run content:audit" for the full list`);
  process.exit(1);
}
console.log('Release check passed. Legal compliance and exercise safety still require human sign-off.');
