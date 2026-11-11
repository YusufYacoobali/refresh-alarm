import { test, expect } from "@playwright/test";
import { sounds } from "../src/utils/sounds";

test("all supplied sounds decode, preview exclusively, and stop on leaving", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  await page.getByRole("button", { name: /Choose sound/ }).click();
  for (const sound of sounds) {
    if (sound.category === "Islamic") await page.getByRole("button", { name: "Islamic", exact: true }).click();
    await page.getByRole("button", { name: `Play ${sound.name}`, exact: true }).click();
    const audio = page.locator(`audio[data-sound="${sound.id}"]`);
    await expect(audio).toHaveCount(1);
    await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
    expect(await audio.evaluate(el => (el as HTMLAudioElement).error)).toBeNull();
    if (sound.category === "Islamic") expect(await audio.evaluate(el => (el as HTMLAudioElement).duration)).toBeGreaterThan(30);
    await expect(page.locator("audio")).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Alarm tones", exact: true }).click();
  await page.getByRole("button", { name: "Select Rooster", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Play Rooster", exact: true }).click();
  await page.getByRole("button", { name: "Use this sound", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].sound)).toBe("rooster");
  expect(errors).toEqual([]);
});

test("Islamic section saves adhan selections and reopens on the selected section", async ({ page }) => {
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  await page.getByRole("button", { name: /Choose sound/ }).click();
  await page.getByRole("button", { name: "Islamic", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select Lo-fi", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Select Adhan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select Mishary Alafasy · Fajr", exact: true }).click();
  await page.screenshot({ path: "artifacts/refinement/islamic-sounds.png" });
  await page.getByRole("button", { name: "Use this sound", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].sound)).toBe("adhan_alafasy_fajr");
  await page.reload();
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  await page.getByRole("button", { name: /Choose sound/ }).click();
  await expect(page.getByRole("button", { name: "Islamic", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Select Mishary Alafasy · Fajr", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("a real alarm loops its chosen sound through missions and stops on completion", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("daybreak.state.v1", JSON.stringify({ version: 1, onboarded: true, theme: "serene", journal: [], completions: [], alarms: [{ id: "audio-test", hour: 23, minute: 59, days: [], label: "Sound test", enabled: true, sound: "digital_beep", challenge: "math", difficulty: "gentle", snooze: 5 }] }));
  });
  await page.goto("/ringing?id=audio-test");
  const retry = page.getByRole("button", { name: "Play alarm sound", exact: true });
  // Browsers may require a gesture before the first audible playback.
  if (await retry.isVisible()) await retry.click();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Turn mission sound on", exact: true }).click();
  const audio = page.locator('audio[data-sound="digital_beep"]');
  await expect(audio).toHaveCount(1);
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  expect(await audio.evaluate(el => (el as HTMLAudioElement).loop)).toBe(true);
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/);
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("shake count stays large and visible on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/challenge?id=demo&preview=1&kind=shake");
  await expect(page.getByTestId("shake-count")).toBeInViewport();
  const size = await page.getByTestId("shake-count").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(110);
  await page.getByRole("button", { name: "Preview a shake", exact: true }).click();
  await expect(page.getByTestId("shake-count")).toHaveText("1");
  await expect(page.getByTestId("shake-count")).toHaveAttribute("aria-label", "1 of 12 shakes");
  await page.screenshot({ path: "artifacts/refinement/shake-large-count.png" });
});
