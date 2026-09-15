const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const baseURL = process.env.DAYBREAK_TEST_URL ?? "http://localhost:8081";
(async () => {
  fs.mkdirSync("artifacts/screenshots", { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseURL + "/");
  await page.evaluate(() =>
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
            id: "visual-demo",
            hour: 7,
            minute: 0,
            days: [1, 2, 3, 4, 5],
            label: "Rise & shine",
            enabled: true,
            sound: "morning",
            challenge: "memory",
            difficulty: "gentle",
            snooze: 5,
            registration: { kind: "preview", ids: [] },
          },
        ],
      }),
    ),
  );
  for (const [name, route] of [
    ["01-onboarding", "/onboarding"],
    ["02-home", "/"],
    ["03-editor", "/alarm"],
    ["04-sounds", "/sounds"],
    ["05-challenges", "/challenges"],
    ["08-journal", "/journal"],
    ["09-success", "/success?preview=1"],
    ["10-ringing", "/ringing?id=visual-demo&preview=1"],
    ["11-themes", "/themes"],
  ]) {
    await page.goto(baseURL + route, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(
      () =>
        document.querySelectorAll("img").length === 0 ||
        [...document.querySelectorAll("img")].every((i) => i.complete),
    );
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `artifacts/screenshots/${name}.png`,
      animations: "disabled",
    });
    console.log(
      name,
      await page
        .locator("body")
        .innerText()
        .then((t) => t.slice(0, 80)),
    );
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(baseURL + "/alarm", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page
    .getByRole("button", { name: "Save alarm", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/screenshots/12-small-screen.png" });
  console.log("Runtime errors:", JSON.stringify(errors));
  await browser.close();
})();
