import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const src = path.join(root, "src");
const output = path.join(root, "docs/05-architecture/phase-4-evidence/static/architecture-audit.json");
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(full) : /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
});
const files = walk(src);
const entries = files.map((file) => ({ file: path.relative(root, file), text: fs.readFileSync(file, "utf8") }));
const joined = entries.map((entry) => entry.text).join("\n");
const matches = (pattern) => entries.flatMap((entry) => pattern.test(entry.text) ? [entry.file] : []);

const contextOwners = matches(/\bcreateContext\s*[<(]/);
const randomOwners = matches(/\bMath\.random\s*\(/);
const realtimeTransportOwners = matches(/\b(?:WebSocket|EventSource)\s*\(/);
const estimatedIslandGeometryOwners = matches(/ellipseRing|VIETNAM_ISLAND_ZONES|island-zone|(?:Hoàng Sa|Trường Sa)[\s\S]{0,120}(?:Polygon|MultiPolygon|bbox|extent)/i);
const hardCodedPersonnelOutsideRegistry = [];
const personnelFile = entries.find((entry) => entry.file === "src/data/identity/personnel.ts");
const names = [...(personnelFile?.text ?? "").matchAll(/displayName:\s*"([^"]+)"/g)].map((match) => match[1]);
for (const entry of entries) {
  if (entry.file === "src/data/identity/personnel.ts") continue;
  for (const name of names) if (entry.text.includes(`"${name}"`)) hardCodedPersonnelOutsideRegistry.push({ name, file: entry.file });
}
const localStorageOwners = entries.filter((entry) => /\blocalStorage\b/.test(entry.text)).map((entry) => entry.file);
const allowedLocalStorageOwners = new Set([
  "src/components/layout/AppHeader.tsx",
  "src/features/auth/pages/LoginPage.tsx",
  "src/features/auth/profileAvatar.ts",
  "src/infrastructure/auth/localAuditAdapter.ts",
  "src/infrastructure/auth/localAuthenticationAdapter.ts",
  "src/main.tsx",
]);
const unexpectedLocalStorageOwners = localStorageOwners.filter((file) => !allowedLocalStorageOwners.has(file));
const reportLifecyclePlaceholderPresent = joined.includes("Chưa cấp số · Chưa phê duyệt");

const mapModule = await import(pathToFileURL(path.join(src, "infrastructure/gis/mapConfig.ts")).href);
const mapFeatures = mapModule.VIETNAM_SEA_LABELS.features;
const mapAudit = {
  featureCount: mapFeatures.length,
  geometryTypes: [...new Set(mapFeatures.map((feature) => feature.geometry.type))],
  coordinates: mapFeatures.map((feature) => ({ name: feature.properties.name, coordinates: feature.geometry.coordinates })),
  displayCrs: mapModule.VIETNAM_SEA_LABEL_PROVENANCE.displayCrs,
  geometryPolicy: mapModule.VIETNAM_SEA_LABEL_PROVENANCE.geometryPolicy,
  accessedAt: mapModule.VIETNAM_SEA_LABEL_PROVENANCE.accessedAt,
  duplicateBaseLabelAliases: mapModule.BASE_MAP_ISLAND_LABEL_ALIASES,
};
const checks = {
  oneCanonicalOperationalContext: contextOwners.length === 1 && contextOwners[0] === "src/state/operations/OperationalStateContext.ts",
  noRandomRuntimeData: randomOwners.length === 0,
  noFakeRealtimeTransport: realtimeTransportOwners.length === 0,
  noEstimatedIslandGeometry: estimatedIslandGeometryOwners.length === 0,
  pointOnlySeaLabels: mapAudit.featureCount === 2 && mapAudit.geometryTypes.length === 1 && mapAudit.geometryTypes[0] === "Point",
  exactSourceCoordinates: JSON.stringify(mapAudit.coordinates.map((item) => item.coordinates)) === JSON.stringify([[111.601944, 16.533333], [111.931944, 8.641667]]),
  mapCrsDeclared: mapAudit.displayCrs === "EPSG:4326",
  duplicateBaseAliasesDeclared: mapAudit.duplicateBaseLabelAliases.length >= 8,
  noDuplicatePersonnelNames: hardCodedPersonnelOutsideRegistry.length === 0,
  noUnexpectedLocalStoragePersistence: unexpectedLocalStorageOwners.length === 0,
  reportLifecycleNotFaked: reportLifecyclePlaceholderPresent,
};
const failedChecks = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
const result = {
  generatedAt: new Date().toISOString(),
  checks,
  failedChecks,
  contextOwners,
  randomOwners,
  realtimeTransportOwners,
  estimatedIslandGeometryOwners,
  hardCodedPersonnelOutsideRegistry,
  localStorageOwners,
  unexpectedLocalStorageOwners,
  reportLifecyclePlaceholderPresent,
  mapAudit,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ checks: Object.keys(checks).length, failures: failedChecks.length, failedChecks }, null, 2));
if (failedChecks.length) process.exitCode = 1;
