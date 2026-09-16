import { test, expect, Page } from "@playwright/test";

async function recordHaptics(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    Object.defineProperty(window, "hapticCalls", { value: calls });
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern: unknown) => { calls.push(pattern); return true; },
    });
  });
}
const calls = (page: Page) => page.evaluate(() => (window as unknown as { hapticCalls: unknown[] }).hapticCalls);

test("math outcomes each emit one haptic, including final completion", async ({ page }) => {
  await recordHaptics(page);
  await page.goto("/challenge?id=demo&preview=1&kind=math");
  await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/, { useInnerText: true });
  expect(await calls(page)).toHaveLength(0);
  const answer = async () => (await page.getByTestId("math-question").innerText()).split("+").map(Number).reduce((a, b) => a + b);
  await page.getByRole("button", { name: `Answer ${await answer() + 3}`, exact: true }).click();
  expect(await calls(page)).toEqual([[60, 100, 60, 100, 60]]);
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/, { useInnerText: true });
    await page.getByRole("button", { name: `Answer ${await answer()}`, exact: true }).click();
    if (i < 2) await expect(page.getByText(`${i + 1} of 3`)).toBeVisible();
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
  expect(await calls(page)).toEqual([[60, 100, 60, 100, 60], [40, 100, 40], [40, 100, 40], [40, 100, 40]]);
});

test("shake progress has one pulse per shake and one final celebration", async ({ page }) => {
  await recordHaptics(page);
  await page.goto("/challenge?id=demo&preview=1&kind=shake");
  for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Preview a shake" }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  expect(await calls(page)).toEqual([...Array.from({ length: 11 }, () => [40]), [40, 100, 40]]);
});

test("haptic hardware failure cannot prevent mission progress", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", { value: () => { throw new Error("Haptics unavailable"); } });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/challenge?id=demo&preview=1&kind=shake");
  await page.getByRole("button", { name: "Preview a shake" }).click();
  await expect(page.getByTestId("shake-count")).toHaveText("1");
  expect(errors).toEqual([]);
});
