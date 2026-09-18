import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, withMath = false) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: new Date(2026, 8, 17, 6, 0) });
  await page.addInitScript((withMath) => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "duas", hour: 7, minute: 0, days: [], label: "Morning duas", enabled: true,
        sound: "system", challenge: "supplication", difficulty: "gentle", snooze: 0,
        missions: [{ kind: "supplication", difficulty: "gentle" }, ...(withMath ? [{ kind: "math", difficulty: "gentle" }] : [])],
        nextAt: +new Date(2026, 8, 17, 7, 0), registration: { kind: "preview", ids: [] } }],
    }));
  }, withMath);
}

async function recite(page: Page, times = 1) {
  for (let i = 0; i < times; i++) await page.getByRole("button", { name: "I’ve recited it", exact: true }).click();
}

test("supplication is selectable, persists with all four missions, and has no difficulty selector", async ({ page }) => {
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  for (const name of ["Islamic supplication", "Math puzzle", "Memory match", "Shake to wake"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Islamic supplication Easy", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Use 4 missions", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Edit Rise & shine/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByRole("button", { name: "Islamic supplication", exact: true })).toHaveAttribute("aria-pressed", "true");
  const kinds = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].missions.map((m: { kind: string }) => m.kind));
  expect(kinds).toEqual(["supplication", "math", "memory", "shake"]);
});

test("three separate duas require 1, 3 and 3 recitations before completing the alarm", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=duas");
  await expect(page.getByTestId("dua-title")).toHaveText("Upon waking");
  await expect(page.getByRole("button", { name: "Turn mission sound on", exact: true })).toBeVisible();
  await expect(page.getByTestId("dua-arabic")).toHaveCSS("font-family", "AmiriQuran");
  expect(await page.evaluate(() => document.fonts.check('30px AmiriQuran', 'الْحَمْدُ'))).toBe(true);
  await page.screenshot({ path: "artifacts/dua-waking.png" });
  await recite(page);
  await expect(page.getByTestId("dua-title")).toHaveText("Contentment in faith");
  await expect(page.getByTestId("dua-repetitions")).toHaveText("Recite 3 times · 0/3 completed");
  await page.screenshot({ path: "artifacts/dua-contentment.png" });
  await recite(page, 2);
  await expect(page.getByTestId("dua-title")).toHaveText("Contentment in faith");
  await expect(page.getByTestId("dua-repetitions")).toHaveText("Recite 3 times · 2/3 completed");
  await recite(page);
  await expect(page.getByTestId("dua-title")).toHaveText("Seeking protection");
  await expect(page.getByTestId("dua-transliteration")).toContainText("Bismillahil-ladhi");
  await page.screenshot({ path: "artifacts/dua-protection.png" });
  await recite(page, 2);
  await expect(page.getByTestId("dua-title")).toHaveText("Seeking protection");
  await recite(page);
  await expect(page.getByText("First win of the day.")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.alarms[0].enabled).toBe(false);
  expect(saved.completions).toHaveLength(1);
});

test("each dua gets a minute, repetitions do not extend it, and expiry restarts the alarm", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=duas");
  await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  await page.clock.fastForward(45_000);
  await expect(page.getByTestId("mission-timer")).toHaveText("0:15");
  await recite(page);
  await expect(page.getByTestId("dua-title")).toHaveText("Contentment in faith");
  await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  await page.clock.fastForward(40_000);
  await recite(page);
  await expect(page.getByTestId("dua-repetitions")).toHaveText("Recite 3 times · 1/3 completed");
  await expect(page.getByTestId("mission-timer")).toHaveText("0:20");
  await page.clock.fastForward(20_000);
  await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByTestId("dua-title")).toHaveText("Upon waking");
  await recite(page);
  await expect(page.getByTestId("dua-repetitions")).toHaveText("Recite 3 times · 0/3 completed");
});

test("supplication advances to the next selected mission without dismissing the alarm", async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/challenge?id=duas");
  await recite(page);
  await expect(page.getByTestId("dua-title")).toHaveText("Contentment in faith");
  await recite(page, 3);
  await expect(page.getByTestId("dua-title")).toHaveText("Seeking protection");
  await recite(page, 3);
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("math-question")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.alarms[0].enabled).toBe(true);
  expect(saved.completions).toHaveLength(0);
});
