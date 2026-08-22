import type { AiContext, AiIntentClassification } from "./types";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const entityPattern =
  /\b(?:INC|TSK|CH|TH|SOS|REQ|PBX|PB|RP|DA|EVAC|EVA|WH|KHO)-[A-Z0-9-]+\b/i;
export function classifyOperationalIntent(
  question: string,
  context?: AiContext,
): AiIntentClassification {
  const text = normalize(question.trim());
  const found =
    question.match(entityPattern)?.[0].toUpperCase() ?? context?.entityId;
  if (!text)
    return {
      intent: "unknown",
      confidence: "low",
      clarification:
        "Bạn cần tôi đánh giá sự cố, nhiệm vụ, nguồn lực hay ngoại lệ tác nghiệp nào?",
    };
  if (
    /dieu gi can|can xu ly ngay|de xuat|khuyen nghi|nen lam gi|uu tien xu ly/.test(
      text,
    )
  )
    return {
      intent: "recommendation_request",
      confidence: "high",
      entityId: found,
    };
  if (
    found &&
    (/phan tich|chi tiet|tinh trang|hien tai|the nao|con bao nhieu/.test(
      text,
    ) ||
      text === normalize(found))
  ) {
    const prefix = found.split("-")[0];
    const intent =
      prefix === "INC"
        ? "incident_analysis"
        : prefix === "TSK"
          ? "task_analysis"
          : prefix === "CH"
            ? "team_availability"
            : prefix === "TH"
              ? "shelter_capacity"
              : prefix === "SOS"
                ? "sos_prioritization"
                : prefix === "REQ" || prefix === "WH" || prefix === "KHO"
                  ? "relief_shortage"
                  : prefix === "PB" || prefix === "PBX"
                    ? "playbook_status"
                    : prefix === "RP" || prefix === "DA"
                      ? "recovery_status"
                      : prefix === "EVAC" || prefix === "EVA"
                        ? "evacuation_status"
                        : "entity_lookup";
    return { intent, confidence: "high", entityId: found };
  }
  if (/canh bao|thong bao tac nghiep|\balert/.test(text))
    return {
      intent: "alert_overview",
      confidence: "high",
      entityId: found,
    };
  if (/ngoai le|chi huy chu y|bat thuong|rủi ro|rui ro/.test(text))
    return {
      intent: "operational_exceptions",
      confidence: "high",
      entityId: found,
    };
  if (/sos|p1|cau cuu|cứu hộ khẩn/.test(text))
    return {
      intent: "sos_prioritization",
      confidence: "high",
      entityId: found,
    };
  if (/doi nao|doi cuu ho|san sang|gan khu vuc|team/.test(text))
    return { intent: "team_availability", confidence: "high", entityId: found };
  if (/diem so tan|suc chua|con tiep nhan|gan day|qua tai|\bth-/.test(text))
    return { intent: "shelter_capacity", confidence: "high", entityId: found };
  if (/so tan|tuyen so tan|evac/.test(text))
    return { intent: "evacuation_status", confidence: "high", entityId: found };
  if (/kho|vat tu|cuu tro|thieu hang|ton kho|\breq-/.test(text))
    return { intent: "relief_shortage", confidence: "high", entityId: found };
  if (/playbook|quy trinh|sop|buoc nao|buoc bi chan/.test(text))
    return { intent: "playbook_status", confidence: "high", entityId: found };
  if (/phuc hoi|tai thiet|thiet hai|recovery|\brp-/.test(text))
    return { intent: "recovery_status", confidence: "high", entityId: found };
  if (/nhiem vu|qua han|task|\btsk-/.test(text))
    return { intent: "task_analysis", confidence: "high", entityId: found };
  if (/su co|incident|nghiem trong|\binc-/.test(text))
    return { intent: "incident_analysis", confidence: "high", entityId: found };
  if (/hien tai|tinh hinh|tong quan|dang xay ra/.test(text))
    return {
      intent: "current_situation",
      confidence: "medium",
      entityId: found,
    };
  if (found)
    return { intent: "entity_lookup", confidence: "medium", entityId: found };
  return {
    intent: "unknown",
    confidence: "low",
    clarification:
      "Tôi chưa xác định được phạm vi câu hỏi. Bạn muốn xem sự cố, nhiệm vụ, đội cứu hộ, SOS, điểm sơ tán, cứu trợ hay phục hồi?",
  };
}
export function operationalDate(value: string) {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return Number.NaN;
  return new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
  ).getTime();
}
export const activeIncident = (status: string) => status !== "Đã đóng";
export const openTask = (status: string) =>
  !["Hoàn thành", "Đã hủy"].includes(status);
export const openSos = (status: string) =>
  !["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(status);
