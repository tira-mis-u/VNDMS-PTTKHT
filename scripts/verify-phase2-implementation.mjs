import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.VNDMS_URL ?? "http://127.0.0.1:5173";
const output = "artifacts/phase2-browser/final";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const findings = [];
const failures = [];

async function authenticatedPage(username, viewport, dark = false) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  await page.goto(`${base}/login`);
  const inputs = page.locator(".login-card input");
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill("VNDMS@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (dark) await page.getByTitle(/Chuyển sang chế độ/).click();
  return { context, page, consoleErrors };
}

async function inspect(name, page, consoleErrors, expectedHeading) {
  await page.waitForTimeout(250);
  const heading = (await page.locator("h1").first().textContent())?.trim();
  const axe = await new AxeBuilder({ page }).analyze();
  const severe = axe.violations.filter((item) => ["serious", "critical"].includes(item.impact));
  const overflow = await page.evaluate(() => {
    const workspace = document.querySelector(".workspace");
    return workspace ? workspace.scrollWidth - workspace.clientWidth : 0;
  });
  const result = { name, heading, severe: severe.map((item) => item.id), overflow, consoleErrors: [...consoleErrors] };
  findings.push(result);
  if (heading !== expectedHeading || severe.length || overflow > 1 || consoleErrors.length) failures.push(result);
  await page.screenshot({ path: path.join(output, `${name}.png`) });
}

for (const route of [
  ["tinh-hinh-desktop", "Tình hình thiên tai", "Tình hình tác nghiệp thiên tai", { width: 1440, height: 900 }, false],
  ["tinh-hinh-mobile-dark", "Tình hình thiên tai", "Tình hình tác nghiệp thiên tai", { width: 390, height: 844 }, true],
  ["lich-su-tablet", "Lịch sử thiên tai", "Lịch sử sự cố trong dữ liệu vận hành hiện tại", { width: 820, height: 1000 }, false],
  ["xu-huong-mobile", "Xu hướng", "Xu hướng từ dữ liệu tác nghiệp", { width: 390, height: 844 }, false],
  ["phan-quyen-desktop", "Phân quyền", "Phân quyền", { width: 1440, height: 900 }, false],
  ["cau-hinh-mobile-dark", "Cấu hình", "Cấu hình", { width: 390, height: 844 }, true],
]) {
  const [name, label, heading, viewport, dark] = route;
  const { context, page, consoleErrors } = await authenticatedPage("Trần Quốc Thuận", viewport, dark);
  await page.goto(`${base}/workspace/${encodeURIComponent(label)}`);
  const routeHeading = page.getByRole("heading", { name: heading, level: 1 });
  await routeHeading.waitFor();
  await page.reload();
  await routeHeading.waitFor();
  if (label === "Lịch sử thiên tai") {
    const severity = page.getByRole("combobox", { name: "Lọc mức độ sự cố" });
    await severity.click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await page.getByLabel("Từ ngày lịch sử").fill("23/08/2026");
    if (!(await page.getByText("Chưa có dữ liệu lịch sử phù hợp").count())) failures.push({ name, reason: "Thiếu empty state sau filter" });
    await page.getByLabel("Từ ngày lịch sử").fill("");
    await page.getByRole("button", { name: /Mở hồ sơ/ }).first().click();
    if (!new URL(page.url()).pathname.startsWith("/incidents/")) failures.push({ name, reason: "Detail link không canonical" });
    await page.goBack();
  }
  if (label === "Xu hướng") {
    const select = page.getByRole("combobox", { name: "Chọn chỉ số xu hướng" });
    await select.click();
    await page.getByRole("option", { name: "Hoạt động sơ tán" }).click();
    if (!(await page.getByText("Chưa đủ dữ liệu để xác định xu hướng").count())) failures.push({ name, reason: "Thiếu insufficient state" });
    await select.click();
    await page.getByRole("option", { name: "Sự cố được ghi nhận" }).click();
    if (!(await page.getByText("Sự cố được ghi nhận theo ngày").count())) failures.push({ name, reason: "Thiếu populated trend" });
  }
  if (label === "Cấu hình") {
    const blocked = page.locator("h2", { hasText: "Cấu hình hệ thống chưa được cung cấp" });
    await blocked.waitFor();
    if (!(await blocked.count())) failures.push({ name, reason: "Thiếu blocked state" });
  }
  await inspect(name, page, consoleErrors, heading);
  await context.close();
}

for (const username of ["Nguyễn Quốc Trung", "Phạm Văn Đam", "Nguyễn Nam Anh"]) {
  const { context, page, consoleErrors } = await authenticatedPage(username, { width: 1280, height: 800 });
  await page.goto(`${base}/workspace/${encodeURIComponent("Phân quyền")}`);
  await inspect(`phan-quyen-tu-choi-${username}`, page, consoleErrors, "Không được phép truy cập");
  await context.close();
}

{
  const { context, page, consoleErrors } = await authenticatedPage("Nguyễn Quốc Trung", { width: 1440, height: 900 });
  await page.goto(`${base}/analytics/reports`);
  const actor = (await page.getByText(/Nguyễn Quốc Trung · USR-OPS-001/).first().textContent())?.trim();
  if (!actor) failures.push({ name: "bao-cao-actor", reason: "Không hiển thị actor đăng nhập" });
  if (!(await page.getByText(/Thời điểm dữ liệu: 21\/08\/2026 10:45|Đến 21\/08\/2026 10:45/).count())) failures.push({ name: "bao-cao-asof", reason: "Không hiển thị asOf canonical" });
  await inspect("bao-cao-actor-operator", page, consoleErrors, "Báo cáo tác nghiệp");
  await context.close();
}

await browser.close();
const result = { generatedAt: new Date().toISOString(), findings, failures };
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
