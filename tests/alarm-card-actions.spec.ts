import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, enabled = true) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(2026, 8, 18, 6, 0) });
  await page.addInitScript(enabled => {
    if (!localStorage.getItem("daybreak.state.v1")) localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "original", hour: 7, minute: 15, days: [1, 2, 3, 4, 5], label: "Morning", enabled,
        sound: "lofi", challenge: "memory", difficulty: "bright", snooze: 5, volume: .6,
        volumeRampSeconds: 60, silentMissions: true, missionReminder: true,
        missions: [{ kind: "memory", difficulty: "bright", rounds: 3 }],
        registration: enabled ? { kind: "preview", ids: ["source-registration"] } : undefined }],
    }));
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "daybreak.state.v1" && (window as any).failAlarmAction) {
        (window as any).failAlarmAction = false;
        throw new Error("Could not save alarm change");
      }
      originalSet.call(this, key, value);
    };
  }, enabled);
}

const readAlarms = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms);

for (const enabled of [true, false]) test(`duplicate preserves an ${enabled ? "enabled" : "disabled"} alarm and all its settings`, async ({ page }) => {
  await seed(page, enabled);
  await page.goto("/alarms");
  const before = (await readAlarms(page))[0];
  await page.getByRole("button", { name: "Duplicate Morning", exact: true }).click();
  await expect(page.getByText("Morning (copy)", { exact: true })).toBeVisible();
  await page.reload();
  const alarms = await readAlarms(page);
  expect(alarms).toHaveLength(2);
  expect(alarms[0]).toEqual(before);
  const { id, label, registration, nextAt, ...copySettings } = alarms[1];
  const { id: originalId, label: originalLabel, registration: originalRegistration, nextAt: originalNextAt, ...originalSettings } = before;
  expect(id).not.toBe(originalId);
  expect(copySettings).toEqual(originalSettings);
  if (enabled) expect(registration.ids).not.toContain("source-registration");
  await page.getByRole("button", { name: "Duplicate Morning", exact: true }).click();
  await expect(page.getByText("Morning (copy 2)", { exact: true })).toBeVisible();
});

test("delete can be cancelled, removes only the chosen record, and is available on Home", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await page.getByRole("button", { name: "Duplicate Morning", exact: true }).click();
  await expect(page.getByText("Morning (copy)", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Morning", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm delete Morning", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Keep Morning", exact: true }).click();
  expect(await readAlarms(page)).toHaveLength(2);
  await page.screenshot({ path: "artifacts/alarm-record-actions.png" });
  await page.getByRole("button", { name: "Delete Morning (copy)", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete Morning (copy)", exact: true }).click();
  await expect(page.getByText("Morning (copy)", { exact: true })).toHaveCount(0);
  await page.reload();
  expect((await readAlarms(page)).map((a: { id: string }) => a.id)).toEqual(["original"]);
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: "Duplicate Morning", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Morning", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete Morning", exact: true }).click();
  await expect(page.getByRole("button", { name: "Set your first alarm", exact: true })).toBeVisible();
  expect(await readAlarms(page)).toHaveLength(0);
});

for (const action of ["Duplicate", "Delete"]) test(`a failed ${action.toLowerCase()} preserves the original and can be retried`, async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await page.evaluate(() => { (window as any).failAlarmAction = true; });
  const button = action === "Duplicate" ? "Duplicate Morning" : "Confirm delete Morning";
  if (action === "Delete") await page.getByRole("button", { name: "Delete Morning", exact: true }).click();
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Could not save alarm change");
  expect((await readAlarms(page)).map((a: { id: string }) => a.id)).toEqual(["original"]);
  await page.getByRole("button", { name: "Dismiss message", exact: true }).click();
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect.poll(async () => (await readAlarms(page)).length).toBe(action === "Duplicate" ? 2 : 0);
});
