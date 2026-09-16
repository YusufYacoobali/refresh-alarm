import { test, expect } from "@playwright/test";

test("wheel editing saves multiple missions with individual difficulties and snooze off", async ({ page }) => {
  await page.goto("/alarm");
  await page.getByLabel("Alarm hour", { exact: true }).press("ArrowDown");
  await page.getByRole("button", { name: "Set minutes to 20", exact: true }).click();
  await expect(page.getByLabel("Alarm minute", { exact: true })).toHaveAttribute("aria-valuenow", "20");
  await expect.poll(() => page.getByTestId("wheel-minute").evaluate(el => el.scrollTop)).toBe(800);
  await page.getByRole("button", { name: "Set minutes to 00", exact: true }).click();
  await expect.poll(() => page.getByTestId("wheel-minute").evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "PM", exact: true }).click();
  await expect(page.getByRole("button", { name: "PM", exact: true })).toHaveAttribute("aria-pressed", "true");
  const wheel = page.getByTestId("wheel-minute");
  await wheel.hover();
  await page.mouse.wheel(0, 80);
  await expect(page.getByLabel("Alarm minute", { exact: true })).toHaveAttribute("aria-valuenow", "2");
  await page.getByLabel("Alarm label", { exact: true }).fill("My mission morning");
  await page.getByRole("button", { name: /More options/ }).click();
  await page.getByRole("button", { name: "Off", exact: true }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await page.getByRole("button", { name: "Math puzzle", exact: true }).click();
  await page.getByRole("button", { name: "Math puzzle Hard", exact: true }).click();
  await page.getByRole("button", { name: "Memory match", exact: true }).click();
  await page.getByRole("button", { name: "Shake to wake", exact: true }).click();
  await page.getByRole("button", { name: "Shake to wake Hard", exact: true }).click();
  await expect(page.getByText("3 multiplication questions")).toBeVisible();
  await expect(page.getByText("20 separate shakes")).toBeVisible();
  await page.getByRole("button", { name: "Use 3 missions", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  const alarm = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0]);
  expect(alarm.hour).toBe(20);
  expect(alarm.minute).toBe(2);
  expect(alarm.snooze).toBe(0);
  expect(alarm.missions).toEqual([{ kind: "math", difficulty: "bright" }, { kind: "memory", difficulty: "gentle" }, { kind: "shake", difficulty: "bright" }]);
  await page.reload();
  await page.getByRole("button", { name: "Edit My mission morning at 8:02", exact: true }).click();
  await page.getByRole("button", { name: /More options/ }).click();
  await expect(page.getByRole("button", { name: "Off", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByRole("button", { name: "Math puzzle Hard", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Memory match Easy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto(`/ringing?id=${alarm.id}`);
  await expect(page.getByRole("button", { name: /A little longer/ })).toHaveCount(0);
});

test("wheel endpoints center at full opacity, adjacent numbers tap, and scrolling glides", async ({ page }) => {
  await page.goto("/alarm");
  const hour = page.getByLabel("Alarm hour", { exact: true });
  const wheel = page.getByTestId("wheel-hour");
  await expect.poll(() => wheel.evaluate(el => el.scrollTop)).toBe(240);
  await wheel.hover();
  // Capture the actual scroll positions, not just the eventual selected value.
  await wheel.evaluate(el => {
    (window as any).wheelPositions = [];
    el.addEventListener("scroll", () => (window as any).wheelPositions.push(el.scrollTop));
  });
  await page.mouse.wheel(0, -1000);
  await expect(hour).toHaveAttribute("aria-valuetext", "01");
  await expect.poll(() => wheel.evaluate(el => el.scrollTop)).toBe(0);
  const positions = await page.evaluate(() => (window as any).wheelPositions as number[]);
  expect(positions.some(y => y > 0 && y < 240)).toBe(true);
  const first = page.getByTestId("wheel-hour-row-0");
  await expect(first.locator(":scope > div")).toHaveCSS("opacity", "1");
  const assertCentered = async (index: number) => {
    await expect.poll(async () => {
      const row = await page.getByTestId(`wheel-hour-row-${index}`).boundingBox();
      const box = await wheel.boundingBox();
      return Math.abs(row!.y + row!.height / 2 - (box!.y + box!.height / 2));
    }).toBeLessThan(1);
  };
  await assertCentered(0);
  for (const index of [1, 2]) {
    await page.getByTestId(`wheel-hour-row-${index}`).click();
    await expect(hour).toHaveAttribute("aria-valuetext", String(index + 1).padStart(2, "0"));
    await assertCentered(index);
    await expect(page.getByTestId(`wheel-hour-row-${index}`).locator(":scope > div")).toHaveCSS("opacity", "1");
  }
  await wheel.hover();
  await page.mouse.wheel(0, 1000);
  await expect(hour).toHaveAttribute("aria-valuetext", "12");
  await assertCentered(11);
  const bounds = (await wheel.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 95, { steps: 8 });
  await page.mouse.up();
  await expect(hour).not.toHaveAttribute("aria-valuetext", "12");
  await expect.poll(async () => (await wheel.evaluate(el => el.scrollTop)) % 40).toBe(0);
  await assertCentered(Number(await hour.getAttribute("aria-valuenow")));
  await page.getByRole("button", { name: "Set minutes to 58", exact: true }).click();
  await page.getByTestId("wheel-minute-row-59").click();
  await expect(page.getByLabel("Alarm minute", { exact: true })).toHaveAttribute("aria-valuetext", "59");
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].minute)).toBe(59);
});

test("the full mission sequence finishes only after the last mission", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("daybreak.state.v1")) localStorage.setItem("daybreak.state.v1", JSON.stringify({ version: 1, onboarded: true, theme: "serene", journal: [], completions: [], alarms: [{ id: "sequence", hour: 23, minute: 59, days: [], label: "Three little wins", enabled: true, sound: "system", challenge: "math", difficulty: "gentle", snooze: 0, missions: [{ kind: "math", difficulty: "bright" }, { kind: "memory", difficulty: "gentle" }, { kind: "shake", difficulty: "gentle" }] }] }));
  });
  await page.goto("/challenge?id=sequence");
  await expect(page.getByText("Mission 1 of 3 · Math puzzle")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("math-question")).toHaveText(/^\d+ × \d+$/, { useInnerText: true });
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("×").map(Number);
    await page.getByRole("button", { name: `Answer ${a * b}`, exact: true }).click();
  }
  await expect(page.getByText("Mission 2 of 3 · Memory match")).toBeVisible();
  const pairs: Record<string, number[]> = {};
  for (let i = 1; i <= 8; i++) {
    const label = await page.getByRole("button", { name: new RegExp(`^Card ${i}:`) }).getAttribute("aria-label");
    (pairs[label!.split(": ")[1]] ??= []).push(i);
  }
  await page.getByRole("button", { name: "Reveal card 1", exact: true }).waitFor();
  for (const pair of Object.values(pairs)) {
    for (const i of pair) await page.getByRole("button", { name: `Reveal card ${i}`, exact: true }).click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText("Mission 3 of 3 · Shake to wake")).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(before.completions).toHaveLength(0);
  expect(before.alarms[0].enabled).toBe(true);
  // Browser hardware fallback still completes this slot, rather than restarting the queue.
  await page.getByRole("button", { name: /Prefer not to shake/ }).click();
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/, { useInnerText: true });
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
  await expect(page.getByText("First win of the day.")).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(after.completions).toHaveLength(1);
  expect(after.alarms[0].enabled).toBe(false);
});
