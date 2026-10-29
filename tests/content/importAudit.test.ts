/**
 * @jest-environment node
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { genericJsonAdapter } from '../../scripts/content/genericJsonAdapter';
import { auditContent } from '../../scripts/content-audit';
import { DEV_EXERCISES } from '../../src/content/exercises.dev';
import { TEMPLATES } from '../../src/content/templates.dev';

const licence = {
  id: 'test-licence',
  provider: 'testprovider',
  licenceName: 'Test fixture licence',
  licenceVersion: '1',
  purchaseReference: null,
  permitsOfflineCache: true,
  permitsAppBundling: false,
  attribution: null,
};

describe('content import (fixture data only)', () => {
  it('imports records as not_reviewed with checksummed asset manifest entries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
    writeFileSync(join(dir, 'a.mp4'), 'fixture-bytes');
    const { media, ...base } = DEV_EXERCISES[0];
    void media;
    writeFileSync(join(dir, 'exercises.json'), JSON.stringify([{ ...base, mediaFile: 'a.mp4', mediaType: 'video/mp4' }, { ...DEV_EXERCISES[1] }]));
    const r = await genericJsonAdapter.import(dir, licence);
    expect(r.exercises.every((e) => e.reviewStatus === 'not_reviewed')).toBe(true);
    expect(r.assets).toHaveLength(1);
    expect(r.assets[0]).toMatchObject({ distributionMode: 'private_cache', checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(r.warnings).toContain(`${DEV_EXERCISES[1].id}: no demonstration media in bundle`);
  });
});

describe('production content audit (acceptance 20)', () => {
  it('fails for the unreviewed development catalogue', () => {
    const problems = auditContent(DEV_EXERCISES, []);
    expect(problems.some((p) => p.includes('not approved'))).toBe(true);
    expect(problems.some((p) => p.includes('no demonstration media'))).toBe(true);
  });

  it('passes only when every assignable movement has approval, licence and usable media', () => {
    const template = TEMPLATES['full-body-beginner'];
    const original = template.reviewStatus;
    template.reviewStatus = 'approved';
    try {
      const approved = DEV_EXERCISES.map((e) => ({
        ...e,
        reviewStatus: 'approved' as const,
        licence: 'test-licence',
        media: { kind: 'licensed' as const, assetId: `asset-${e.id}`, mediaType: 'video/mp4' as const },
      }));
      const manifest = approved.map((e) => ({
        assetId: `asset-${e.id}`,
        exerciseId: e.id,
        provider: 'testprovider',
        sourceId: e.id,
        licenceId: 'test-licence',
        mediaType: 'video/mp4' as const,
        checksumSha256: '0'.repeat(64),
        path: `${e.id}.mp4`,
        distributionMode: 'private_cache' as const,
        reviewStatus: 'approved' as const,
      }));
      expect(auditContent(approved, manifest)).toEqual([]);
      // One stream-only asset is enough to fail the offline requirement.
      manifest[0] = { ...manifest[0], distributionMode: 'stream_only' as never };
      expect(auditContent(approved, manifest)).toHaveLength(1);
    } finally {
      template.reviewStatus = original;
    }
  });
});
