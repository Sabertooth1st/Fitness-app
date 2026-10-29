/**
 * Browser smoke test of the main guest flow against a static web export.
 * Not a substitute for native device testing (see docs/TEST_REPORT.md).
 *
 *   npx expo export --platform web --output-dir dist-web
 *   npm run e2e:web
 *
 * Requires Playwright with a Chromium build available on the machine.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const shots = path.join(__dirname, 'shots');
const ROOT = path.join(__dirname, '..', 'dist-web');
const PORT = 8089;

// expo-sqlite on web needs cross-origin isolation headers.
const types = { '.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});
require('fs').mkdirSync(shots, { recursive: true });
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  // 2026-11-02 is a Monday (planned day for Mon/Wed/Fri).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Zurich' });
  await ctx.addInitScript(() => {
    const fixed = new Date('2026-11-02T16:00:00Z').getTime();
    const RealDate = Date; const offset = fixed - RealDate.now();
    // Shift the clock to a fixed Monday while still advancing.
    globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); } static now() { return RealDate.now() + offset; } };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: `${shots}/${n}.png`, fullPage: true });
  const tap = (id) => page.getByTestId(id).click();

  await page.goto('http://localhost:8089/');
  await page.getByTestId('adult-confirm').waitFor({ timeout: 30000 });
  await shot('01-welcome');
  await tap('adult-confirm');
  await tap('start-guest');
  for (let i = 0; i < 7; i++) {
    await page.getByTestId('onboarding-next').waitFor();
    if (i === 2) await shot('02-onboarding-days');
    await tap('onboarding-next');
  }
  await page.getByTestId('check-in').waitFor({ timeout: 15000 });
  await shot('03-today');
  await tap('preview');
  await page.getByText('Plan preview').first().waitFor();
  await shot('04-preview');
  await page.goBack();
  await tap('check-in');
  await page.getByTestId('manual-check-in').waitFor();
  await shot('05-check-in');
  await tap('manual-check-in');
  await page.getByTestId('safety-no').waitFor();
  await tap('safety-no');
  await shot('06-readiness');
  await tap('start-session');
  await page.getByTestId('log-set').waitFor({ timeout: 15000 });
  await page.getByTestId('weight-input').fill('40');
  await tap('log-set');
  await page.getByTestId('effort-about_right').waitFor();
  await shot('07-workout-logged');
  await tap('effort-about_right');

  // Simulate app termination: reload the page and confirm the set survived.
  await page.reload();
  await page.getByTestId('log-set').waitFor({ timeout: 30000 });
  const resumed = await page.getByText(/Set 1: 8 reps · 40 kg/).count();
  if (resumed === 0) throw new Error('logged set was not restored after reload');
  console.log('ok - logged set restored after reload');
  await shot('08-resumed');

  await tap('busy');
  await page.getByText('Suggested swap').waitFor();
  await shot('09-busy-swap');
  await tap('use-substitute');

  // Finish early -> partial
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Finish session' }).last().click();
  await page.getByTestId('summary-done').waitFor({ timeout: 15000 });
  await shot('10-summary');
  await tap('summary-done');
  await page.waitForTimeout(1000);
  await shot('11-today-after');
  await page.getByText('Progress').last().click();
  await page.waitForTimeout(1000);
  await shot('12-progress');
  await page.getByText('Learn').last().click();
  await page.waitForTimeout(800);
  await shot('13-learn');
  await page.getByText('Leg press (machine)').first().click();
  await page.waitForTimeout(1000);
  await shot('14-exercise');
  await page.getByText('Muscles worked').first().scrollIntoViewIfNeeded();
  await shot('15-muscle-map');
  await browser.close();
  server.close();
  if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors.slice(0, 10))}`);
  console.log('ok - web smoke flow completed; screenshots in e2e/shots');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
