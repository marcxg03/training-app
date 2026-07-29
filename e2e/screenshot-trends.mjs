// Authed screenshot driver for build verification. Seeds the e2e user first:
//   node --env-file=.env.local e2e/_setup/seed-auth.mjs > /tmp/e2e-auth.json
//   node --env-file=.env.local e2e/_setup/prep-profile.mjs <userId>
// Then: node e2e/screenshot-trends.mjs <path> [outPrefix]
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const target = process.argv[2] ?? "/trends";
const prefix = process.argv[3] ?? "trends";
const auth = JSON.parse(readFileSync("/tmp/e2e-auth.json", "utf8"));

const browser = await chromium.launch();
const context = await browser.newContext();
await context.addCookies(
  auth.cookies.map((c) => ({
    ...c,
    domain: "localhost",
    path: "/",
  })),
);

for (const [name, viewport] of [
  ["mobile", { width: 390, height: 844 }],
  ["desktop", { width: 1280, height: 800 }],
]) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const response = await page.goto(`http://localhost:3000${target}`, {
    waitUntil: "networkidle",
  });
  console.log(`${name}: HTTP ${response.status()} url=${page.url()}`);
  await page.screenshot({
    path: `/tmp/shot-${prefix}-${name}.png`,
    fullPage: true,
  });
  await page.close();
}

await browser.close();
console.log("done");
