import { chromium } from "playwright";
import fs from "node:fs";
const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const entries = [
  ["Trung tâm điều hành", "/"],
  ["Tình hình thiên tai", "/workspace/T%C3%ACnh%20h%C3%ACnh%20thi%C3%AAn%20tai"],
  ["Bản đồ tác nghiệp", "/workspace/B%E1%BA%A3n%20%C4%91%E1%BB%93%20t%C3%A1c%20nghi%E1%BB%87p"],
  ["Cảnh báo", "/alerts"], ["Sự cố", "/incidents"], ["Phương án ứng phó", "/playbooks"],
  ["Nhiệm vụ", "/tasks"], ["Đội cứu hộ", "/teams"], ["Sơ tán", "/evacuations"], ["SOS", "/sos"],
  ["Điểm sơ tán", "/shelters"], ["Kho vật tư", "/relief/warehouses"], ["Phân phối cứu trợ", "/relief"],
  ["Đánh giá thiệt hại", "/recovery"], ["Tái thiết", "/workspace/T%C3%A1i%20thi%E1%BA%BFt"],
  ["Phân tích tác nghiệp", "/analytics"], ["Báo cáo tác nghiệp", "/analytics/reports"], ["Mô phỏng ứng phó", "/simulation"],
  ["Lịch sử thiên tai", "/workspace/L%E1%BB%8Bch%20s%E1%BB%AD%20thi%C3%AAn%20tai"], ["Xu hướng", "/workspace/Xu%20h%C6%B0%E1%BB%9Bng"],
  ["Trợ lý AI", "/ai-assistant"], ["Người dùng", "/admin/users"], ["Phân quyền", "/workspace/Ph%C3%A2n%20quy%E1%BB%81n"],
  ["Nhật ký hệ thống", "/admin/audit"], ["Cấu hình", "/workspace/C%E1%BA%A5u%20h%C3%ACnh"], ["Hồ sơ cá nhân", "/profile"],
];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${base}/login`);
const inputs = page.locator(".login-card input");
await inputs.nth(0).fill("Trần Quốc Thuận"); await inputs.nth(1).fill("VNDMS@2026");
await page.getByRole("button", { name: /^Đăng nhập$/ }).click(); await page.waitForURL((url) => !url.pathname.endsWith("/login"));
const out = [];
for (const [label, route] of entries) {
  await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-content,.analytics-page").first().waitFor(); await page.waitForTimeout(350);
  out.push({ label, route, url: page.url(), text: await page.locator("body").innerText(), pseudo: await page.evaluate(() => [...document.querySelectorAll("*")].flatMap((element) => ["::before", "::after"].map((pseudo) => getComputedStyle(element, pseudo).content).filter((content) => content && !["none", "normal", '""'].includes(content)))) });
}
fs.mkdirSync("docs/05-architecture/final-acceptance-evidence", { recursive: true });
fs.writeFileSync("docs/05-architecture/final-acceptance-evidence/rendered-text-corpus.json", JSON.stringify(out, null, 2));
await browser.close();
