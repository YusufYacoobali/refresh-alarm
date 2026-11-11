import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, missions = true) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(2026, 8, 18, 6, 0) });
  await page.addInitScript(missions => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    const alarm = { id: "next", hour: 7, minute: 0, days: [1, 2, 3, 4, 5], label: "Next", enabled: true,
      sound: "digital_beep", challenge: "none", difficulty: "gentle", snooze: 0, missions: [],
      registration: { kind: "preview", ids: ["keep-scheduled"] } };
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [], fajrReminderIndex: 2,
      alarms: [alarm, { ...alarm, id: "selected", hour: 9, minute: 15, enabled: false,
        sound: "lofi", volume: .6, volumeRampSeconds: 0, silentMissions: true,
        challenge: missions ? "math" : "none", registration: undefined,
        missions: missions ? [{ kind: "math", difficulty: "gentle", rounds: 2 }, { kind: "fajr_reminder", difficulty: "gentle" }] : [] }],
    }));
  }, missions);
}

const savedState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));

async function preview(page: Page, time = "9:15 AM") {
  await page.getByRole("button", { name: `More options for alarm at ${time}`, exact: true }).click();
  await page.getByRole("menuitem", { name: `Preview full alarm at ${time}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Close alarm preview", exact: true })).toBeVisible();
}

test("a record previews its sound and every mission and round without completing the saved alarm", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await expect(page.getByRole("button", { name: "Add alarm", exact: true })).toBeVisible();
  const before = await savedState(page);
  await preview(page);
  await expect(page).toHaveURL(/\/ringing\?id=selected&preview=1/);
  await expect(page.locator('audio[data-alarm="true"][data-sound="lofi"]')).toHaveCount(1);
  await expect.poll(() => page.locator("audio").evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  for (let round = 1; round <= 2; round++) {
    await expect(page.getByTestId("mission-round")).toHaveText(`Round ${round} of 2`);
    for (let question = 0; question < 3; question++) {
      const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
      await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
    }
  }
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-timer")).toHaveText(/^4:5\d|5:00$/);
  await page.getByRole("button", { name: "I’ve read it", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  expect(await savedState(page)).toEqual(before);
});

test("closing either preview stage returns to the records and stops sound", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await preview(page);
  await page.getByRole("button", { name: "Close alarm preview", exact: true }).click();
  await expect(page).toHaveURL(/\/alarms$/);
  await expect(page.locator("audio")).toHaveCount(0);
  await preview(page);
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await page.getByRole("button", { name: "Close challenge preview", exact: true }).click();
  await expect(page).toHaveURL(/\/alarms$/);
  await expect(page.locator("audio")).toHaveCount(0);
});

test("Home offers the full preview for an alarm without missions", async ({ page }) => {
  await seed(page, false);
  await page.goto("/alarms");
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  const before = await savedState(page);
  await preview(page, "7:00 AM");
  await page.getByRole("button", { name: "Hello, new day", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  expect(await savedState(page)).toEqual(before);
});
