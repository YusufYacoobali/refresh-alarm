import { test, expect } from "@playwright/test";

test("each onboarding CTA plays its own one-shot animation and ignores duplicate presses", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).onboardingHaptics = [];
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern: number[]) => { (window as any).onboardingHaptics.push(pattern); return true; } });
  });
  await page.goto("/onboarding");
  for (const [index, name] of ["buttonStarlight", "buttonSunrise", "buttonMatch", "buttonBell"].entries()) {
    const button = page.getByRole("button", { name: ["Refresh my mornings", "Make it mine", "Let’s set it up", "Enable alarms"][index], exact: true });
    await expect(button).toBeEnabled();
    // Duplicate clicks model queued input without waiting for the disabled CTA.
    await button.evaluate(el => { (el as HTMLElement).click(); (el as HTMLElement).click(); });
    const motion = page.locator(`[data-motion="${name}"]`);
    await expect(motion).toHaveAttribute("data-playing", "true");
    await expect(motion.locator("svg")).toHaveCount(1);
    const before = await motion.innerHTML();
    await page.waitForTimeout(130);
    expect(await motion.innerHTML()).not.toBe(before);
    if (index < 3) {
      await expect(page.getByRole("button", { name: `Onboarding step ${index + 2}`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(motion).toHaveCount(0);
    }
  }
  await expect(page.getByRole("button", { name: "Set your first alarm", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).onboardingHaptics)).toEqual([[40], [40], [40], [40, 100, 40]]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).onboarded)).toBe(true);
  expect(errors).toEqual([]);
});

test("reduced motion skips button travel and a failed finish remains retryable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function(key, value) {
      if (key === "daybreak.state.v1" && JSON.parse(value).onboarded && fail) { fail = false; throw new Error("Could not save setup"); }
      return set.call(this, key, value);
    };
  });
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Refresh my mornings", exact: true }).click();
  await page.getByRole("button", { name: "Make it mine", exact: true }).click();
  await page.getByRole("button", { name: "Let’s set it up", exact: true }).click();
  await expect(page.locator('[data-motion^="button"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Enable alarms", exact: true }).click();
  await expect(page.getByText("Could not save setup", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable alarms", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Enable alarms", exact: true }).click();
  await expect(page.getByRole("button", { name: "Set your first alarm", exact: true })).toBeVisible();
});

test("onboarding shows original artwork, slides smoothly, and pauses inactive Lottie scenes", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByTestId("onboarding-artwork-1")).toBeInViewport();
  const memory = page.locator('[data-motion="memory"]');
  await expect(memory).toHaveAttribute("data-playing", "false");
  await page.screenshot({ path: "artifacts/refinement/onboarding-1.png" });
  await page.getByRole("button", { name: "Refresh my mornings", exact: true }).click();
  await expect(page.getByTestId("onboarding-artwork-2")).toBeInViewport();
  await expect.poll(() => page.getByTestId("onboarding-pager").evaluate(el => el.scrollLeft)).toBe(390);
  await page.screenshot({ path: "artifacts/refinement/onboarding-2.png" });
  await page.getByTestId("onboarding-pager").hover();
  await page.mouse.wheel(390, 0);
  await expect.poll(() => page.getByTestId("onboarding-pager").evaluate(el => el.scrollLeft)).toBe(780);
  await expect(page.getByRole("button", { name: "Onboarding step 3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(memory).toHaveAttribute("data-playing", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Onboarding step 4", exact: true }).click();
  const clock = page.locator('[data-motion="clock"]');
  await expect(clock).toHaveAttribute("data-reduced-motion", "true");
  await expect(clock).toHaveAttribute("data-playing", "false");
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole("button", { name: "Enable alarms", exact: true })).toBeInViewport();
  await expect(page.getByText("Make tomorrow", { exact: false })).toBeInViewport();
});
