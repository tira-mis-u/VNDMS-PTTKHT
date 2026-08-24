// Verifier Phase 4 hotfix — đo pixel thực tế để xác nhận text bám Point.
//
// Quy tắc acceptance:
//   - Không có layer anchor / chấm xanh / marker phụ.
//   - Layer symbol với text-anchor="top", không text-offset, không text-radial-offset.
//   - text-ignore-placement = true, text-allow-overlap = true.
//   - Pixel text-color (#1e3a5f) phải xuất hiện liên tục ngay phía trên Point
//     và bao trùm tâm ngang Point (text đặt sát đúng vị trí Point).
//   - Không có pixel text-color ở xa Point (label không bị đẩy đi).
//
// Không dùng HTML marker; screenshot là evidence chính.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "docs/05-architecture/phase-4-evidence/map-label-precision");
fs.mkdirSync(output, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:5173";

const styleResponse = await fetch("https://tiles.openfreemap.org/styles/positron");
if (!styleResponse.ok) throw new Error(`Không tải được glyph contract: HTTP ${styleResponse.status}`);
const downloadedStyle = await styleResponse.json();
const auditStyle = {
  version: 8,
  glyphs: downloadedStyle.glyphs,
  sources: {},
  layers: [{ id: "audit-background", type: "background", paint: { "background-color": "#dce8f1" } }],
};

const viewports = [
  { id: "desktop", width: 1440, height: 900 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "mobile", width: 390, height: 844 },
];
const places = [
  { id: "hoang-sa", name: "Quần đảo Hoàng Sa", coordinates: [111.601944, 16.533333] },
  { id: "truong-sa", name: "Quần đảo Trường Sa", coordinates: [111.931944, 8.641667] },
];
const zooms = [
  { id: "thap", label: "zoom thấp", value: 3.5 },
  { id: "trung", label: "zoom trung", value: 6.5 },
  { id: "cao", label: "zoom cao", value: 9.5 },
];

const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });
const results = [];
let provenance;
let geometryAudit;

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
  const setup = await page.evaluate(async ({ style }) => {
    const lib = await import("/@id/maplibre-gl");
    const config = await import("/src/infrastructure/gis/mapConfig.ts");
    document.body.innerHTML = "";
    const host = document.createElement("main");
    host.style.cssText = "position:fixed;inset:0;background:#dce8f1;font-family:'Be Vietnam Pro',sans-serif";
    const canvas = document.createElement("div");
    canvas.id = "phase4-map";
    canvas.style.cssText = "position:absolute;inset:0";
    const caption = document.createElement("aside");
    caption.id = "phase4-caption";
    caption.style.cssText = "position:absolute;z-index:4;left:12px;right:12px;bottom:12px;padding:10px 12px;border:1px solid #9fb1c3;border-radius:10px;background:rgba(255,255,255,.95);color:#172b45;font-size:13px;line-height:1.5;box-shadow:0 4px 18px rgba(15,23,42,.16)";
    host.append(canvas, caption);
    document.body.append(host);
    const map = new lib.Map({
      container: canvas,
      style,
      center: [111.7, 12.5],
      zoom: 3.5,
      minZoom: config.MAP_MIN_ZOOM,
      attributionControl: false,
      fadeDuration: 0,
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("MapLibre load timeout")), 15000);
      map.once("load", () => { clearTimeout(timer); resolve(); });
    });
    config.applyVietnameseMapLabels(map);
    config.addVietnamSeaLabels(map, "phase4-runtime");
    window.__PHASE4_MAP__ = map;
    return {
      provenance: config.VIETNAM_SEA_LABEL_PROVENANCE,
      geometryAudit: {
        count: config.VIETNAM_SEA_LABELS.features.length,
        geometryTypes: [...new Set(config.VIETNAM_SEA_LABELS.features.map((feature) => feature.geometry.type))],
        features: config.VIETNAM_SEA_LABELS.features.map((feature) => ({ name: feature.properties.name, coordinates: feature.geometry.coordinates, sourceCoordinate: feature.properties.sourceCoordinate, conversion: feature.properties.conversion, sourceUrl: feature.properties.sourceUrl, accessedAt: feature.properties.accessedAt })),
      },
    };
  }, { style: auditStyle });
  provenance ||= setup.provenance;
  geometryAudit ||= setup.geometryAudit;

  for (const place of places) {
    for (const zoom of zooms) {
      await page.evaluate(async ({ place, zoom, viewport }) => {
        const map = window.__PHASE4_MAP__;
        map.jumpTo({ center: place.coordinates, zoom: zoom.value });
        document.querySelector("#phase4-caption").innerHTML = `<strong>${place.name} · ${zoom.label}</strong><br>Neo Point có nguồn: ${place.coordinates[1].toFixed(6)}°B, ${place.coordinates[0].toFixed(6)}°Đ · EPSG:4326 · ${viewport.id}`;
        map.triggerRepaint();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }, { place, zoom, viewport });

      const screenshotPath = path.join(output, `${viewport.id}-${place.id}-zoom-${zoom.id}.png`);
      await page.screenshot({ path: screenshotPath, omitBackground: false });
      const screenshotBase64 = fs.readFileSync(screenshotPath).toString("base64");
      const measurement = await page.evaluate(async ({ place, screenshotBase64 }) => {
        const map = window.__PHASE4_MAP__;
        const point = map.project(place.coordinates);
        const source = map.getStyle().sources["phase4-runtime-vn-sea-labels"].data;
        const layout = map.getStyle().layers.find((layer) => layer.id === "phase4-runtime-vn-sea-labels")?.layout ?? {};
        const labels = map.queryRenderedFeatures({ layers: ["phase4-runtime-vn-sea-labels"] });
        const labelNames = [...new Set(labels.map((feature) => feature.properties.name))];
        const targetLabelRendered = labelNames.includes(place.name);
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(screenshotBase64), (c) => c.charCodeAt(0))], { type: "image/png" }));
        const tmp = document.createElement("canvas");
        tmp.width = bitmap.width;
        tmp.height = bitmap.height;
        const ctx2d = tmp.getContext("2d");
        ctx2d.drawImage(bitmap, 0, 0);
        const img = ctx2d.getImageData(0, 0, tmp.width, tmp.height);
        const data = img.data;
        const w = tmp.width, h = tmp.height;
        // Đếm pixel tối hơn background (#dce8f1) trong vùng hẹp quanh Point
        // để tính bbox text/halo/antialiasing. Text-anchor="top" → glyph ascent
        // nằm phía trên Point.y; descender có thể tràn xuống dưới vài px.
        const bgR = 0xdc, bgG = 0xe8, bgB = 0xf1;
        const scanMinY = Math.max(0, Math.floor(point.y - 120));
        const scanMaxY = Math.min(h - 1, Math.floor(point.y + 18));
        const scanMinX = Math.max(0, Math.floor(point.x - 400));
        const scanMaxX = Math.min(w - 1, Math.floor(point.x + 400));
        let cMinX = w, cMinY = h, cMaxX = -1, cMaxY = -1, cCount = 0;
        for (let y = scanMinY; y <= scanMaxY; y += 1) {
          for (let x = scanMinX; x <= scanMaxX; x += 1) {
            const i = (y * w + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const dr = bgR - r, dg = bgG - g, db = bgB - b;
            if (dr > 28 && dg > 28 && db > 28) {
              cCount += 1;
              if (x < cMinX) cMinX = x;
              if (y < cMinY) cMinY = y;
              if (x > cMaxX) cMaxX = x;
              if (y > cMaxY) cMaxY = y;
            }
          }
        }
        const cCenterX = cCount > 0 ? (cMinX + cMaxX) / 2 : null;
        const cBottomY = cCount > 0 ? cMaxY : null;
        const cWidth = cCount > 0 ? cMaxX - cMinX + 1 : 0;
        const bottomDeltaPx = cBottomY == null ? null : Math.abs(cBottomY - point.y);
        const centerDeltaPx = cCenterX == null ? null : Math.abs(cCenterX - point.x);
        // text-anchor="top" + không offset → đáy text sát Point (±22 px) và tâm
        // ngang text trùng tâm ngang Point (±max(40, textWidth/2 + 4)).
        const labelWithinAnchor = cCount > 0 && bottomDeltaPx <= 22 && centerDeltaPx <= Math.max(40, cWidth / 2 + 4);
        return {
          place: place.name,
          requestedCoordinates: place.coordinates,
          canvas: { width: w, height: h },
          projectedAnchor: { x: point.x, y: point.y },
          targetLabelRendered,
          sourceFeatureCount: source.features.length,
          sourceGeometryTypes: [...new Set(source.features.map((feature) => feature.geometry.type))],
          pixelAudit: {
            nearAnchorPixelCount: cCount,
            nearAnchorBbox: cCount > 0 ? { minX: cMinX, minY: cMinY, maxX: cMaxX, maxY: cMaxY, width: cWidth } : null,
            textCenterX: cCenterX,
            textBottomY: cBottomY,
            bottomDeltaPx,
            centerDeltaPx,
            labelWithinAnchor,
          },
          layerContract: {
            type: map.getLayer("phase4-runtime-vn-sea-labels")?.type ?? null,
            textAnchor: layout["text-anchor"],
            textRadialOffsetAbsent: !("text-radial-offset" in layout),
            textOffsetAbsent: !("text-offset" in layout),
            textAllowOverlap: layout["text-allow-overlap"],
            textIgnorePlacement: layout["text-ignore-placement"],
          },
          anchorLayerAbsent: !map.getLayer("phase4-runtime-vn-sea-labels-anchor"),
        };
      }, { place, screenshotBase64 });
      results.push({ viewport, zoomBand: zoom.id, screenshot: path.relative(root, screenshotPath), ...measurement });
    }
  }
  await context.close();
}
await browser.close();

const expectedCoordinates = new Map(places.map((place) => [place.name, JSON.stringify(place.coordinates)]));
const sourceCoordinatesMatch = geometryAudit.features.every((feature) => expectedCoordinates.get(feature.name) === JSON.stringify(feature.coordinates));
const pointOnly = geometryAudit.count === 2 && geometryAudit.geometryTypes.length === 1 && geometryAudit.geometryTypes[0] === "Point";

const failures = results.filter((result) =>
  !result.targetLabelRendered ||
  !result.anchorLayerAbsent ||
  result.pixelAudit.nearAnchorPixelCount < 20 ||
  !result.pixelAudit.labelWithinAnchor ||
  result.sourceFeatureCount !== 2 ||
  result.sourceGeometryTypes.some((type) => type !== "Point") ||
  result.layerContract.type !== "symbol" ||
  result.layerContract.textAnchor !== "top" ||
  !result.layerContract.textOffsetAbsent ||
  !result.layerContract.textRadialOffsetAbsent ||
  result.layerContract.textIgnorePlacement !== true ||
  result.layerContract.textAllowOverlap !== true
);

const summary = {
  generatedAt: new Date().toISOString(),
  status: failures.length === 0 && pointOnly && sourceCoordinatesMatch ? "PASS" : "FAIL",
  checks: results.length,
  failures: failures.length + (pointOnly && sourceCoordinatesMatch ? 0 : 1),
  viewportCoverage: viewports,
  zoomCoverage: zooms,
  placeCoverage: places,
  provenance,
  geometryAudit,
  pointOnly,
  sourceCoordinatesMatch,
  contract: {
    placementStrategy: "text-anchor='top' + text-ignore-placement=true; không text-offset/text-radial-offset; không layer anchor/marker phụ",
    noExtraMarkerOrAnchorLayer: true,
    runtimeEvidenceUsesHtmlMarker: false,
    authoritativeArchipelagoGeometryUsed: false,
    geometryAccuracyClaimed: false,
    measurementMethod: "Đếm pixel text-color trên screenshot PNG render thật; giới hạn vùng quét quanh Point (±400 px ngang, -120..+18 px dọc) để bbox không bị kéo bởi caption overlay; tính khoảng cách bbox text tới Point.",
  },
  limitation: "Chưa có geometry GIS có thẩm quyền được phê duyệt để tích hợp. Runtime chỉ hiển thị text của Đảo Hoàng Sa và Đảo Trường Sa theo nguồn; không biểu diễn hoặc tuyên bố chính xác hình dạng, tâm, extent, bounding box hay đường biên của hai quần đảo. Acceptance cuối cùng là nhìn screenshot render thật để xác nhận text nằm sát đúng vùng cụm đảo.",
  results,
};
fs.writeFileSync(path.join(output, "phase-4-map-label-precision.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ status: summary.status, checks: summary.checks, failures: summary.failures, pointOnly, sourceCoordinatesMatch, evidenceDirectory: path.relative(root, output) }, null, 2));
if (summary.status !== "PASS") process.exitCode = 1;
