/**
 * Import a legitimately acquired exercise bundle.
 *
 *   npm run content:import -- --adapter generic-json --bundle content-private/<provider>/<version> --licence content-private/<provider>/licence.json
 *
 * Output goes to content-private/generated/ (git-ignored): the full manifest is
 * imported, but only records later marked approved by a human reviewer are
 * assignable in production. Raw bundles and receipts must never be committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { genericJsonAdapter } from './content/genericJsonAdapter';
import type { LicenceRecord, ProviderAdapter } from './content/types';

const ADAPTERS: Record<string, ProviderAdapter> = { [genericJsonAdapter.name]: genericJsonAdapter };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const adapterName = arg('adapter');
  const bundle = arg('bundle');
  const licencePath = arg('licence');
  if (!adapterName || !bundle || !licencePath) {
    console.error('Usage: --adapter <name> --bundle <dir> --licence <licence.json>');
    console.error(`Available adapters: ${Object.keys(ADAPTERS).join(', ')}`);
    console.error('No provider-specific adapter (e.g. RepDB) exists yet: write it against the delivered schema after purchase.');
    process.exit(2);
  }
  const adapter = ADAPTERS[adapterName];
  if (!adapter) throw new Error(`Unknown adapter ${adapterName}`);
  const licence = JSON.parse(readFileSync(licencePath, 'utf8')) as LicenceRecord;
  const result = await adapter.import(resolve(bundle), licence);
  const out = resolve('content-private/generated');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'catalogue.json'), JSON.stringify(result.exercises, null, 2));
  writeFileSync(join(out, 'asset-manifest.json'), JSON.stringify(result.assets, null, 2));
  writeFileSync(join(out, 'licence.json'), JSON.stringify(result.licence, null, 2));
  console.log(`Imported ${result.exercises.length} exercises and ${result.assets.length} media assets (all not_reviewed).`);
  for (const w of result.warnings) console.warn(`warning: ${w}`);
}

void main();
