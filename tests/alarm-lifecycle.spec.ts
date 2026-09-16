import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, silentMissions: boolean) {
  await page.addInitScript((silent) => {
    if (!localStorage.getItem("daybreak.state.v1")) localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "mission-audio", hour: 8, minute: 0, days: [], label: "Mission audio", enabled: true,
        sound: "digital_beep", challenge: "math", difficulty: "gentle", snooze: 5, silentMissions: silent,
        missions: [{ kind: "math", difficulty: "gentle" }, { kind: "memory", difficulty: "gentle" }] }],
    }));
  }, silentMissions);
}

test("silent missions mute across mission changes, can be unmuted, and finish cleanly", async ({ page }) => {
  await seed(page, true);
  await page.goto("/ringing?id=mission-audio");
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByText("Sound off during missions", { exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Turn mission sound on", exact: true }).click();
  await expect(page.locator("audio[data-alarm='true']")).toHaveCount(1);
  await expect.poll(() => page.locator("audio").evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Silence mission sound", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
  await expect(page.getByText("Mission 2 of 2 · Memory match", { exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "I need to stop this alarm", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.alarms[0].enabled).toBe(false);
  expect(saved.completions).toHaveLength(1);
});

test("mission sound preference survives saving and reopening the editor", async ({ page }) => {
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  const toggle = page.getByRole("switch", { name: "Silent during missions", exact: true });
  await toggle.click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Edit Rise & shine at/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await expect(toggle).toBeChecked();
});

test("a failed dismissal remains retryable without replaying missions", async ({ page }) => {
  await seed(page, true);
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "daybreak.state.v1" && (window as any).failFinish) {
        (window as any).failFinish = false;
        throw new Error("Could not save completion");
      }
      return write.call(this, key, value);
    };
  });
  await page.goto("/challenge?id=mission-audio");
  await page.evaluate(() => { (window as any).failFinish = true; });
  await page.getByRole("button", { name: "I need to stop this alarm", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Could not save completion");
  await page.getByRole("button", { name: "Dismiss message", exact: true }).click();
  await page.getByRole("button", { name: "Finish waking up", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});
