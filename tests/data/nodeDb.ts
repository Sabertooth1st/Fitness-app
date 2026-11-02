/**
 * Test adapter implementing the app's Db interface with Node's built-in
 * SQLite, so repository logic runs against a real SQLite engine.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
import type { Db, SqlValue } from '../../src/data/local/db';

export function openNodeDb(path = ':memory:'): Db & { close(): void } {
  const raw = new DatabaseSync(path);
  return {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params: SqlValue[]) {
      const r = raw.prepare(source).run(...params);
      return { changes: Number(r.changes) };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return (raw.prepare(source).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return raw.prepare(source).all(...params) as T[];
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      raw.close();
    },
  };
}
