import { test, expect } from "@playwright/test";

test("custom Lottie plays offline and responds to reduced motion and app visibility", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/challenge?id=demo&preview=1&kind=math");
  const scene = page.locator('[data-motion="math"]');
  await expect(scene).toHaveAttribute("data-playing", "true");
  const svg = scene.locator("svg");
  await expect(svg).toBeVisible();
  expect(await svg.locator("path,ellipse,rect").count()).toBeGreaterThan(10);
  await page.context().setOffline(true);
  const first = await svg.innerHTML();
  await expect.poll(() => svg.innerHTML()).not.toBe(first);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene).toHaveAttribute("data-playing", "false");
  await expect(scene).toHaveAttribute("data-reduced-motion", "true");
  await page.waitForTimeout(150);
  const still = await svg.innerHTML();
  await page.waitForTimeout(250);
  expect(await svg.innerHTML()).toBe(still);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene).toHaveAttribute("data-playing", "true");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-playing", "false");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(scene).toHaveAttribute("data-playing", "true");
  expect(errors).toEqual([]);
});

test("animated math feedback never counts a wrong answer as mission progress", async ({ page }) => {
  await page.goto("/challenge?id=demo&preview=1&kind=math");
  await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/, { useInnerText: true });
  const question = await page.getByTestId("math-question").innerText();
  const [a, b] = question.split("+").map(Number);
  await page.getByRole("button", { name: `Answer ${a + b + 3}`, exact: true }).click();
  await expect(page.getByText("Try again.")).toBeVisible();
  await expect(page.getByText("0 of 3")).toBeVisible();
  await expect(page.getByTestId("math-question")).toHaveText(question);
  await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  await expect(page.getByText("1 of 3")).toBeVisible();
  await expect(page.getByText("Choose the answer.")).toBeVisible();
});
