import { test, expect } from "@playwright/test";

test("a scheduled one-off rings with one action and is disabled on completion", async ({
  page,
}) => {
  const time = new Date(2026, 8, 15, 7, 59, 0);
  await page.clock.install({ time });
  await page.goto("/");
  await page.evaluate(
    (nextAt) =>
      localStorage.setItem(
        "daybreak.state.v1",
        JSON.stringify({
          version: 1,
          onboarded: true,
          theme: "serene",
          journal: [],
          completions: [],
          alarms: [
            {
              id: "scheduled-test",
              hour: 8,
              minute: 0,
              days: [],
              label: "Scheduled morning",
              enabled: true,
              sound: "system",
              challenge: "none",
              difficulty: "gentle",
              snooze: 5,
              nextAt,
              registration: { kind: "preview", ids: [] },
            },
          ],
        }),
      ),
    +time + 60000,
  );
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Alarms", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(
    page.getByTestId("alarm-wallpaper-screen").getByText("Scheduled morning", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Snooze/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hello, new day", exact: true })
    .click();
  await expect(
    page.getByText("First win of the day.", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("daybreak.state.v1")!),
  );
  expect(saved.alarms[0].enabled).toBe(false);
  expect(saved.snoozed).toBeUndefined();
  expect(saved.completions).toHaveLength(1);
});

test("failed storage preserves the alarm draft and allows retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "daybreak.state.v1" && (window as any).failNextSave) {
        (window as any).failNextSave = false;
        throw new Error("Test storage failure");
      }
      return original.call(this, key, value);
    };
  });
  await page.goto("/alarm");
  await page.getByLabel("Alarm minute", { exact: true }).press("ArrowDown");
  await page.evaluate(() => {
    (window as any).failNextSave = true;
  });
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(
    page.getByTestId("save-error"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Alarm minute", { exact: true }),
  ).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit alarm at 7:01 AM", exact: true })).toBeVisible();
});

test("onboarding, alarm editing, persistence, challenges, journal, and deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Refresh my mornings", exact: true }).click();
  await page.getByRole("button", { name: "Make it mine", exact: true }).click();
  await page.getByRole("button", { name: "Let’s set it up", exact: true }).click();
  await page
    .getByRole("button", { name: "Enable alarms", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create an alarm", exact: true })
    .click();
  await page.getByLabel("Alarm hour", { exact: true }).press("ArrowDown");
  for (let i = 0; i < 35; i++) await page.getByLabel("Alarm minute", { exact: true }).press("ArrowDown");
  await expect(page.getByLabel("Alarm minute", { exact: true })).toHaveAttribute("aria-valuenow", "35");
  await expect(page.getByRole("textbox", { name: "Alarm label", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Sound & volume/ }).click();
  await page.getByRole("button", { name: /Choose sound/ }).click();
  await expect(
    page.getByText("Alarm sounds", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select Rooster", exact: true })
    .click();
  await page.screenshot({ path: "artifacts/screenshots/04-sounds.png" });
  await page
    .getByRole("button", { name: "Use this sound", exact: true })
    .click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await page.getByRole("button", { name: "Memory match", exact: true }).click();
  await page.screenshot({ path: "artifacts/screenshots/05-challenges.png" });
  await page
    .getByRole("button", { name: "Use 1 mission", exact: true })
    .click();
  await page.screenshot({ path: "artifacts/screenshots/03-editor.png" });
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit alarm at 8:35 AM", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", {
        name: "Edit alarm at 8:35 AM",
        exact: true,
      })
      .last(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Edit alarm at 8:35 AM", exact: true }),
  ).toBeVisible();
  const alarmSwitch = page.getByRole("switch", { name: "Enable alarm at 8:35 AM" }).last();
  await expect(alarmSwitch).toBeChecked();
  await alarmSwitch.click();
  await expect(alarmSwitch).not.toBeChecked();
  await page.reload();
  await expect(alarmSwitch).not.toBeChecked();
  await alarmSwitch.click();
  await expect(alarmSwitch).toBeChecked();
  await page.getByRole("tab", { name: "Home" }).click();
  await page.screenshot({ path: "artifacts/screenshots/02-home.png" });
  await page.getByRole("tab", { name: "Journal" }).click();
  await page
    .getByRole("textbox", { name: "Morning journal" })
    .fill("A little more light.");
  await page.getByRole("button", { name: /Save my check-in/ }).click();
  await expect(
    page.getByText("Check-in saved", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/08-journal.png" });
  await expect(page.getByRole("tab", { name: "Unwind" })).toHaveCount(0);
  await page.goto("/challenge?id=demo&preview=1&kind=math");
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/, { useInnerText: true });
    const q = await page.getByTestId("math-question").innerText();
    const [a, b] = q.split("+").map(Number);
    await page
      .getByRole("button", { name: `Answer ${a + b}`, exact: true })
      .click();
  }
  await expect(
    page.getByText("First win of the day.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/09-success.png" });
  await page
    .getByRole("button", { name: "Hello, new day", exact: true })
    .click();
  await page.getByRole("tab", { name: "Alarms" }).click();
  await page
    .getByRole("button", { name: "Edit alarm at 8:35 AM", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Delete alarm", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await page.getByRole("button", { name: "More options for alarm at 8:35 AM", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete alarm at 8:35 AM", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm delete alarm at 8:35 AM", exact: true })
    .click();
  await expect(
    page.getByText("A fresh start awaits.", { exact: true }).last(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("memory challenge rewards four real matching pairs", async ({ page }) => {
  await page.goto("/challenge?id=demo&preview=1&kind=memory");
  const pairs: Record<string, number[]> = {};
  for (let i = 1; i <= 8; i++) {
    const label = await page
      .getByRole("button", { name: new RegExp(`^Card ${i}:`) })
      .getAttribute("aria-label");
    const subject = label!.split(": ")[1];
    (pairs[subject] ??= []).push(i);
  }
  await page
    .getByRole("button", { name: "Reveal card 1", exact: true })
    .waitFor();
  await page.screenshot({ path: "artifacts/screenshots/06-memory.png" });
  for (const indexes of Object.values(pairs)) {
    for (const i of indexes)
      await page
        .getByRole("button", { name: `Reveal card ${i}`, exact: true })
        .click();
    if (indexes !== Object.values(pairs).at(-1)) await page.waitForTimeout(400);
  }
  await expect(
    page.getByText("First win of the day.", { exact: true }),
  ).toBeVisible();
});

test("shake preview counts motion demonstrations and offers accessible math", async ({
  page,
}) => {
  await page.goto("/challenge?id=demo&preview=1&kind=shake");
  for (let i = 0; i < 12; i++)
    await page
      .getByRole("button", { name: "Preview a shake", exact: true })
      .click();
  await expect(
    page.getByText("First win of the day.", { exact: true }),
  ).toBeVisible();
  await page.goto("/challenge?id=demo&preview=1&kind=shake");
  await page.getByRole("button", { name: /Prefer not to shake/ }).click();
  await expect(page.getByTestId("math-question")).toBeVisible();
});
