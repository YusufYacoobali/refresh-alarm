const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const out = 'artifacts/onboarding-buttons';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.DAYBREAK_TEST_URL ?? 'http://127.0.0.1:8082';
  await page.goto(base + '/onboarding');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: i === 0 ? 'Get started' : i === 3 ? 'Enable alarms' : 'Continue', exact: true }).click();
    await page.waitForTimeout(220);
    await page.screenshot({ path: `${out}/press-${i + 1}.png` });
    await page.waitForTimeout(800);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(base + '/onboarding');
  await page.getByRole('button', { name: 'Get started', exact: true }).click();
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${out}/small-press.png` });
  await context.close();
  await browser.close();
  console.log(JSON.stringify({ errors }));
})().catch(e => { console.error(e); process.exit(1); });
