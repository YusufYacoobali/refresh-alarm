const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const out = 'artifacts/refinement'; fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.DAYBREAK_TEST_URL ?? 'http://127.0.0.1:8082';
  await page.goto(base + '/onboarding');
  for (let i = 0; i < 4; i++) {
    if (i) await page.getByRole('button', { name: `Onboarding step ${i + 1}`, exact: true }).click();
    await page.waitForTimeout(650);
    await page.screenshot({ path: `${out}/onboarding-${i + 1}.png` });
  }
  await page.goto(base + '/alarm');
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${out}/editor.png` });
  await page.getByRole('button', { name: /Wake-up missions/ }).click();
  await page.getByRole('button', { name: 'Math puzzle', exact: true }).click();
  await page.getByRole('button', { name: 'Math puzzle Hard', exact: true }).click();
  await page.getByRole('button', { name: 'Memory match', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/missions.png` });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(base + '/alarm');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/editor-small.png` });
  await page.goto(base + '/onboarding');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/onboarding-small.png` });
  console.log(JSON.stringify({ errors }));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
