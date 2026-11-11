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
  await page.getByRole('button', { name: /^Edit alarm at/ }).click();
  await page.getByRole('button', { name: /Wake-up missions/ }).click();
  await page.getByRole('button', { name: /Choose missions/ }).click();
  await expect(page.getByRole('button', { name: 'Fajr reminder', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Fajr reminder Hard', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('rounds-fajr_reminder')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview Fajr reminder', exact: true }).click();
  await expect(page.getByTestId('hadith-arabic')).toHaveText(fajrReminders[0].arabic);
  await page.getByRole('button', { name: 'I’ve read it', exact: true }).click();
  await expect(page.getByText('First win of the day.')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('daybreak.state.v1')!).fajrReminderIndex)).toBe(0);
  await page.goto('/challenge?id=fajr');
  await page.getByRole('button', { name: 'I’ve read it', exact: true }).click();
  await expect(page.getByText('First win of the day.')).toBeVisible();
  await page.goto('/challenge?id=fajr');
  await expect(page.getByTestId('hadith-reference')).toHaveText(`${fajrReminders[1].reference} ↗`);
});

test('legacy round counts are ignored and hadiths rotate once per completed alarm', async ({ page }) => {
  await seed(page, 5, 4);
  for (let n = 0; n < 5; n++) {
    await page.goto('/challenge?id=fajr');
    await expect(page.getByTestId('mission-round')).toHaveCount(0);
    const hadith = fajrReminders[(n + 4) % 5];
    await expect(page.getByText(hadith.chapterTitle, { exact: true })).toHaveCount(0);
    await expect(page.getByText(hadith.chapterArabic, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('hadith-arabic')).toHaveText(hadith.arabic);
    await expect(page.getByTestId('hadith-translation')).toHaveText(hadith.translation);
    await expect(page.getByTestId('hadith-reference')).toHaveAttribute('href', hadith.url);
    await page.getByRole('button', { name: 'I’ve read it', exact: true }).click();
    await expect(page.getByText('First win of the day.')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('daybreak.state.v1')!).fajrReminderIndex)).toBe(n % 5);
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
