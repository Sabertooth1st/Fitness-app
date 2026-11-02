/**
 * Resolves licensed media to a private on-device file. The production
 * implementation reads the asset manifest produced by scripts/import-exercises.ts
 * and the private cache in src/data/local/mediaCache.ts. No licensed bundle has
 * been supplied yet, so nothing resolves and the UI shows the honest
 * missing-media state. Never substitute invented or scraped media.
 */
import type { ExerciseMedia } from '../domain/types';

export interface ResolvedMedia {
  uri: string;
  mediaType: 'video/mp4' | 'image/png' | 'image/webp' | 'image/gif';
  stillUri: string | null;
}

const registry = new Map<string, ResolvedMedia>();

export function registerResolvedMedia(assetId: string, media: ResolvedMedia): void {
  registry.set(assetId, media);
}

export function resolveMedia(media: ExerciseMedia): ResolvedMedia | null {
  if (media.kind !== 'licensed') return null;
  return registry.get(media.assetId) ?? null;
}
