import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const route = "/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p";
const output = path.resolve("docs/05-architecture/phase-4-evidence/operational-map-runtime");
fs.mkdirSync(output, { recursive: true });
const configurations = [
  { id: "desktop-sang", viewport: { width: 1440, height: 900 }, theme: "light" },
  { id: "tablet-toi", viewport: { width: 768, height: 1024 }, theme: "dark" },
  { id: "mobile-sang", viewport: { width: 390, height: 844 }, theme: "light" },
];
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const results = [];

for (const configuration of configurations) {
  const context = await browser.newContext({ viewport: configuration.viewport });
  const page = await context.newPage();
  const browserErrors = [];
  const failedResources = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource"))
      browserErrors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResources.push({ status: response.status(), url: response.url() });
  });
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill("Trần Quốc Thuận");
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Bản đồ tác nghiệp", level: 1 }).waitFor();
  await page.locator(".om-canvas canvas.maplibregl-canvas").waitFor({ state: "visible" });
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vndms-theme", theme);
  }, configuration.theme);
  const zoomOut = page.getByRole("button", { name: "Thu nhỏ" });
  for (let index = 0; index < 9; index += 1) {
    await zoomOut.click();
    await page.waitForTimeout(240);
  }
  await page.waitForTimeout(1800);
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector(".om-canvas canvas");
    const mapZone = document.querySelector(".om-map-zone");
    const panel = document.querySelector(".om-panel");
    const rect = canvas?.getBoundingClientRect();
    return {
      canvas: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      mapZoneHeight: mapZone?.getBoundingClientRect().height ?? 0,
      panelHeight: panel?.getBoundingClientRect().height ?? 0,
      mapAndPanelAligned: Math.abs((mapZone?.getBoundingClientRect().height ?? 0) - (panel?.getBoundingClientRect().height ?? 0)) <= 2,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      workerUrlContractLoaded: Boolean([...performance.getEntriesByType("resource")].some((entry) => entry.name.includes("/maplibre/maplibre-gl-worker.mjs"))),
      renderedCanvas: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
    };
  });
  const screenshot = path.join(output, `${configuration.id}.png`);
  await page.screenshot({ path: screenshot });
  results.push({ ...configuration, screenshot: path.relative(process.cwd(), screenshot), browserErrors, failedResources, ...metrics });
  await context.close();
}
await browser.close();
const failures = results.filter((result) => result.browserErrors.length > 0 || !result.canvas || !result.renderedCanvas || result.horizontalOverflow);
const summary = {
  generatedAt: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "FAIL",
  checks: results.length,
  failures: failures.length,
  route,
  note: "Ảnh runtime thật sau khi thu nhỏ tới MAP_MIN_ZOOM; dùng để kiểm tra trực quan nhãn Point Hoàng Sa/Trường Sa, collision, lớp nền và responsive trong workspace sản phẩm.",
  results,
};
fs.writeFileSync(path.join(output, "phase-4-operational-map-runtime.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== "PASS") process.exitCode = 1;
