import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, silentMissions?: boolean) {
  await page.addInitScript((silent) => {
    if (!localStorage.getItem("daybreak.state.v1")) localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "mission-audio", hour: 8, minute: 0, days: [], label: "Mission audio", enabled: true,
        sound: "digital_beep", challenge: "math", difficulty: "gentle", snooze: 5, silentMissions: silent,
        missions: [{ kind: "math", difficulty: "gentle" }, { kind: "memory", difficulty: "gentle" }] }],
    }));
  }, silentMissions);
}

async function solveMath(page: Page) {
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId("math-question")).toHaveText(/^\d+ \+ \d+$/, { useInnerText: true });
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
}

async function solveMemory(page: Page) {
  const labels = await page.getByRole("button", { name: /^Card \d:/ }).evaluateAll(cards => cards.map(card => card.getAttribute("aria-label")!));
  expect(labels).toHaveLength(8);
  const pairs: Record<string, string[]> = {};
  for (const label of labels) (pairs[label.split(": ")[1]] ??= []).push(label.match(/^Card (\d+)/)![1]);
  await page.getByRole("button", { name: "Reveal card 1", exact: true }).waitFor();
  for (const [index, pair] of Object.values(pairs).entries()) {
    for (const i of pair) await page.getByRole("button", { name: `Reveal card ${i}`, exact: true }).click();
    if (index < 3) await expect(page.getByRole("button", { name: new RegExp(`^Card ${pair[0]}: .*, matched$`) })).toBeVisible();
  }
}

test("silent missions mute across mission changes, can be unmuted, and finish cleanly", async ({ page }) => {
  await seed(page, true);
  await page.goto("/ringing?id=mission-audio");
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByRole("button", { name: "Turn mission sound on", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "I need to stop this alarm", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finish waking up", exact: true })).toHaveCount(0);
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Turn mission sound on", exact: true }).click();
  await expect(page.locator("audio[data-alarm='true']")).toHaveCount(1);
  await expect.poll(() => page.locator("audio").evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Silence mission sound", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await solveMemory(page);
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.alarms[0].enabled).toBe(false);
  expect(saved.completions).toHaveLength(1);
});

test("mission sound preference survives saving and reopening the editor", async ({ page }) => {
  await page.goto("/alarm");
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  const toggle = page.getByRole("switch", { name: "Silent during missions", exact: true });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Edit alarm at/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await expect(toggle).not.toBeChecked();
});

test("a failed dismissal remains retryable without replaying missions", async ({ page }) => {
  await seed(page, true);
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "daybreak.state.v1" && (window as any).failFinish) {
        (window as any).failFinish = false;
        throw new Error("Could not save completion");
      }
      return write.call(this, key, value);
    };
  });
  await page.goto("/challenge?id=mission-audio");
  await solveMath(page);
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).failFinish = true; });
  await solveMemory(page);
  await expect(page.getByRole("alert")).toHaveText("Could not save completion");
  await page.getByRole("button", { name: "Dismiss message", exact: true }).click();
  await page.getByRole("button", { name: "Finish waking up", exact: true }).click();
  await expect(page.getByText("First win of the day.")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("mission sound defaults off and remembers both choices after reopening", async ({ page }) => {
  await seed(page);
  await page.goto("/challenge?id=mission-audio");
  await expect(page.getByRole("button", { name: "Turn mission sound on", exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Turn mission sound on", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].silentMissions)).toBe(false);
  await page.reload();
  await expect(page.getByRole("button", { name: "Silence mission sound", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Silence mission sound", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!).alarms[0].silentMissions)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Turn mission sound on", exact: true })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
});

test("all mission controls fit a small phone without extra sections", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const kind of ["math", "memory", "shake"]) {
    await page.goto(`/challenge?id=demo&preview=1&kind=${kind}`);
    await expect(page.getByRole("button", { name: "Turn mission sound on", exact: true })).toBeInViewport();
    await expect(page.getByText("WAKE-UP MISSION", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No activity for 1 minute? Your alarm will ring again.")).toHaveCount(0);
    if (kind === "math") await expect(page.getByRole("button", { name: /^Answer / }).last()).toBeInViewport();
    if (kind === "memory") await expect(page.getByRole("button", { name: /^(Card 8:|Reveal card 8)/ })).toBeInViewport();
    if (kind === "shake") await expect(page.getByRole("button", { name: "Preview a shake", exact: true })).toBeInViewport();
    await page.screenshot({ path: `artifacts/mission-${kind}-minimal.png` });
  }
});

test("mission previews play sound when enabled and remember it across missions", async ({ page }) => {
  await page.goto("/challenge?id=demo&preview=1&kind=math");
  await page.getByRole("button", { name: "Turn mission sound on", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(1);
  await expect.poll(() => page.locator("audio").evaluate(el => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.goto("/challenge?id=demo&preview=1&kind=memory");
  await expect(page.getByRole("button", { name: "Silence mission sound", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Silence mission sound", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Turn mission sound on", exact: true })).toBeVisible();
});
