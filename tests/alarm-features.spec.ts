import { test, expect, Page } from "@playwright/test";

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

async function seed(page: Page, missionReminder = true) {
  await page.addInitScript(reminder => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "features", hour: 23, minute: 59, days: [], label: "Gentle start", enabled: true,
        sound: "digital_beep", challenge: "math", difficulty: "gentle", snooze: 5,
        volume: .6, volumeRampSeconds: 30, silentMissions: true, missionReminder: reminder }],
    }));
  }, missionReminder);
}

test("simple editor saves individual volume, fade and mission preferences", async ({ page }) => {
  await page.goto("/alarm");
  await expect(page.getByRole("button", { name: "Save alarm", exact: true })).toBeVisible();
  await expect(page.getByTestId("alarm-volume")).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Silent during missions" })).toHaveCount(0);
  await page.screenshot({ path: "artifacts/alarm-editor-simple.png" });
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  const slider = page.getByTestId("alarm-volume");
  await slider.fill("45");
  await page.getByRole("button", { name: "2 min", exact: true }).click();
  // Let the chip's existing 180 ms color transition settle for the artifact.
  await page.waitForTimeout(250);
  await page.screenshot({ path: "artifacts/alarm-editor-volume.png" });
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await expect(slider).toHaveCount(0);
  await page.getByRole("switch", { name: "Silent during missions", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Ring again if I drift off", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  const alarm = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0]);
  expect(alarm).toMatchObject({ volume: .45, volumeRampSeconds: 120, silentMissions: false });
  await page.reload();
  await page.getByRole("button", { name: /^Edit Rise & shine at/ }).click();
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  await expect(slider).toHaveValue("45");
  await expect(page.getByRole("button", { name: "2 min", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("alarm audio rises to its chosen volume and an idle mission rings again", async ({ page }) => {
  await seed(page);
  await page.clock.install({ time: new Date("2026-09-16T12:00:00") });
  await page.goto("/ringing?id=features");
  const retry = page.getByRole("button", { name: "Play alarm sound", exact: true });
  await expect(page.locator("audio").or(retry)).toHaveCount(1);
  if (await retry.isVisible()) await retry.click();
  const audio = page.locator("audio[data-alarm='true']");
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await expect.poll(() => audio.evaluate(el => (el as HTMLAudioElement).volume)).toBeLessThan(.2);
  await page.clock.fastForward(15_000);
  expect(await audio.evaluate(el => (el as HTMLAudioElement).volume)).toBeGreaterThan(.3);
  await page.clock.fastForward(20_000);
  expect(await audio.evaluate(el => (el as HTMLAudioElement).volume)).toBeCloseTo(.6);
  await page.screenshot({ path: "artifacts/alarm-ringing-no-sun.png" });
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByTestId("math-question")).toBeVisible();
  await expect(audio).toHaveCount(0);
  await page.clock.fastForward(59_000);
  await expect(page.getByTestId("math-question")).toBeVisible();
  await page.clock.fastForward(1500);
  await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeVisible();
  await expect(audio).toHaveCount(1);
  expect(await audio.evaluate(el => (el as HTMLAudioElement).volume)).toBeCloseTo(.6);
});

test("answers do not extend the mission timer, and finishing cancels it", async ({ page }) => {
  await seed(page);
  await page.clock.install({ time: new Date("2026-09-16T12:00:00") });
  await page.goto("/challenge?id=features");
  await expect(page.getByTestId("math-question")).toBeVisible();
  await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  await page.clock.fastForward(50_000);
  const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
  await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-timer")).toHaveText("0:10");
  await page.clock.fastForward(20_000);
  await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByTestId("math-question")).toBeVisible();
  await expect(page.getByText("0 of 3", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  await expect(page.getByRole("button", { name: "I need to stop this alarm", exact: true })).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await page.clock.fastForward(65_000);
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("older alarms with reminders disabled still get the required mission timer", async ({ page }) => {
  await seed(page, false);
  await page.clock.install({ time: new Date("2026-09-16T12:00:00") });
  await page.goto("/challenge?id=features");
  await expect(page.getByTestId("math-question")).toBeVisible();
  await page.clock.fastForward(120_000);
  await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-timer")).toHaveCount(0);
});

test("each mission gets a fresh minute and a timeout restarts the entire sequence", async ({ page }) => {
  await seed(page);
  await page.clock.install({ time: new Date("2026-09-16T12:00:00") });
  await page.goto("/alarms");
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("daybreak.state.v1")!);
    data.alarms[0].missions = [{ kind: "math", difficulty: "gentle" }, { kind: "memory", difficulty: "gentle" }];
    localStorage.setItem("daybreak.state.v1", JSON.stringify(data));
  });
  await page.goto("/challenge?id=features");
  await expect(page.getByTestId("math-question")).toBeVisible();
  await page.clock.fastForward(45_000);
  for (let i = 0; i < 3; i++) {
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByText("Mission 1 of 2", { exact: true })).toBeVisible();
  await expect(page.getByText("0 of 3", { exact: true })).toBeVisible();
});
