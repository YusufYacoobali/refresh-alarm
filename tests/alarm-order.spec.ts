import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, count = 3) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(count => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({ version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: Array.from({ length: count }, (_, i) => ({ id: `alarm-${count - i}`, hour: count - i, minute: 0, label: `Alarm ${count - i}`,
        days: [1, 2, 3, 4, 5], enabled: false, sound: "lofi", challenge: "none", difficulty: "gentle", snooze: 5 })) }));
  }, count);
  await page.goto("/alarms");
  await expect(page.getByTestId("alarm-record-alarm-1")).toBeVisible();
}
const records = (page: Page) => page.locator('[data-testid^="alarm-record-"]');
const order = (page: Page) => records(page).evaluateAll(elements => elements.map(element => element.getAttribute("data-testid")!.replace("alarm-record-", "")));
async function drag(page: Page, from: string, to: string) {
  const source = await page.getByTestId(`alarm-record-${from}`).boundingBox();
  const target = await page.getByTestId(`alarm-record-${to}`).boundingBox();
  await page.mouse.move(source!.x + 80, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(target!.x + 80, target!.y + target!.height / 2 + (target!.y > source!.y ? 25 : -25), { steps: 15 });
  await page.mouse.up();
}

test("defaults to time order, long press moves both ways and persists without changing alarm settings", async ({ page }) => {
  await seed(page);
  await expect.poll(() => order(page)).toEqual(["alarm-1", "alarm-2", "alarm-3"]);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms);
  await drag(page, "alarm-1", "alarm-3");
  await expect.poll(() => order(page)).toEqual(["alarm-2", "alarm-3", "alarm-1"]);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(["alarm-2", "alarm-3", "alarm-1"]);
  await drag(page, "alarm-1", "alarm-2");
  await expect.poll(() => order(page)).toEqual(["alarm-1", "alarm-2", "alarm-3"]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms)).toEqual(before);
  await page.getByRole("button", { name: "Edit alarm at 1:00 AM", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save alarm", exact: true })).toBeVisible();
});

test("a failed reorder restores the previous order and can be retried", async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      Storage.prototype.setItem = original;
      if (key === "daybreak.state.v1") throw new Error("Could not save alarm order");
      original.call(this, key, value);
    };
  });
  await drag(page, "alarm-1", "alarm-3");
  await expect(page.getByRole("alert")).toHaveText("Could not save alarm order");
  await expect.poll(() => order(page)).toEqual(["alarm-1", "alarm-2", "alarm-3"]);
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await drag(page, "alarm-3", "alarm-1");
  await expect.poll(() => order(page)).toEqual(["alarm-3", "alarm-1", "alarm-2"]);
});

test("holding at the list edge scrolls to alarms beyond the viewport", async ({ page }) => {
  await seed(page, 8);
  const source = await page.getByTestId("alarm-record-alarm-1").boundingBox();
  const list = await page.getByTestId("alarm-list").boundingBox();
  await page.mouse.move(source!.x + 80, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.move(source!.x + 80, list!.y + list!.height - 15, { steps: 15 });
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await expect.poll(async () => (await order(page)).at(-1)).toBe("alarm-1");
});

test("ordinary scrolling does not reorder or open an alarm", async ({ page }) => {
  await seed(page, 8);
  const before = await order(page);
  const list = page.getByTestId("alarm-list");
  await list.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  expect(await order(page)).toEqual(before);
  await expect(page.getByText("Your mornings", { exact: true })).toBeVisible();
});
