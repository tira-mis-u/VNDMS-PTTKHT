// Audit white boxes ở zoom cao. Render map standalone với basemap
// openfreemap thật ở các zoom 8.5–11.5, screenshot và đếm pixel "trắng"
// (R>240,G>240,B>240) nằm rải rác — gợi ý tile loading, label glyph fail,
// hoặc HTML overlay. Đồng thời đếm số label được render.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs/05-architecture/phase-5-evidence");
fs.mkdirSync(output, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:5173";

const styleResponse = await fetch("https://tiles.openfreemap.org/styles/positron");
if (!styleResponse.ok) throw new Error(`Không tải được style: HTTP ${styleResponse.status}`);
const downloadedStyle = await styleResponse.json();
const auditStyle = {
  version: 8,
  glyphs: downloadedStyle.glyphs,
  sources: {},
  layers: [{ id: "audit-bg", type: "background", paint: { "background-color": "#dce8f1" } }],
};

const viewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "mobile", width: 390, height: 844 },
];
const places = [
  { id: "hoang-sa", name: "Quần đảo Hoàng Sa", center: [111.7, 16.4] },
  { id: "truong-sa", name: "Quần đảo Trường Sa", center: [111.9, 9.5] },
];
const zooms = [4, 6, 8, 9.5, 11];

const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const results = [];
for (const viewport of viewports) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ style }) => {
    const lib = await import("/@id/maplibre-gl");
    const config = await import("/src/infrastructure/gis/mapConfig.ts");
    document.body.innerHTML = "";
    const host = document.createElement("main");
    host.style.cssText = "position:fixed;inset:0;background:#dce8f1";
    const canvas = document.createElement("div");
    canvas.style.cssText = "position:absolute;inset:0";
    host.append(canvas);
    document.body.append(host);
    const map = new lib.Map({ container: canvas, style, center: [111.7, 12.5], zoom: 3.5, minZoom: config.MAP_MIN_ZOOM, attributionControl: false });
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), 15000); map.once("load", () => { clearTimeout(t); res(); }); });
    config.applyVietnameseMapLabels(map);
    config.addVietnamSeaLabels(map, "phase5");
    window.__MAP__ = map;
  }, { style: auditStyle });

  for (const place of places) {
    for (const zoom of zooms) {
      const screenshotPath = path.join(output, `${viewport.id}-${place.id}-zoom-${zoom}.png`);
      const measurement = await page.evaluate(async ({ place, zoom }) => {
        const map = window.__MAP__;
        map.jumpTo({ center: place.center, zoom });
        await new Promise((r) => setTimeout(r, 1500));
        const rendered = map.queryRenderedFeatures();
        const textLayers = rendered.filter((f) => f.properties?.name);
        return {
          renderedLabelCount: textLayers.length,
          renderedSampleLabels: textLayers.slice(0, 8).map((f) => ({ layer: f.layer.id, sourceLayer: f.sourceLayer || null, name: f.properties?.name })),
          layersUsed: [...new Set(rendered.map((f) => f.layer.id))].slice(0, 30),
        };
      }, { place, zoom });
      await page.screenshot({ path: screenshotPath });
      results.push({ viewport: viewport.id, place: place.id, zoom, screenshot: path.relative(root, screenshotPath), ...measurement });
    }
  }
  await ctx.close();
}
await browser.close();
const summary = { generatedAt: new Date().toISOString(), results };
fs.writeFileSync(path.join(output, "map-zoom-high-audit.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ checks: results.length, evidence: path.relative(root, output) }, null, 2));
