import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';
import type { Db } from './db';

/** Native: expo-sqlite. The web preview uses DbProvider.web.tsx instead. */
export function DbProvider({ children, onInit }: { children: ReactNode; onInit: (db: Db) => Promise<void> }) {
  return (
    <SQLiteProvider databaseName="arrive.db" onInit={(db) => onInit(db as unknown as Db)}>
      {children}
    </SQLiteProvider>
  );
}

export function useDb(): Db {
  return useSQLiteContext() as unknown as Db;
}
