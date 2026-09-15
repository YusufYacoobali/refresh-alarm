import { test, expect } from "@playwright/test";

for (const route of ["ringing", "challenge"]) {
  test(`permission errors stay above the ${route} screen and can be dismissed`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("daybreak.state.v1", JSON.stringify({ version: 1, onboarded: true, theme: "serene", journal: [], completions: [], alarms: [{ id: "error-layer", hour: 23, minute: 59, days: [1, 2, 3, 4, 5, 6, 0], label: "Permission test", enabled: true, sound: "system", challenge: "none", difficulty: "gentle", snooze: 5 }] }));
      const setItem = Storage.prototype.setItem;
      let fail = true;
      Storage.prototype.setItem = function (key, value) {
        if (key === "daybreak.state.v1" && fail) {
          fail = false;
          // Exercise the same transaction error presentation as a native permission rejection.
          throw new Error("Alarm permission is off. Enable it in Settings, then try again.");
        }
        return setItem.call(this, key, value);
      };
    });
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/${route}?id=error-layer`);
    await page.getByRole("button", { name: route === "ringing" ? "A little longer · 5 min" : "Finish waking up", exact: true }).click();
    const message = page.getByTestId("screen-error-message");
    await expect(message).toBeInViewport();
    await expect(message.getByRole("alert")).toContainText("Alarm permission is off.");
    await expect(message.getByRole("button", { name: "Dismiss message" })).toBeInViewport();
    // Verify the message is in the presented screen's layer and actually receives hits.
    expect(await message.evaluate((el, route) => {
      const layer = el.closest('[data-testid="screen-error-layer"]');
      const button = el.querySelector('[aria-label="Dismiss message"]')!;
      const rect = button.getBoundingClientRect();
      const belongsToScreen = layer?.textContent?.includes(route === "ringing" ? "Permission test" : "Finish waking up");
      return !!belongsToScreen && el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }, route)).toBe(true);
    await message.getByRole("button", { name: "Dismiss message" }).click();
    await expect(message).toHaveCount(0);
    await page.getByRole("button", { name: route === "ringing" ? "A little longer · 5 min" : "Finish waking up", exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(`/${route}\\?`));
  });
}
