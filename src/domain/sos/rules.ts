import type { SosRequest, SosStatus, SosTriageResult } from "./types";
export const sosTransitions: Record<SosStatus, SosStatus[]> = {
  "Mới tiếp nhận": ["Đang xác minh", "Từ chối", "Không liên lạc được", "Hủy"],
  "Đang xác minh": ["Đã xác minh", "Từ chối", "Không liên lạc được", "Hủy"],
  "Đã xác minh": ["Đã điều phối", "Không liên lạc được", "Hủy"],
  "Đã điều phối": ["Đang cứu hộ", "Không liên lạc được", "Hủy"],
  "Đang cứu hộ": ["Đã xử lý", "Không liên lạc được"],
  "Không liên lạc được": ["Đang xác minh", "Đang cứu hộ", "Từ chối", "Hủy"],
  "Đã xử lý": ["Đã đóng"],
  "Đã đóng": [],
  "Từ chối": [],
  Hủy: [],
};
export const sosPriorityRank: Record<SosRequest["priority"], number> = {
  "P1 — Khẩn cấp": 0,
  "P2 — Cao": 1,
  "P3 — Trung bình": 2,
  "P4 — Thấp": 3,
};
export function getSosTransitions(status: SosStatus) {
  return sosTransitions[status];
}
export function calculateSosTriage(
  input: Pick<
    SosRequest,
    | "severity"
    | "peopleAtRisk"
    | "injuredCount"
    | "missingCount"
    | "childrenCount"
    | "elderlyCount"
    | "disabledCount"
    | "communicationStatus"
    | "location"
  >,
): SosTriageResult {
  const reasons: string[] = [];
  let score = 0;
  if (input.severity === "Đe dọa tính mạng") {
    score += 5;
    reasons.push("Có nguy cơ trực tiếp đến tính mạng");
  } else if (input.severity === "Nghiêm trọng") {
    score += 3;
    reasons.push("Tình huống được đánh giá nghiêm trọng");
  }
  if (input.peopleAtRisk >= 6) {
    score += 3;
    reasons.push(`${input.peopleAtRisk} người đang gặp nguy hiểm`);
  } else if (input.peopleAtRisk >= 2) {
    score += 1;
    reasons.push(`${input.peopleAtRisk} người cần hỗ trợ`);
  }
  if (input.injuredCount > 0) {
    score += 3;
    reasons.push(`${input.injuredCount} người bị thương`);
  }
  if (input.missingCount > 0) {
    score += 3;
    reasons.push(`${input.missingCount} người mất tích`);
  }
  const vulnerable =
    input.childrenCount + input.elderlyCount + input.disabledCount;
  if (vulnerable > 0) {
    score += 2;
    reasons.push(`${vulnerable} người thuộc nhóm dễ bị tổn thương`);
  }
  if (input.location.accessCondition === "Bị cô lập") {
    score += 3;
    reasons.push("Khu vực bị cô lập");
  } else if (input.location.accessCondition === "Hạn chế đường bộ") {
    score += 1;
    reasons.push("Tiếp cận đường bộ hạn chế");
  }
  if (input.communicationStatus === "Mất liên lạc") {
    score += 3;
    reasons.push("Đã mất liên lạc với người báo tin");
  } else if (input.communicationStatus === "Gián đoạn") {
    score += 1;
    reasons.push("Liên lạc gián đoạn");
  }
  const priority =
    score >= 8
      ? "P1 — Khẩn cấp"
      : score >= 5
        ? "P2 — Cao"
        : score >= 2
          ? "P3 — Trung bình"
          : "P4 — Thấp";
  return {
    priority,
    reasons: reasons.length
      ? reasons
      : ["Chưa ghi nhận yếu tố nguy cơ đặc biệt"],
  };
}
export function isSosWaitingTooLong(sos: SosRequest) {
  return (
    ["Mới tiếp nhận", "Đang xác minh"].includes(sos.status) &&
    sos.receivedAt < "21/08/2026 10:15"
  );
}
