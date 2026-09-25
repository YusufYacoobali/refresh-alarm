import { test, expect } from "@playwright/test";

test("Alarms counts down to the next enabled alarm and updates when switched off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(2026, 8, 17, 6, 0) });
  await page.addInitScript(() => {
    const base = { minute: 0, days: [0, 1, 2, 3, 4, 5, 6], sound: "system", challenge: "math", difficulty: "gentle", snooze: 0 };
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [
        { ...base, id: "later", label: "Later morning", hour: 8, enabled: true },
        { ...base, id: "early", label: "Early morning", hour: 7, enabled: true },
        { ...base, id: "disabled", label: "Disabled morning", hour: 6, minute: 15, enabled: false },
      ],
    }));
  });
  await page.goto("/");
  await expect(page.getByText("Next alarm in 1h 0m", { exact: true })).toBeVisible();
  await page.clock.fastForward(60_000);
  await expect(page.getByText("Next alarm in 59m", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/alarms-compact.png" });
  await page.getByRole("switch", { name: "Enable alarm at 7:00 AM" }).click();
  await expect(page.getByText("Next alarm in 1h 59m", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Enable alarm at 8:00 AM" }).click();
  await expect(page.getByText("No upcoming alarms", { exact: true })).toBeVisible();
});
