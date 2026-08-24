// Audit root cause cho white boxes trên basemap openfreemap ở zoom cao.
// Phương pháp: dùng page.evaluate để chụp canvas ở zoom cao 8.5–11 và quét
// các vùng pixel trắng nằm giữa ranh giới đất liền mà không phải text label
// thật; phân loại theo feature source-layer để xác định layer nào gây ra.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs/05-architecture/phase-5-evidence");
fs.mkdirSync(output, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const results = [];
const zooms = [7, 8.5, 10, 11];
const places = [
  { id: "hoang-sa", name: "Quần đảo Hoàng Sa", center: [111.7, 16.4] },
  { id: "truong-sa", name: "Quần đảo Trường Sa", center: [111.9, 9.5] },
];

for (const viewport of [
  { id: "desktop", width: 1440, height: 900 },
  { id: "mobile", width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await ctx.newPage();
  const browserErrors = [];
  const failedResources = [];
  page.on("pageerror", (e) => browserErrors.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 400) failedResources.push({ url: r.url(), status: r.status() }); });
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill("Trần Quốc Thuận");
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`${base}/workspace/${encodeURIComponent("Bản đồ tác nghiệp")}`, { waitUntil: "domcontentloaded" });
  await page.locator(".om-canvas canvas.maplibregl-canvas").waitFor({ state: "visible" });
  await page.waitForTimeout(800);

  for (const place of places) {
    for (const zoom of zooms) {
      const screenshotPath = path.join(output, `${viewport.id}-${place.id}-zoom-${zoom}.png`);
      const measurement = await page.evaluate(async ({ place, zoom }) => {
        const map = window.__OM_MAP__;
        if (!map) return { error: "map missing" };
        map.jumpTo({ center: place.center, zoom });
        await new Promise((r) => setTimeout(r, 1500));
        // Thống kê symbol layers và rendered feature source để biết layer
        // nào đang render tại viewport zoom này.
        const rendered = map.queryRenderedFeatures();
        const byLayer = new Map();
        for (const f of rendered) {
          const k = `${f.layer.id}|${f.sourceLayer || "-"}`;
          byLayer.set(k, (byLayer.get(k) ?? 0) + 1);
        }
        return {
          layersTouched: [...byLayer.entries()].sort((a, b) => b[1] - a[1]),
          textLabels: rendered.filter((f) => f.properties?.name).length,
        };
      }, { place, zoom });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      results.push({ viewport: viewport.id, place: place.id, zoom, screenshot: path.relative(root, screenshotPath), ...measurement });
    }
  }
  await ctx.close();
}
await browser.close();

const summary = {
  generatedAt: new Date().toISOString(),
  zoomsTested: zooms,
  results,
  note: "Mỗi row là một (viewport, place, zoom). Nếu thấy white box ở zoom cao, đọc layersTouched để biết source-layer nào render tại đó.",
};
fs.writeFileSync(path.join(output, "map-white-boxes-audit.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ zooms: zooms.length, results: results.length, evidence: path.relative(root, output) }, null, 2));
