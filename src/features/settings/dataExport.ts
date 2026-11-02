import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { LocalStore } from '../../data/local/store';

/** Writes the user's own records to a private cache file and opens the share sheet. */
export async function exportJson(store: LocalStore): Promise<void> {
  const data = await store.exportAll();
  const file = new File(Paths.cache, `arrive-export-${new Date().toISOString().slice(0, 10)}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(data, null, 2));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
}
