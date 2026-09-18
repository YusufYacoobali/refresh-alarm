import { test, expect, Page } from "@playwright/test";

async function seed(page: Page, kind = "memory", rounds = 3) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(({ kind, rounds }) => {
    if (localStorage.getItem("daybreak.state.v1")) return;
    localStorage.setItem("daybreak.state.v1", JSON.stringify({
      version: 1, onboarded: true, theme: "serene", journal: [], completions: [],
      alarms: [{ id: "rounds", hour: 23, minute: 59, days: [], label: "Round test", enabled: true,
        sound: "system", challenge: kind, difficulty: "gentle", snooze: 0,
        missions: [{ kind, difficulty: "gentle", rounds }, { kind: "math", difficulty: "gentle", rounds: 2 }] }],
    }));
  }, { kind, rounds });
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

async function solveMath(page: Page) {
  for (let i = 0; i < 3; i++) {
    const [a, b] = (await page.getByTestId("math-question").innerText()).split("+").map(Number);
    await page.getByRole("button", { name: `Answer ${a + b}`, exact: true }).click();
  }
}

test("rounds are independent, saved, and used by mission previews", async ({ page }) => {
  await seed(page);
  await page.goto("/alarms");
  await page.getByRole("button", { name: /^Edit Round test/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByTestId("rounds-memory")).toHaveValue("3");
  await expect(page.getByTestId("rounds-math")).toHaveValue("2");
  await page.getByTestId("rounds-memory").selectOption("4");
  await page.getByRole("button", { name: "Preview Memory match", exact: true }).click();
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 4");
  await page.getByRole("button", { name: "Close challenge preview", exact: true }).click();
  await page.getByRole("button", { name: "Use 2 missions", exact: true }).click();
  await page.getByRole("button", { name: "Save alarm", exact: true }).click();
  await expect(page.getByText("Alarm saved. You’re all set.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Edit Round test/ }).click();
  await page.getByRole("button", { name: /Wake-up missions/ }).click();
  await page.getByRole("button", { name: /Choose missions/ }).click();
  await expect(page.getByTestId("rounds-memory")).toHaveValue("4");
  await expect(page.getByTestId("rounds-math")).toHaveValue("2");
});

test("three full memory rounds run before two math rounds and final dismissal", async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/challenge?id=rounds");
  for (let round = 1; round <= 3; round++) {
    await expect(page.getByTestId("mission-round")).toHaveText(`Round ${round} of 3`);
    await expect(page.getByText("Mission 1 of 2", { exact: true })).toBeVisible();
    if (round === 1) await page.screenshot({ path: "artifacts/memory-rounds.png" });
    await solveMemory(page);
  }
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 2");
  await solveMath(page);
  await expect(page.getByTestId("mission-round")).toHaveText("Round 2 of 2");
  await solveMath(page);
  await expect(page.getByText("First win of the day.")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("daybreak.state.v1")!));
  expect(saved.alarms[0].enabled).toBe(false);
  expect(saved.completions).toHaveLength(1);
});

test("a new round resets the minute and timing out restarts from round one", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 17, 6, 0) });
  await seed(page, "shake", 3);
  await page.goto("/challenge?id=rounds");
  await page.getByRole("button", { name: /Prefer not to shake/ }).click();
  await page.clock.fastForward(50_000);
  await solveMath(page);
  await expect(page.getByTestId("mission-round")).toHaveText("Round 2 of 3");
  await expect(page.getByTestId("mission-timer")).toHaveText("1:00");
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 3");
});

test("each supplication round includes all three duas with fresh recitation counts", async ({ page }) => {
  await seed(page, "supplication", 2);
  await page.goto("/challenge?id=rounds");
  for (let round = 1; round <= 2; round++) {
    await expect(page.getByTestId("mission-round")).toHaveText(`Round ${round} of 2`);
    await expect(page.getByTestId("dua-title")).toHaveText("Upon waking");
    for (const count of [1, 3, 3]) {
      if (count === 3) await expect(page.getByTestId("dua-repetitions")).toHaveText("Recite 3 times · 0/3 completed");
      for (let i = 0; i < count; i++) await page.getByRole("button", { name: "I’ve recited it", exact: true }).click();
    }
  }
  await expect(page.getByText("Mission 2 of 2", { exact: true })).toBeVisible();
  await expect(page.getByTestId("math-question")).toBeVisible();
});

test("a timed-out preview retains its selected mission and number of rounds", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 17, 6, 0) });
  await page.goto("/challenge?id=demo&preview=1&kind=memory&rounds=3");
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 3");
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId("alarm-wallpaper-screen")).toBeVisible();
  await page.getByRole("button", { name: "Wake up my mind", exact: true }).click();
  await expect(page.getByText("Match the pairs", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mission-round")).toHaveText("Round 1 of 3");
});
