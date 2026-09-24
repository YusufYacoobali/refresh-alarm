import { test, expect } from "@playwright/test";

test("app blocking explains the five-minute ring window without claiming browser enforcement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Block distracting apps/ }).click();
  await expect(page.getByText(/5 minutes from when this alarm rings/)).toBeVisible();
  await expect(page.getByTestId("app-block-unavailable")).toContainText("App blocking works on your phone");
  await expect(page.getByRole("switch", { name: "Enable app blocking", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].appBlock)).toBeUndefined();
});

test("Social group and selectable minutes persist per alarm without enabling browser enforcement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Block distracting apps/ }).click();
  await expect(page.getByTestId("social-apps-summary")).toHaveText("Instagram · YouTube · Reddit · TikTok · Facebook · Threads · X · Snapchat · Pinterest · LinkedIn · Tumblr · Twitch · Discord");
  const duration = page.getByTestId("app-block-duration");
  await expect(duration.locator("option")).toHaveText(["5 minutes", "10 minutes", "15 minutes", "30 minutes", "60 minutes"]);
  await duration.selectOption("30");
  await expect(page.getByText(/30 minutes from when this alarm rings/)).toBeVisible();
  await page.getByRole("button", { name: "Custom apps", exact: true }).click();
  await expect(page.getByTestId("social-apps-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Social", exact: true }).click();
  await expect(duration).toHaveValue("30");
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].appBlock)).toMatchObject({ minutes: 30, group: "social", enabled: false });
  await page.reload();
  await page.getByRole("button", { name: /^Edit Rise & shine at/ }).click();
  await page.getByRole("button", { name: /Block distracting apps/ }).click();
  await expect(duration).toHaveValue("30");
  await expect(page.getByTestId("social-apps-summary")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  await duration.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/app-blocking-social-small.png" });
});
