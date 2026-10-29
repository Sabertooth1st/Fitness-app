import type { Exercise } from '../../src/domain/types';

export type DistributionMode = 'stream_only' | 'private_cache' | 'app_bundle';

export interface LicenceRecord {
  id: string;
  provider: string;
  licenceName: string;
  licenceVersion: string;
  /** Reference only (order number); receipts live outside the repository. */
  purchaseReference: string | null;
  permitsOfflineCache: boolean;
  permitsAppBundling: boolean;
  attribution: string | null;
}

export interface AssetManifestEntry {
  assetId: string;
  exerciseId: string;
  provider: string;
  sourceId: string;
  licenceId: string;
  mediaType: 'video/mp4' | 'image/png' | 'image/webp' | 'image/gif';
  checksumSha256: string;
  path: string;
  distributionMode: DistributionMode;
  reviewStatus: 'not_reviewed' | 'approved' | 'rejected';
}

export interface ImportResult {
  exercises: Exercise[];
  assets: AssetManifestEntry[];
  licence: LicenceRecord;
  warnings: string[];
}

/**
 * A provider adapter maps a legitimately acquired bundle into ARRIVE records.
 * Adapters must read the delivered schema; never guess provider URLs or IDs.
 */
export interface ProviderAdapter {
  name: string;
  import(bundleDir: string, licence: LicenceRecord): Promise<ImportResult>;
}
