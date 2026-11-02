import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Exercise } from '../../src/domain/types';
import type { AssetManifestEntry, ImportResult, LicenceRecord, ProviderAdapter } from './types';

/**
 * Adapter for ARRIVE's documented intermediate format (docs/CONTENT_IMPORT.md):
 * `exercises.json` (array of Exercise without review fields) plus media files
 * referenced by relative path. Provider-specific adapters can convert a
 * delivered bundle into this format first.
 */
export const genericJsonAdapter: ProviderAdapter = {
  name: 'generic-json',
  async import(bundleDir: string, licence: LicenceRecord): Promise<ImportResult> {
    const raw = JSON.parse(readFileSync(join(bundleDir, 'exercises.json'), 'utf8')) as (Omit<Exercise, 'reviewStatus' | 'media'> & {
      mediaFile?: string;
      mediaType?: AssetManifestEntry['mediaType'];
    })[];
    const warnings: string[] = [];
    const exercises: Exercise[] = [];
    const assets: AssetManifestEntry[] = [];
    for (const r of raw) {
      let media: Exercise['media'] = { kind: 'none' };
      if (r.mediaFile && r.mediaType) {
        const file = join(bundleDir, r.mediaFile);
        if (!existsSync(file)) {
          warnings.push(`${r.id}: media file missing (${r.mediaFile})`);
        } else {
          const checksum = createHash('sha256').update(readFileSync(file)).digest('hex');
          const assetId = `${licence.provider}:${r.provider?.externalId ?? r.id}:${checksum.slice(0, 12)}`;
          assets.push({
            assetId,
            exerciseId: r.id,
            provider: licence.provider,
            sourceId: r.provider?.externalId ?? r.id,
            licenceId: licence.id,
            mediaType: r.mediaType,
            checksumSha256: checksum,
            path: r.mediaFile,
            distributionMode: licence.permitsAppBundling ? 'app_bundle' : licence.permitsOfflineCache ? 'private_cache' : 'stream_only',
            reviewStatus: 'not_reviewed',
          });
          media = { kind: 'licensed', assetId, mediaType: r.mediaType };
        }
      } else {
        warnings.push(`${r.id}: no demonstration media in bundle`);
      }
      // Imported content always starts unreviewed. Approval is recorded separately by a human reviewer.
      exercises.push({ ...r, media, licence: licence.id, reviewStatus: 'not_reviewed' } as Exercise);
    }
    return { exercises, assets, licence, warnings };
  },
};
