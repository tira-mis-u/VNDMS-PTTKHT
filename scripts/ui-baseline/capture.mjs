/**
 * Chụp baseline UI cho các màn hình bị đụng tới trong refactor V2.
 * Dùng: node scripts/ui-baseline/capture.mjs <out-dir> [user1,user2,...]
 *
 * - Đăng nhập thật qua form, chờ trang render xong (không chụp skeleton).
 * - Ghi lại bounding box của các vùng layout chính để so sánh số đo trước/sau.
 * - Chỉ dùng trong sandbox kiểm thử; không phải một phần của sản phẩm.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.VNDMS_URL ?? "http://localhost:5173";
const outDir = process.argv[2] ?? "scripts/ui-baseline/out";
const users = (process.argv[3] ?? "thuantq,nguyentrung,phamhieu,phamdam,minhtri,namanh,trantuan").split(",");
const PASSWORD = "VNDMS@2026";
const routes = (process.env.VNDMS_ROUTES ?? "/,/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p,/sos,/tasks,/alerts,/profile,/workspace/Ph%C3%A2n%20quy%E1%BB%81n").split(",");
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const SELECTORS = [
  ".topbar", ".topbar-actions", ".live-tracking-quickbar", ".sidebar", ".workspace",
  ".cc-layout", ".om-layout", ".citizen-portal", ".citizen-hero-banner", ".citizen-map-section",
  ".citizen-main-layout", ".sos-page", ".admin-page", ".account",
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const report = {};

for (const username of users) {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "vi-VN" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("input[name=username], #login-username, input[autocomplete=username]", username).catch(async () => {
      await page.locator("input").first().fill(username);
    });
    await page.fill("input[type=password]", PASSWORD);
    await page.locator("#login-submit-btn").click();
    await page.waitForFunction(() => !document.querySelector("#login-form") || location.pathname !== "/login", null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const sessionOk = await page.evaluate(() => !!localStorage.getItem("vndms.auth.session.v5") || !!localStorage.getItem("vndms.auth.session.v6"));
    report[username] ??= {};
    report[username][vp.name] = { sessionOk, routes: {} };
    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
      // Chờ Suspense fallback biến mất và nội dung có kích thước thật.
      await page.waitForFunction(() => !document.querySelector(".route-loading"), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const key = decodeURIComponent(route).replace(/[^a-zA-Z0-9]+/g, "_") || "root";
      const file = join(outDir, `${username}-${vp.name}-${key}.png`);
      await page.screenshot({ path: file, fullPage: true }).catch(() => {});
      const boxes = await page.evaluate((sels) => {
        const out = {};
        for (const s of sels) {
          const el = document.querySelector(s);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          out[s] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }
        out.__title = document.querySelector("h1")?.textContent?.trim() ?? null;
        out.__navItems = [...document.querySelectorAll(".sidebar .nav-item .nav-label")].map((n) => n.textContent.trim());
        out.__accessDenied = !!document.querySelector(".access-denied, [data-access-denied]") || /chưa được cấp quyền/i.test(document.body.innerText);
        out.__quickbarButtons = [...document.querySelectorAll(".live-tracking-quickbar button")].map((b) => b.getAttribute("title") ?? b.textContent.trim());
        return out;
      }, SELECTORS);
      report[username][vp.name].routes[route] = { file, boxes, pageErrors: [...errors] };
      errors.length = 0;
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`Đã chụp ${Object.keys(report).length} tài khoản × ${viewports.length} viewport × ${routes.length} route → ${outDir}`);
