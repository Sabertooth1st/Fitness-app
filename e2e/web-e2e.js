/**
 * End-to-end browser suite for the guest app, run against the static web
 * export. It covers every main flow, opens every exercise page, and checks both
 * themes. It does not replace native device testing (docs/TEST_REPORT.md).
 *
 *   npx expo export --platform web --output-dir dist-web
 *   npm run e2e:web
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist-web');
const SHOTS = path.join(__dirname, 'shots');
const PORT = 8089;
fs.mkdirSync(SHOTS, { recursive: true });

const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html');
  res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});

let failures = 0;
const results = [];
function check(ok, name) {
  results.push(`${ok ? 'ok  ' : 'FAIL'} - ${name}`);
  if (!ok) failures += 1;
}

/** A fresh browser profile whose clock starts at `iso` and keeps ticking. */
async function freshPage(browser, iso, scheme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Zurich', colorScheme: scheme });
  await ctx.addInitScript((fixed) => {
    const RealDate = Date;
    const offset = new RealDate(fixed).getTime() - RealDate.now();
    globalThis.Date = class extends RealDate {
      constructor(...a) {
        if (a.length === 0) super(RealDate.now() + offset);
        else super(...a);
      }
      static now() {
        return RealDate.now() + offset;
      }
    };
  }, iso);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && page.errors.push(m.text()));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}

const tap = (page, id) => page.getByTestId(id).first().click();
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

async function onboard(page) {
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByTestId('adult-confirm').waitFor({ timeout: 30000 });
  await tap(page, 'adult-confirm');
  await tap(page, 'start-guest');
  for (let i = 0; i < 7; i++) {
    await page.getByTestId('onboarding-next').waitFor();
    await tap(page, 'onboarding-next');
  }
  await page.getByTestId('stat-weeks').waitFor({ timeout: 15000 });
}

async function startSession(page, { hardDay } = {}) {
  if (hardDay) {
    await tap(page, 'hard-day');
    await tap(page, 'hard-no_motivation');
    await tap(page, 'hard-day-go');
  } else {
    await tap(page, 'check-in');
  }
  await tap(page, 'manual-check-in');
  await page.getByTestId('safety-no').waitFor();
  await tap(page, 'safety-no');
  await tap(page, 'start-session');
  await page.getByTestId('log-set').waitFor({ timeout: 15000 });
}

/** Logs every prescribed set of every exercise, moving through the workout. */
async function completeWorkout(page) {
  for (let guard = 0; guard < 80; guard++) {
    const logSet = page.getByTestId('log-set');
    if (await logSet.isEnabled()) {
      const weight = page.getByTestId('weight-input');
      if ((await weight.count()) > 0 && (await weight.inputValue()) === '') await weight.fill('20');
      await logSet.click();
      await page.waitForTimeout(120);
      const effort = page.getByTestId('effort-about_right');
      if ((await effort.count()) > 0) await effort.click();
      continue;
    }
    if ((await page.getByTestId('next-exercise').count()) > 0) {
      await tap(page, 'next-exercise');
      await page.waitForTimeout(150);
      continue;
    }
    await tap(page, 'finish');
    break;
  }
  await page.getByTestId('summary-done').waitFor({ timeout: 15000 });
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();

  // 1. Full session on a training day (Monday), plus resume after reload.
  {
    const { page } = await freshPage(browser, '2026-11-02T16:00:00Z');
    await onboard(page);
    await shot(page, '01-today-dark');
    check((await page.getByText('Training day').count()) > 0, 'Monday is a training day');
    await tap(page, 'preview');
    await page.getByText('The plan').first().waitFor();
    await shot(page, '02-preview');
    await page.goBack();
    await startSession(page);
    await page.getByTestId('weight-input').fill('40');
    await tap(page, 'log-set');
    await page.getByTestId('effort-about_right').waitFor();
    await shot(page, '03-workout');
    await tap(page, 'effort-about_right');
    await page.reload();
    await page.getByTestId('log-set').waitFor({ timeout: 30000 });
    check((await page.getByText(/Set 1: \d+ reps · 40 kg/).count()) > 0, 'logged set survives a reload');
    await completeWorkout(page);
    await shot(page, '04-summary-full');
    check((await page.getByText('Result: Completed').count()) > 0, 'finishing every set records a full session');
    check((await page.getByText('+40').count()) > 0, 'full session awards check-in + mission XP (40)');
    await tap(page, 'summary-done');
    await page.getByText('Done for today').first().waitFor();
    check(true, 'Today shows done after the session');
    check(page.errors.length === 0, `no console errors in full session (${page.errors.slice(0, 2).join(' | ')})`);
  }

  // 2. Hard day: shrink it, keep the deal, earn the badge.
  {
    const { page } = await freshPage(browser, '2026-11-04T16:00:00Z');
    await onboard(page);
    await tap(page, 'hard-day');
    await tap(page, 'hard-no_motivation');
    await shot(page, '05-hard-day');
    await tap(page, 'hard-day-go');
    await tap(page, 'manual-check-in');
    await tap(page, 'safety-no');
    check((await page.getByText(/Hard-day mode/).count()) > 0, 'readiness shows hard-day mode');
    await tap(page, 'start-session');
    await page.getByTestId('log-set').waitFor();
    check((await page.getByText('Short session').count()) > 0, 'hard day assigns the short session');
    await completeWorkout(page);
    await shot(page, '06-summary-hard-day');
    check((await page.getByText('Hard day. Beaten.').count()) > 0, 'summary celebrates the hard day');
    check((await page.getByText(/First hard day beaten/).count()) > 0, 'first hard-day badge is earned');
    await tap(page, 'summary-done');
    await page.getByTestId('stat-hard-days').waitFor();
    check((await page.getByTestId('stat-hard-days').innerText()).startsWith('1'), 'Today counts 1 hard day beaten');
    await page.getByText('Progress').last().click();
    await page.waitForTimeout(600);
    await shot(page, '07-progress');
    check(page.errors.length === 0, `no console errors in hard-day flow (${page.errors.slice(0, 2).join(' | ')})`);
  }

  // 3. Barriers: busy machine swap and pain stop.
  {
    const { page } = await freshPage(browser, '2026-11-06T16:00:00Z');
    await onboard(page);
    await startSession(page);
    await tap(page, 'busy');
    await page.getByTestId('use-substitute').waitFor();
    await shot(page, '08-busy-swap');
    await tap(page, 'use-substitute');
    await page.waitForTimeout(300);
    const swapped = await page
      .getByRole('heading', { name: /goblet squat to bench/i })
      .first()
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check(swapped, 'busy machine swaps the current exercise to an approved alternative');
    await tap(page, 'pain');
    await page.getByText('Stop and rest').first().waitFor();
    await shot(page, '09-safety');
    check((await page.getByText(/112/).count()) > 0, 'pain stop shows emergency guidance');
    await tap(page, 'safety-back');
    await page.getByText(/stopped today for safety/).first().waitFor();
    check(true, 'Today shows a calm safety-stop day');
    check(page.errors.length === 0, `no console errors in barrier flow (${page.errors.slice(0, 2).join(' | ')})`);
  }

  // 4. Rest day, light theme, and every exercise page.
  {
    const { page } = await freshPage(browser, '2026-11-03T16:00:00Z', 'light');
    await onboard(page);
    check((await page.getByText('Rest day').count()) > 0, 'Tuesday is a rest day');
    await page.getByText('Profile').last().click();
    await page.getByText('Light', { exact: true }).click();
    await page.getByText('Today').last().click();
    await page.waitForTimeout(500);
    await shot(page, '10-today-light-rest');
    await page.getByText('Learn').last().click();
    await page.getByTestId('learn-search').waitFor();
    await shot(page, '11-learn-light');
    const ids = await page.locator('[data-testid^="exercise-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('exercise-', '')));
    check(ids.length >= 90, `library lists ${ids.length} exercises`);
    let broken = [];
    for (const id of ids) {
      await page.goto(`http://localhost:${PORT}/exercise/${id}`);
      const ok = await page
        .getByText('Setup')
        .first()
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!ok) broken.push(id);
    }
    check(broken.length === 0, `every exercise page renders (${broken.length} broken: ${broken.slice(0, 5).join(', ')})`);
    await page.goto(`http://localhost:${PORT}/exercise/barbell_back_squat`);
    await page.getByText('Setup').first().waitFor();
    await shot(page, '12-exercise-light');
    await page.getByText('Muscles worked').first().scrollIntoViewIfNeeded();
    await shot(page, '13-muscle-map-light');
    check(page.errors.length === 0, `no console errors across exercise pages (${page.errors.slice(0, 2).join(' | ')})`);
  }

  await browser.close();
  server.close();
  console.log(results.join('\n'));
  if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log(`\nall ${results.length} checks passed; screenshots in e2e/shots`);
})().catch((e) => {
  console.error('FAILED', e);
  console.log(results.join('\n'));
  process.exit(1);
});
