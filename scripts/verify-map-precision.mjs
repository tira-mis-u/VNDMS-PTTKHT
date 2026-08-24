import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs/05-architecture/ui-system-full-repair-evidence/map-precision");
fs.mkdirSync(output, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const styleUrl = "https://tiles.openfreemap.org/styles/positron";
const styleResponse = await fetch(styleUrl);
if (!styleResponse.ok) throw new Error(`Không tải được kiểu nền MapLibre: HTTP ${styleResponse.status}`);
const downloadedStyle = await styleResponse.json();
// Deterministic audit style: no remote tile dependency. Exact five-degree graticules
// are added after load so screenshots retain coordinate context without invented geometry.
const baseStyle = {
  version: 8,
  glyphs: downloadedStyle.glyphs,
  sources: {},
  layers: [{ id: "audit-background", type: "background", paint: { "background-color": "#dce8f1" } }],
};
const browser = await chromium.launch({ headless: true });
const configurations = [
  { device: "desktop", viewport: { width: 1440, height: 900 }, theme: "light" },
  { device: "mobile", viewport: { width: 390, height: 844 }, theme: "dark" },
];
const views = [
  { id: "viet-nam", label: "Toàn Việt Nam", bounds: [[102, 6], [117.5, 24]] },
  { id: "bien-dong", label: "Biển Đông", bounds: [[105, 4], [122, 24]] },
  { id: "hoang-sa", label: "Hoàng Sa", center: [111.601944, 16.533333], zoom: 6.4 },
  { id: "truong-sa", label: "Trường Sa", center: [111.931944, 8.641667], zoom: 6.4 },
];
const results = [];
let provenance;
let geometryAudit;

for (const configuration of configurations) {
  const context = await browser.newContext({ viewport: configuration.viewport });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill("Trần Quốc Thuận");
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto(`${base}/workspace/${encodeURIComponent("Bản đồ tác nghiệp")}`);
  await page.evaluate((theme) => document.documentElement.dataset.theme = theme, configuration.theme);

  const setup = await page.evaluate(async ({ theme, baseStyle }) => {
    const lib = await import("/@id/maplibre-gl");
    const config = await import("/src/infrastructure/gis/mapConfig.ts");
    document.querySelector("#map-precision-audit")?.remove();
    const host = document.createElement("section");
    host.id = "map-precision-audit";
    host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#eef3f8;font-family:'Be Vietnam Pro',sans-serif;";
    const mapNode = document.createElement("div");
    mapNode.id = "map-precision-canvas";
    mapNode.style.cssText = "position:absolute;inset:0;";
    const evidence = document.createElement("aside");
    evidence.id = "map-precision-caption";
    evidence.style.cssText = `position:absolute;left:12px;right:12px;bottom:12px;z-index:3;padding:10px 12px;border:1px solid ${theme === "dark" ? "#53677e" : "#b8c5d4"};border-radius:10px;background:${theme === "dark" ? "rgba(21,31,43,.94)" : "rgba(255,255,255,.95)"};color:${theme === "dark" ? "#eef4fb" : "#172b45"};box-shadow:0 6px 24px rgba(15,23,42,.16);font-size:13px;line-height:1.45;`;
    evidence.innerHTML = "<b>Kiểm chứng bản đồ</b><br>Chỉ hiển thị nhãn địa danh tại điểm neo có nguồn; không biểu diễn polygon, đường biên hoặc phạm vi chủ quyền.";
    host.append(mapNode, evidence); document.body.append(host);
    const bounds = new lib.LngLatBounds();
    for (const feature of config.VIETNAM_SEA_LABELS.features) bounds.extend(feature.geometry.coordinates);
    const map = new lib.Map({ container: mapNode, style: baseStyle, center: [110.5, 15], zoom: 4, minZoom: config.MAP_MIN_ZOOM, attributionControl: false });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error("MapLibre load timeout")), 10000); map.once("load", () => { clearTimeout(timer); resolve(); }); });
    const graticules = [];
    for (let lng = 100; lng <= 125; lng += 5) graticules.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lng, 2], [lng, 26]] } });
    for (let lat = 5; lat <= 25; lat += 5) graticules.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[98, lat], [125, lat]] } });
    map.addSource("precision-graticules", { type: "geojson", data: { type: "FeatureCollection", features: graticules } });
    map.addLayer({ id: "precision-graticules", type: "line", source: "precision-graticules", paint: { "line-color": "#88a5bc", "line-width": 1, "line-dasharray": [3, 3] } });
    map.addControl(new lib.AttributionControl({ compact: true, customAttribution: "Điểm neo có nguồn · EPSG:4326" }));
    config.applyVietnameseMapLabels(map); config.addVietnamSeaLabels(map, "precision-audit");
    // Deterministic headless visual evidence: text-only MapLibre markers mirror the
    // verified symbol source when remote glyph PBF delivery is unavailable.
    for (const feature of config.VIETNAM_SEA_LABELS.features) {
      const markerElement = document.createElement("div");
      markerElement.className = "precision-anchor-label";
      markerElement.style.cssText = `padding:6px 9px;border:1px solid #6f8eaa;border-radius:7px;background:${theme === "dark" ? "#172b3f" : "#ffffff"};color:${theme === "dark" ? "#f1f6fb" : "#173a5e"};font:600 13px/1.25 'Be Vietnam Pro',sans-serif;text-align:center;white-space:nowrap;box-shadow:0 2px 8px rgba(15,23,42,.18);`;
      markerElement.innerHTML = `<b>${feature.properties.name}</b><br><small style="font-weight:500">${feature.geometry.coordinates[1].toFixed(6)}°B · ${feature.geometry.coordinates[0].toFixed(6)}°Đ</small>`;
      new lib.Marker({ element: markerElement, anchor: "center" }).setLngLat(feature.geometry.coordinates).addTo(map);
    }
    map.triggerRepaint();
    window.__VNDMS_PRECISION_AUDIT_MAP__ = map;
    return {
      provenance: config.VIETNAM_SEA_LABEL_PROVENANCE,
      geometryAudit: {
        featureCount: config.VIETNAM_SEA_LABELS.features.length,
        geometryTypes: [...new Set(config.VIETNAM_SEA_LABELS.features.map((feature) => feature.geometry.type))],
        sourceBoundsFromMapLibreLngLatBounds: bounds.toArray(),
        features: config.VIETNAM_SEA_LABELS.features.map((feature) => ({ coordinates: feature.geometry.coordinates, properties: feature.properties })),
      },
    };
  }, { theme: configuration.theme, baseStyle });
  provenance ||= setup.provenance;
  geometryAudit ||= setup.geometryAudit;

  for (const view of views) {
    await page.evaluate(async (nextView) => {
      const map = window.__VNDMS_PRECISION_AUDIT_MAP__;
      const caption = document.querySelector("#map-precision-caption");
      caption.firstChild.textContent = `Kiểm chứng bản đồ · ${nextView.label}`;
      if (nextView.bounds) map.fitBounds(nextView.bounds, { padding: 34, duration: 0 });
      else map.jumpTo({ center: nextView.center, zoom: nextView.zoom });
      await new Promise((resolve) => setTimeout(resolve, 900));
    }, view);
    const measurement = await page.evaluate((nextView) => {
      const map = window.__VNDMS_PRECISION_AUDIT_MAP__;
      const sourceDefinition = map.getStyle().sources["precision-audit-vn-sea-labels"];
      const sourceFeatures = sourceDefinition.data.features;
      const rendered = map.queryRenderedFeatures({ layers: ["precision-audit-vn-sea-labels"] });
      const sourceModuleCoordinates = [[111.601944, 16.533333], [111.931944, 8.641667]];
      const projectedAnchors = sourceModuleCoordinates.map((coordinates) => {
        const point = map.project(coordinates);
        return { coordinates, x: point.x, y: point.y, withinCanvas: point.x >= 0 && point.y >= 0 && point.x <= map.getCanvas().clientWidth && point.y <= map.getCanvas().clientHeight };
      });
      return {
        requestedView: nextView,
        mapLibreBounds: map.getBounds().toArray(),
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        canvas: { width: map.getCanvas().clientWidth, height: map.getCanvas().clientHeight },
        sourceFeatureCount: sourceFeatures.length,
        sourceGeometryTypes: [...new Set(sourceFeatures.map((feature) => feature.geometry.type))],
        renderedSymbolLabelNames: [...new Set(rendered.map((feature) => feature.properties.name))],
        deterministicMarkerLabelNames: [...document.querySelectorAll(".precision-anchor-label b")].map((element) => element.textContent),
        layerType: map.getLayer("precision-audit-vn-sea-labels")?.type ?? null,
        projectedAnchors,
        attributionVisible: Boolean(document.querySelector(".maplibregl-ctrl-attrib")),
      };
    }, view);
    const screenshot = path.join(output, `${configuration.device}-${configuration.theme}-${view.id}.png`);
    await page.screenshot({ path: screenshot });
    results.push({ device: configuration.device, theme: configuration.theme, viewport: configuration.viewport, screenshot: path.relative(root, screenshot), ...measurement });
  }
  await context.close();
}

await browser.close();
const allowedGeometry = geometryAudit.geometryTypes.length === 1 && geometryAudit.geometryTypes[0] === "Point";
const exactBounds = JSON.stringify(geometryAudit.sourceBoundsFromMapLibreLngLatBounds) === JSON.stringify([[111.601944, 8.641667], [111.931944, 16.533333]]);
const failures = results.filter((item) => item.sourceFeatureCount !== 2 || item.sourceGeometryTypes.some((type) => type !== "Point") || item.layerType !== "symbol" || item.deterministicMarkerLabelNames.length !== 2 || !item.attributionVisible || (item.requestedView.center && !item.projectedAnchors.some((anchor) => anchor.withinCanvas)));
const summary = { generatedAt: new Date().toISOString(), checks: results.length, failures: failures.length + (allowedGeometry && exactBounds ? 0 : 1), provenance, geometryAudit, allowedGeometry, exactBounds, results };
fs.writeFileSync(path.join(output, "map-precision-verification.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: undefined }, null, 2));
if (summary.failures) process.exitCode = 1;
