import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("src");
const forbidden = /\b(mutation|canonical|incident|playbook|workspace|tick|engine|ownership|entity|snapshot|payload|query|route|drawer|modal|state|status|loading|overview|detail|source|realtime|fallback|assistant|profile|report|analytics|simulation|alert|assessment|execution|backend|production|adapter|shipment|milestone|verified|rollback|evidence|owner|revision|workflow|override|operational|demo|occupancy|utilization|capacity|currentOccupancy|reservedCapacity)\b/i;
const uiAttributes = new Set([
  "aria-label",
  "aria-description",
  "title",
  "placeholder",
  "alt",
  "label",
  "accessibleLabel",
  "description",
  "helperText",
  "emptyText",
  "emptyMessage",
  "message",
]);
const presentationProperties = new Set([
  "title",
  "label",
  "description",
  "message",
  "reason",
  "clarification",
  "conclusion",
  "helper",
  "emptyText",
  "emptyMessage",
]);
const findings = [];
const walkFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walkFiles(full)
      : /\.tsx?$/.test(full)
        ? [full]
        : [];
  });

const hasVietnameseContext = (text) =>
  /[ăâđêôơưĂÂĐÊÔƠƯáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵÁÀẢÃẠÉÈẺẼẸÍÌỈĨỊÓÒỎÕỌÚÙỦŨỤÝỲỶỸỴ]|\b(không|đang|đã|được|cần|dữ liệu|trạng thái|sự cố|nhiệm vụ|phương án|người|phạm vi)\b/i.test(
    text,
  );

for (const file of walkFiles(root)) {
  const sourceText = fs.readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const add = (node, text, context) => {
    const match = text.match(forbidden);
    if (!match) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    findings.push({
      file: path.relative(process.cwd(), file),
      line: line + 1,
      context,
      word: match[0],
      text: text.trim().replace(/\s+/g, " "),
    });
  };
  const jsxContext = (node) => {
    let current = node.parent;
    let sawExpression = false;
    while (current) {
      if (ts.isJsxExpression(current)) sawExpression = true;
      if (ts.isJsxAttribute(current))
        return sawExpression && uiAttributes.has(current.name.getText(source))
          ? `attribute:${current.name.getText(source)}`
          : null;
      if (sawExpression && (ts.isJsxElement(current) || ts.isJsxFragment(current)))
        return "jsx-expression";
      if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return null;
      current = current.parent;
    }
    return null;
  };
  const literalText = (node) => {
    if (ts.isTemplateExpression(node))
      return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ");
    return node.text;
  };
  const propertyName = (node) => {
    if (!node.parent || !ts.isPropertyAssignment(node.parent)) return null;
    return node.parent.name.getText(source).replace(/["']/g, "");
  };
  const isThrownOrUserError = (node) => {
    let current = node.parent;
    while (current && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
      if (ts.isThrowStatement(current)) return true;
      if (
        ts.isNewExpression(current) &&
        current.expression.getText(source) === "Error"
      )
        return true;
      current = current.parent;
    }
    return false;
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) add(node, node.text, "jsx");
    if (
      ts.isJsxAttribute(node) &&
      uiAttributes.has(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    )
      add(node, node.initializer.text, "attribute");
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    ) {
      if (ts.isBinaryExpression(node.parent)) {
        ts.forEachChild(node, visit);
        return;
      }
      const text = literalText(node);
      const prop = propertyName(node);
      const jsx = jsxContext(node);
      if (jsx) add(node, text, jsx);
      else if (prop && presentationProperties.has(prop))
        add(node, text, `property:${prop}`);
      else if (isThrownOrUserError(node)) add(node, text, "error");
      else if (hasVietnameseContext(text)) add(node, text, "mixed-language");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const unique = [...new Map(findings.map((item) => [`${item.file}:${item.line}:${item.text}`, item])).values()];
if (process.argv.includes("--json")) console.log(JSON.stringify(unique, null, 2));
else
  for (const item of unique)
    console.log(
      `${item.file}:${item.line} [${item.word}/${item.context}] ${item.text}`,
    );
if (unique.length) process.exitCode = 1;
