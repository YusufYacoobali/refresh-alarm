import { test, expect, Page } from '@playwright/test';
import { fajrReminders } from '../src/utils/fajr-reminders';

async function seed(page: Page, rounds = 1, cursor = 0) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(({ rounds, cursor }) => {
    if (localStorage.getItem('daybreak.state.v1')) return;
    localStorage.setItem('daybreak.state.v1', JSON.stringify({ version: 1, onboarded: true, theme: 'serene', journal: [], completions: [], fajrReminderIndex: cursor,
      alarms: [{ id: 'fajr', hour: 6, minute: 0, days: [1,2,3,4,5,6,0], label: 'Fajr', enabled: true, sound: 'system', challenge: 'fajr_reminder', difficulty: 'gentle', snooze: 0,
        missions: [{ kind: 'fajr_reminder', difficulty: 'gentle', rounds }] }] }));
  }, { rounds, cursor });
}

test('Fajr mission persists selection and previews without consuming the rotation', async ({ page }) => {
  await seed(page);
  await page.goto('/alarms');
  await page.getByRole('button', { name: /^Edit Fajr/ }).click();
  await page.getByRole('button', { name: /Wake-up missions/ }).click();
  await page.getByRole('button', { name: /Choose missions/ }).click();
  await expect(page.getByRole('button', { name: 'Fajr reminder', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Fajr reminder Hard', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview Fajr reminder', exact: true }).click();
  await expect(page.getByTestId('hadith-chapter')).toHaveText(fajrReminders[0].chapterTitle);
  await page.getByRole('button', { name: 'I’ve read it', exact: true }).click();
  await expect(page.getByText('First win of the day.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('daybreak.state.v1')!).fajrReminderIndex)).toBe(0);
  await page.goto('/challenge?id=fajr');
  await page.getByRole('button', { name: 'I’ve read it', exact: true }).click();
  await expect(page.getByText('First win of the day.')).toBeVisible();
  await page.goto('/challenge?id=fajr');
  await expect(page.getByTestId('hadith-reference')).toHaveText(`${fajrReminders[1].reference} ↗`);
});

test('all five full hadiths and chapters render and rotation wraps on completion', async ({ page }) => {
  await seed(page, 5, 4);
  await page.goto('/challenge?id=fajr');
  for (let n = 0; n < 5; n++) {
    const hadith = fajrReminders[(n + 4) % 5];
    await expect(page.getByTestId('hadith-chapter')).toHaveText(hadith.chapterTitle);
    await expect(page.getByTestId('hadith-arabic')).toHaveText(hadith.arabic);
    await expect(page.getByTestId('hadith-translation')).toHaveText(hadith.translation);
    await expect(page.getByTestId('hadith-reference')).toHaveAttribute('href', hadith.url);
    await page.getByRole('button', { name: 'I’ve read it', exact: true }).click();
  }
  await expect(page.getByText('First win of the day.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('daybreak.state.v1')!).fajrReminderIndex)).toBe(4);
});

test('Fajr reading has five minutes and timeout does not consume a hadith', async ({ page }) => {
  await seed(page, 1, 2);
  await page.clock.install();
  await page.goto('/challenge?id=fajr');
  await expect(page.getByTestId('mission-timer')).toHaveText('5:00');
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId('mission-timer')).toHaveText('3:59');
  await page.clock.fastForward(239_000);
  await expect(page).toHaveURL(/\/ringing\?/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('daybreak.state.v1')!).fajrReminderIndex)).toBe(2);
});
