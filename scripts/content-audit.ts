/**
 * Production content audit (acceptance 20). Fails if any movement that can be
 * assigned in production lacks approval, a licence, usable media or complete
 * instructions, or if an assignable template is unreviewed.
 *
 *   npm run content:audit                # audits the bundled development catalogue
 *   npm run content:audit -- --catalogue content-private/generated/catalogue.json --manifest content-private/generated/asset-manifest.json
 *
 * It cannot certify exercise safety or legal rights; those need real evidence.
 */
import { existsSync, readFileSync } from 'node:fs';
import { DEV_EXERCISES } from '../src/content/exercises.dev';
import { TEMPLATES } from '../src/content/templates.dev';
import type { Exercise } from '../src/domain/types';
import type { AssetManifestEntry } from './content/types';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function auditContent(catalogue: Exercise[], manifest: AssetManifestEntry[]): string[] {
  const problems: string[] = [];
  const byId = new Map(catalogue.map((e) => [e.id, e]));
  const assignable = new Set<string>();
  for (const t of Object.values(TEMPLATES)) {
    if (t.reviewStatus !== 'approved') problems.push(`template ${t.id}@${t.version}: not approved (${t.reviewStatus})`);
    for (const s of t.sessions) for (const slot of s.slots) slot.candidates.forEach((c) => assignable.add(c));
  }
  // Substitutes are assignable too.
  for (const id of [...assignable]) {
    const e = byId.get(id);
    e?.alternatives.forEach((a) => assignable.add(a));
    e?.regressions.forEach((a) => assignable.add(a));
  }
  for (const id of [...assignable].sort()) {
    const e = byId.get(id);
    if (!e) {
      problems.push(`${id}: referenced by a template but missing from the catalogue`);
      continue;
    }
    if (e.reviewStatus !== 'approved') problems.push(`${id}: review status is ${e.reviewStatus}`);
    if (!e.licence || e.licence.startsWith('internal-dev')) problems.push(`${id}: no licence record`);
    if (e.setup.en.length === 0 || e.cues.en.length === 0 || !e.stopGuidance.en) problems.push(`${id}: incomplete instructions`);
    if (e.primaryMuscles.length === 0) problems.push(`${id}: no reviewed muscle metadata`);
    if (e.media.kind !== 'licensed') {
      problems.push(`${id}: no demonstration media`);
    } else {
      const assetId = e.media.assetId;
      const asset = manifest.find((a) => a.assetId === assetId);
      if (!asset) problems.push(`${id}: media ${assetId} missing from asset manifest`);
      else {
        if (asset.reviewStatus !== 'approved') problems.push(`${id}: media not approved`);
        if (asset.distributionMode === 'stream_only') problems.push(`${id}: media licence does not permit offline use`);
      }
    }
  }
  return problems;
}

if (require.main === module) {
  const cataloguePath = arg('catalogue');
  const manifestPath = arg('manifest');
  const catalogue: Exercise[] = cataloguePath ? JSON.parse(readFileSync(cataloguePath, 'utf8')) : DEV_EXERCISES;
  const manifest: AssetManifestEntry[] = manifestPath && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  const problems = auditContent(catalogue, manifest);
  if (problems.length) {
    console.error(`Content audit FAILED: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('Content audit passed.');
}
