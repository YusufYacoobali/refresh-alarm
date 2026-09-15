const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const baseURL = process.env.DAYBREAK_TEST_URL ?? 'http://localhost:8081';
(async () => {
  fs.mkdirSync('artifacts/motion', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const [name, route] of [
    ['math', '/challenge?id=demo&preview=1&kind=math'],
    ['memory', '/challenge?id=demo&preview=1&kind=memory'],
    ['shake', '/challenge?id=demo&preview=1&kind=shake'],
    ['bloom', '/success?preview=1'],
    ['sun', '/ringing?id=demo&preview=1'],
  ]) {
    await page.goto(baseURL + route, { waitUntil: 'networkidle', timeout: 120000 });
    const art = page.locator(`[data-motion="${name}"] svg`);
    await art.waitFor();
    await page.waitForTimeout(name === 'bloom' ? 1800 : 400);
    await page.screenshot({ path: `artifacts/motion/${name}.png` });
    const before = await art.innerHTML();
    await page.waitForTimeout(500);
    const after = await art.innerHTML();
    console.log(name, 'SVG elements:', await art.locator('path,ellipse,rect').count(), 'animated:', before !== after);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(baseURL + '/challenge?id=demo&preview=1&kind=math', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/motion/reduced.png' });
  const art = page.locator('[data-motion="math"] svg');
  const before = await art.innerHTML();
  await page.waitForTimeout(500);
  console.log('Reduced motion static:', before === await art.innerHTML());
  console.log('Runtime errors:', JSON.stringify(errors));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})();
