import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import ts from "typescript";

const src = path.resolve("src");
const failures = [];
const result = {};
const files = (directory, extension) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? files(full, extension) : full.endsWith(extension) ? [full] : [];
});

const tsxFiles = files(src, ".tsx");
const selectOwners = tsxFiles.filter((file) => /<select\b/.test(fs.readFileSync(file, "utf8")));
result.nativeSelectOutsideShared = selectOwners.filter((file) => !file.endsWith(path.join("components", "ui", "Select.tsx"))).map((file) => path.relative(process.cwd(), file));
if (result.nativeSelectOutsideShared.length) failures.push("Có native select ngoài shared Select.");
const rawInputOwners = tsxFiles.filter((file) => /<input\b/.test(fs.readFileSync(file, "utf8")));
const rawTextareaOwners = tsxFiles.filter((file) => /<textarea\b/.test(fs.readFileSync(file, "utf8")));
result.rawInputOutsideShared = rawInputOwners
  .filter((file) => !file.endsWith(path.join("components", "ui", "index.tsx")))
  .map((file) => path.relative(process.cwd(), file));
result.rawTextareaOutsideShared = rawTextareaOwners
  .filter((file) => !file.endsWith(path.join("components", "ui", "index.tsx")))
  .map((file) => path.relative(process.cwd(), file));
if (result.rawInputOutsideShared.length) failures.push("Có input thô ngoài shared Input.");
if (result.rawTextareaOutsideShared.length) failures.push("Có textarea thô ngoài shared Textarea.");

const cssFiles = files(path.join(src, "styles"), ".css");
const selectCssOwners = [];
let nativeSelectCssSelectors = 0;
let visualInputRulesOutsideShared = 0;
let filterLayoutHacksOutsideShared = 0;
let smallFontDeclarations = 0;
let importantDeclarations = 0;
let negativeMarginDeclarations = 0;
let absolutePositionDeclarations = 0;
let fixedHeightDeclarations = 0;
let hardCodedFontFamilyDeclarations = 0;
let blackDefaultBorders = 0;
let defaultBrowserOutlines = 0;
let defaultAppearanceDeclarations = 0;
const visual = new Set(["font", "font-family", "font-size", "color", "background", "background-color", "background-image", "border", "border-color", "border-radius", "padding", "height", "min-height", "outline", "box-shadow", "appearance"]);
const filterLayout = new Set(["display", "flex-wrap", "flex-direction", "align-items", "gap", "padding", "height", "min-height", "overflow", "overflow-x", "overflow-y", "grid-template-columns", "grid-column", "width", "min-width", "max-width"]);
for (const file of cssFiles) {
  const text = fs.readFileSync(file, "utf8");
  const root = postcss.parse(text, { from: file });
  let hasSelectCss = false;
  root.walkDecls((decl) => {
    if (decl.important) importantDeclarations += 1;
    if (/^margin(?:-.+)?$/.test(decl.prop) && /(^|\s)-\d/.test(decl.value)) negativeMarginDeclarations += 1;
    if (decl.prop === "position" && decl.value.trim() === "absolute") absolutePositionDeclarations += 1;
    if (decl.prop === "height" && /^\d{3,}px$/.test(decl.value.trim())) fixedHeightDeclarations += 1;
    if (decl.prop === "font-size" && /^\s*(?:[0-9]|1[0-2](?:\.\d+)?)px\s*$/.test(decl.value)) smallFontDeclarations += 1;
    if (
      decl.prop === "font-family" &&
      !decl.value.includes("var(--font-family-ui)") &&
      decl.parent?.type !== "atrule" &&
      decl.parent?.parent?.type !== "atrule"
    ) hardCodedFontFamilyDeclarations += 1;
    if (/^border(?:-.+)?$/.test(decl.prop) && /(?:^|\s)(?:black|#000(?:000)?)(?:\s|$)/i.test(decl.value)) blackDefaultBorders += 1;
    if (/^outline(?:-.+)?$/.test(decl.prop) && /^(?:auto|initial)$/i.test(decl.value.trim())) defaultBrowserOutlines += 1;
    if (/^(?:-webkit-)?appearance$/.test(decl.prop) && /^(?:auto|initial)$/i.test(decl.value.trim())) defaultAppearanceDeclarations += 1;
  });
  root.walkRules((rule) => {
    if (/\.ui-select(?:\b|-)/.test(rule.selector)) hasSelectCss = true;
    if (/(^|[\s>+~,(])select(?=[:.#[\s>+~,){}]|$)/i.test(rule.selector)) nativeSelectCssSelectors += 1;
    if (file.endsWith("compact-ui.css")) return;
    const hasTextControl = /(^|[\s>+~,(])(?:input|textarea)(?=[:.#[\s>+~,){}]|$)/i.test(rule.selector);
    const special = /type\s*=\s*["']?(?:checkbox|radio|range|file|color)|\.om-layer-row\s+input|\.progress-picker\s+input|\.team-capability-editor\s+input/i.test(rule.selector);
    if (hasTextControl && !special && rule.nodes.some((node) => node.type === "decl" && visual.has(node.prop))) visualInputRulesOutsideShared += 1;
    if (/\.(?:incident|task|team|shelter|sos|relief)-filters\b|\.evac-toolbar\b|\.alerts-toolbar\b|\.analytics-filters\b|\.admin-filters\b/.test(rule.selector) && rule.nodes.some((node) => node.type === "decl" && filterLayout.has(node.prop))) filterLayoutHacksOutsideShared += 1;
  });
  if (hasSelectCss) selectCssOwners.push(path.relative(process.cwd(), file));
}
result.selectCssOwners = selectCssOwners;
result.nativeSelectCssSelectors = nativeSelectCssSelectors;
result.visualInputRulesOutsideShared = visualInputRulesOutsideShared;
result.filterLayoutHacksOutsideShared = filterLayoutHacksOutsideShared;
result.smallFontDeclarations = smallFontDeclarations;
result.importantDeclarations = importantDeclarations;
result.negativeMarginDeclarations = negativeMarginDeclarations;
result.absolutePositionDeclarations = absolutePositionDeclarations;
result.fixedHeightDeclarations = fixedHeightDeclarations;
result.hardCodedFontFamilyDeclarations = hardCodedFontFamilyDeclarations;
result.blackDefaultBorders = blackDefaultBorders;
result.defaultBrowserOutlines = defaultBrowserOutlines;
result.defaultAppearanceDeclarations = defaultAppearanceDeclarations;
if (selectCssOwners.length !== 1 || selectCssOwners[0] !== "src/styles/compact-ui.css") failures.push("Shared Select CSS không có đúng một nguồn.");
if (nativeSelectCssSelectors) failures.push("Còn native select CSS selector.");
if (visualInputRulesOutsideShared) failures.push("Còn visual Input CSS ngoài shared control source.");
if (filterLayoutHacksOutsideShared) failures.push("Còn page-specific filter layout hack.");
if (smallFontDeclarations) failures.push("Còn font-size dưới 13px.");
if (importantDeclarations > 38) failures.push("Số !important vượt baseline trước repair.");
if (negativeMarginDeclarations) failures.push("Còn negative margin dùng để căn giao diện.");
if (hardCodedFontFamilyDeclarations) failures.push("Còn font-family hard-code ngoài token chung.");
if (blackDefaultBorders) failures.push("Còn border đen kiểu mặc định.");
if (defaultBrowserOutlines) failures.push("Còn browser outline auto/initial.");
if (defaultAppearanceDeclarations) failures.push("Còn browser appearance auto/initial.");

const allRuntimeText = [...files(src, ".ts"), ...tsxFiles]
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
result.estimatedIslandGeometryReferences = (allRuntimeText.match(/ellipseRing|VIETNAM_ISLAND_ZONES|island-zone/g) ?? []).length;
result.fakeRealtimeUiReferences = (allRuntimeText.match(/(?:kết nối|đồng bộ|cập nhật)\s+(?:thời gian thực|realtime)/gi) ?? []).length;
if (result.estimatedIslandGeometryReferences) failures.push("Còn geometry quần đảo ước lượng.");
if (result.fakeRealtimeUiReferences) failures.push("Còn tuyên bố giao diện thời gian thực không có nguồn.");

const navFile = path.join(src, "components/navigation/navigationConfig.ts");
const navText = fs.readFileSync(navFile, "utf8");
const navSource = ts.createSourceFile(navFile, navText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let navItems = 0;
let routes = 0;
const visit = (node) => {
  if (ts.isObjectLiteralExpression(node)) {
    const hasLabel = node.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(navSource) === "label");
    const hasPermission = node.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(navSource) === "permission");
    if (hasLabel && hasPermission) {
      navItems += 1;
      if (node.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText(navSource) === "path")) routes += 1;
    }
  }
  ts.forEachChild(node, visit);
};
visit(navSource);
result.navigation = { items: navItems, routes, placeholders: navItems - routes };
if (!routes || routes + (navItems - routes) !== navItems) failures.push("Không đọc được inventory sidebar.");

const personnelFile = path.join(src, "data/identity/personnel.ts");
const personnel = fs.readFileSync(personnelFile, "utf8");
const names = [...personnel.matchAll(/displayName:\s*"([^"]+)"/g)].map((match) => match[1]);
const runtimeFiles = [...files(src, ".ts"), ...tsxFiles].filter((file) => file !== personnelFile);
const duplicateNames = [];
for (const name of names)
  for (const file of runtimeFiles)
    if (fs.readFileSync(file, "utf8").includes(`"${name}"`)) duplicateNames.push({ name, file: path.relative(process.cwd(), file) });
result.duplicateHardCodedPersonNames = duplicateNames;
if (duplicateNames.length) failures.push("Còn tên người hard-code ngoài registry.");
const requiredPersonnelFields = ["id", "displayName", "role", "title", "organization", "contact", "geographicScope"];
result.personnelSchemaFields = requiredPersonnelFields.filter((field) => new RegExp(`\\b${field}\\??:`).test(personnel));
const directPersonnelDisplayReferences = runtimeFiles.flatMap((file) => {
  const text = fs.readFileSync(file, "utf8");
  return /PERSONNEL\.[A-Z0-9_]+\.displayName/.test(text) ? [path.relative(process.cwd(), file)] : [];
});
result.directPersonnelDisplayReferences = directPersonnelDisplayReferences;
result.legacyPersonnelSourceExists = fs.existsSync(path.join(src, "data/people.ts"));
if (result.personnelSchemaFields.length !== requiredPersonnelFields.length) failures.push("Personnel registry thiếu trường bắt buộc.");
if (directPersonnelDisplayReferences.length) failures.push("Module còn tham chiếu displayName thay vì stable personnel ID.");
if (result.legacyPersonnelSourceExists) failures.push("Còn nguồn personnel tương thích cũ ngoài registry duy nhất.");

result.failures = failures;
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
