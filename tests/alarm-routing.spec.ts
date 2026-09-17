import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(2026, 8, 17, 7, 59, 0) });
  await page.addInitScript(() => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "routing", hour: 8, minute: 0, days: [], label: "Wake now", enabled: true,
        sound: "system", challenge: "math", difficulty: "gentle", snooze: 0,
        nextAt: +new Date(2026, 8, 17, 8, 0, 0), registration: { kind: "preview", ids: [] } }],
    }));
  });
});

test("opening the app selects Alarms and Home has a distinct route", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/alarms$/);
  await expect(page.getByRole("tab", { name: "Alarms", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/alarms$/);
});

for (const destination of ["Home", "Journal", "editor"]) {
  test(`the ringing wallpaper takes over ${destination} without opening the Alarms tab`, async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/alarms$/);
    if (destination === "editor") await page.getByRole("button", { name: /^Edit Wake now/ }).click();
    else await page.getByRole("tab", { name: destination, exact: true }).click();
    await page.clock.fastForward(60_000);
    await expect(page).toHaveURL(/\/ringing\?/);
    await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wake up my mind", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
    await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  });
}
