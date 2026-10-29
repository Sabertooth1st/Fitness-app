/**
 * Browser preview only. expo-sqlite's web build needs cross-origin isolation
 * (SharedArrayBuffer), which ordinary hosting does not provide, so the web
 * build runs SQLite compiled to plain JavaScript (sql.js) and saves a copy in
 * localStorage after each write. The app itself ships on iOS and Android with
 * expo-sqlite; this file is never used there.
 */
import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database, SqlValue as SqlJsValue } from 'sql.js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { Db, SqlValue } from './db';

const KEY = 'arrive.preview.db';

function load(): Uint8Array | null {
  try {
    const s = globalThis.localStorage?.getItem(KEY);
    if (!s) return null;
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function save(db: Database): void {
  try {
    const bytes = db.export();
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    globalThis.localStorage?.setItem(KEY, btoa(bin));
  } catch {
    // Storage may be blocked (private window, preview frames); the session still works in memory.
  }
}

function wrap(raw: Database): Db {
  let depth = 0;
  const rows = <T,>(source: string, params: SqlValue[]): T[] => {
    const stmt = raw.prepare(source);
    try {
      stmt.bind(params as SqlJsValue[]);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  };
  const persist = () => {
    if (depth === 0) save(raw);
  };
  return {
    async execAsync(source) {
      raw.exec(source);
      persist();
    },
    async runAsync(source, params) {
      raw.run(source, params as SqlJsValue[]);
      const changes = raw.getRowsModified();
      persist();
      return { changes };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return rows<T>(source, params)[0] ?? null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return rows<T>(source, params);
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      depth += 1;
      try {
        await task();
        depth -= 1;
        raw.exec('COMMIT');
      } catch (e) {
        depth -= 1;
        raw.exec('ROLLBACK');
        throw e;
      }
      persist();
    },
  };
}

const DbContext = createContext<Db | null>(null);

export function DbProvider({ children, onInit }: { children: ReactNode; onInit: (db: Db) => Promise<void> }) {
  const [db, setDb] = useState<Db | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const SQL = await initSqlJs();
      const saved = load();
      const instance = wrap(saved ? new SQL.Database(saved) : new SQL.Database());
      await onInit(instance);
      if (!cancelled) setDb(instance);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!db) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside DbProvider');
  return db;
}
