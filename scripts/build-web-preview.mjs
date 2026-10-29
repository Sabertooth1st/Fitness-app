/**
 * Packs the static web export into ONE self-contained HTML file so the app can
 * be clicked through in a browser preview without a special server.
 *
 *   npx expo export --platform web --output-dir dist-web
 *   node scripts/build-web-preview.mjs        -> dist-preview/arrive.html
 *
 * Preview only: it uses the sql.js storage in DbProvider.web.tsx. Phones use
 * expo-sqlite, and native behaviour must still be tested on devices.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-web');
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
if (scripts.length === 0) throw new Error('No bundles found in dist-web/index.html');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

// Bundled images are referenced by absolute path; embed them so the single file is self-contained.
const embedAssets = (code) =>
  code.replace(/uri:"(\/assets\/[^"]+\.(png|jpg|gif|webp))"/g, (match, uri, ext) => {
    try {
      const data = readFileSync(join(dist, uri)).toString('base64');
      return `uri:"data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${data}"`;
    } catch {
      return match;
    }
  });

const inline = scripts
  .map((src) => embedAssets(readFileSync(join(dist, src), 'utf8')).replace(/<\/script/gi, '<\\/script'))
  .map((code) => `<script>\n${code}\n</script>`)
  .join('\n');

const page = `<title>ARRIVE App Preview</title>
<style>
${styles}
html, body { height: 100%; background: #E9E3D8; }
@media (prefers-color-scheme: dark) { html, body { background: #0B0F0E; } }
/* The app is designed for phones: show it at phone width on wide screens. */
#root { max-width: 440px; margin: 0 auto; box-shadow: 0 0 0 1px rgba(0,0,0,0.06); }
</style>
<div id="root"></div>
<script>
  // Expo Router reads the address path; start the preview at the app's root route.
  try { if (location.pathname !== '/') history.replaceState(history.state, '', '/' + location.search + location.hash); } catch (e) {}
</script>
${inline}
`;
mkdirSync(join(root, 'dist-preview'), { recursive: true });
writeFileSync(join(root, 'dist-preview', 'arrive.html'), page);
console.log(`dist-preview/arrive.html (${(page.length / 1e6).toFixed(1)} MB, ${scripts.length} bundles inlined)`);
