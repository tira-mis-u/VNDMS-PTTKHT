import type { ReliefRequest } from "@/domain/relief/types";

const reliefOriginLabels: Record<ReliefRequest["origin"], string> = {
  Incident: "Sự cố",
  "Điểm sơ tán": "Điểm sơ tán",
  "Hoạt động sơ tán": "Hoạt động sơ tán",
  "Đội cứu hộ": "Đội cứu hộ",
  "Cán bộ địa phương": "Cán bộ địa phương",
};

export function reliefOriginLabel(origin: ReliefRequest["origin"]) {
  return reliefOriginLabels[origin];
}
