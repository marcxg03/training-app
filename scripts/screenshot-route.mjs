import { chromium } from "playwright";
const path = process.argv[2] ?? "/demo";
const label = process.argv[3] ?? "demo";
const browser = await chromium.launch();
for (const [name, width, height] of [["mobile", 390, 900], ["desktop", 1280, 1400]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const res = await page.goto(`http://localhost:3111${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/${label}-${name}.png`, fullPage: true });
  console.log(`${label}-${name}: HTTP ${res.status()} | ${errors.length ? "ERRORS: " + errors.slice(0,3).join(" ; ") : "no console errors"}`);
  await page.close();
}
await browser.close();
