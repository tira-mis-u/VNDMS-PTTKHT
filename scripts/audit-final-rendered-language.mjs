import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidence = path.join(root, "docs/05-architecture/final-acceptance-evidence");
const routes = JSON.parse(fs.readFileSync(path.join(evidence, "rendered-text-corpus.json"), "utf8"));
const interactions = JSON.parse(fs.readFileSync(path.join(evidence, "interactions/interaction-results.json"), "utf8"));
const entries = [
  ...routes.map((item) => ({ name: `route:${item.label}`, text: `${item.text}\n${item.pseudo.join("\n")}` })),
  ...interactions.results.map((item) => ({ name: `interaction:${item.name}`, text: `${item.visibleText ?? ""}\n${(item.pseudoContent ?? []).join("\n")}` })),
];
const corpus = entries.map((item) => item.text).join("\n");
const technicalEnglish = /\b(mutation|canonical|Incident|Playbooks?|workspace|tick|engine|ownership|entity|snapshot|payload|query|route|drawer|modal|state|status|loading|overview|detail|source|realtime|fallback|Assessment|execution|backend|production|adapter|milestone|rollback|occupancy|utilization|capacity|revision|workflow|override|module|application|hazard|baseline|refresh|local|ETA|GPS|triage|shortage|reservation|permission)\b/gi;
const rawIdentifier = /\b(?:[a-z]+_[a-z_]+|[A-Z]{2,}(?:_[A-Z]+)+)\b/g;
const knownTypo = /ngườii|thởii|thởi|dờii/gi;
const asciiLines = [...new Set(entries.flatMap((entry) => entry.text.split("\n"))
  .map((line) => line.trim())
  .filter((line) =>
    line &&
    [...line].every((character) => character.codePointAt(0) <= 127) &&
    /[A-Za-z]/.test(line),
  ))].sort();
const legitimateAsciiText = new Set(["Cao", "Xe kho", "VNDMS", "SOS", "QT", "TH", "MT", "NA", "P1"]);
const technicalReference = /^(?:\d+[.,]?\d*\s*)?(?:[A-Z]{1,5}\d*(?:-[A-Za-z0-9]+)+(?:,\s*[A-Z0-9-]+)?|SOS(?:\s+[12])?|v\d+(?:\.\d+)+|(?:\d+[.,]?\d*\s*(?:m|ha|km|bao|chai))|\d{4}-\d\d-\d\dT\S+|\d\d:\d\d.*)$/;
const unexpectedAsciiProse = asciiLines.filter((line) => !legitimateAsciiText.has(line) && !technicalReference.test(line));
const findings = {
  technicalEnglish: [...new Set(corpus.match(technicalEnglish) ?? [])],
  rawIdentifier: [...new Set(corpus.match(rawIdentifier) ?? [])],
  knownTypo: [...new Set(corpus.match(knownTypo) ?? [])],
  unexpectedAsciiProse,
};
const failures = Object.values(findings).reduce((sum, values) => sum + values.length, 0);
const summary = {
  generatedAt: new Date().toISOString(),
  sources: {
    routeCorpusEntries: routes.length,
    interactionCorpusEntries: interactions.results.length,
    renderedCharactersReviewed: corpus.length,
    cssPseudoContentIncluded: true,
  },
  method: [
    "Thu toàn bộ innerText và nội dung ::before/::after từ Chrome cho route, detail và overlay.",
    "Kiểm tra từ kỹ thuật tiếng Anh đã biết và mọi định danh snake_case viết thường/hoa.",
    "Trích độc lập mọi dòng chỉ dùng ASCII để phát hiện câu mới ngoài danh sách từ cấm; phân loại mã nghiệp vụ, đơn vị, tên sản phẩm và chữ tiếng Việt hợp lệ theo ngữ cảnh.",
    "Đọc ngữ cảnh corpus sau mỗi lần phát hiện; không dùng thay thế chuỗi mù quáng.",
  ],
  asciiCandidateLinesReviewed: asciiLines.length,
  legitimateAsciiText: [...legitimateAsciiText],
  findings,
  remediatedDuringReview: [
    "raw permission keys và mã hành động nhật ký",
    "Playbooks, Damage locations, Shortage, reservation, triage, GPS",
    "mã nguồn cảnh báo dạng nội bộ",
    "các lỗi chính tả ngườii, thởi/thờii, dờii",
    "tên người thiếu dấu và thời gian nhật ký dạng ISO trong drawer",
  ],
  failures,
};
fs.writeFileSync(path.join(evidence, "rendered-language-review.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (failures) process.exitCode = 1;
