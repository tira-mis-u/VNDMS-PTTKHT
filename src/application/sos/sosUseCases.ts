import type { UserRole } from "../../domain/shared/auth";
import type {
  SosLocation,
  SosPriority,
  SosRequest,
  SosStatus,
} from "../../domain/sos/types";
import type { CreateIncidentInput } from "../incidents/incidentUseCases";
import type { NewTaskInput } from "../tasks/taskUseCases";
import type { NewEvacuationInput } from "../evacuations/evacuationUseCases";
import { calculateSosTriage, getSosTransitions } from "../../domain/sos/rules";
export type NewSosInput = Pick<
  SosRequest,
  | "reporter"
  | "location"
  | "description"
  | "peopleAtRisk"
  | "injuredCount"
  | "missingCount"
  | "childrenCount"
  | "elderlyCount"
  | "disabledCount"
  | "severity"
  | "communicationStatus"
> & { affectedPeople?: SosRequest["affectedPeople"] };
export function createSosRequest(
  id: string,
  input: NewSosInput,
  timestamp: string,
): SosRequest {
  const base: SosRequest = {
    id,
    code: id,
    receivedAt: timestamp,
    ...input,
    affectedPeople: input.affectedPeople ?? [],
    priority: "P4 — Thấp",
    triageReasons: [],
    status: "Mới tiếp nhận",
    verificationStatus: "Chưa xác minh",
    linkedIncidentId: null,
    assignedTeamId: null,
    linkedTaskId: null,
    shelterDestinationId: null,
    linkedEvacuationOperationId: null,
    lastContactAt: timestamp,
    lastUpdatedAt: timestamp,
    resolutionSummary: null,
    closedAt: null,
  };
  const triage = calculateSosTriage(base);
  return { ...base, priority: triage.priority, triageReasons: triage.reasons };
}
export function assertSosScope(
  role: UserRole,
  administrativeArea: string,
  scope: string,
) {
  if (role === "local_officer" && !administrativeArea.includes(scope))
    throw new Error("Yêu cầu SOS nằm ngoài phạm vi địa lý được phân công.");
}
export function transitionSos(
  sos: SosRequest,
  status: SosStatus,
  timestamp: string,
): SosRequest {
  if (!getSosTransitions(sos.status).includes(status))
    throw new Error(`Không thể chuyển SOS từ ${sos.status} sang ${status}.`);
  if (status === "Đã xác minh" && sos.verificationStatus === "Không hợp lệ")
    throw new Error("SOS không hợp lệ không thể xác minh.");
  if (status === "Đã điều phối" && (!sos.assignedTeamId || !sos.linkedTaskId))
    throw new Error("Phải tạo nhiệm vụ và giao đội trước khi điều phối.");
  if (status === "Đang cứu hộ" && !sos.assignedTeamId)
    throw new Error("SOS chưa có đội cứu hộ.");
  if (status === "Đã đóng" && !sos.resolutionSummary)
    throw new Error("Phải ghi nhận kết quả xử lý trước khi đóng.");
  return {
    ...sos,
    status,
    verificationStatus:
      status === "Đang xác minh"
        ? "Đang xác minh"
        : status === "Đã xác minh"
          ? "Đã xác minh"
          : status === "Từ chối"
            ? "Không hợp lệ"
            : sos.verificationStatus,
    communicationStatus:
      status === "Không liên lạc được"
        ? "Mất liên lạc"
        : sos.communicationStatus,
    lastUpdatedAt: timestamp,
    closedAt: status === "Đã đóng" ? timestamp : sos.closedAt,
  };
}
export function verifySos(sos: SosRequest, timestamp: string): SosRequest {
  const started = ["Mới tiếp nhận", "Không liên lạc được"].includes(sos.status)
    ? transitionSos(sos, "Đang xác minh", timestamp)
    : sos;
  return transitionSos(started, "Đã xác minh", timestamp);
}
export function retriageSos(
  sos: SosRequest,
  timestamp: string,
  manualPriority?: SosPriority,
): SosRequest {
  const triage = calculateSosTriage(sos);
  return {
    ...sos,
    priority: manualPriority ?? triage.priority,
    triageReasons: manualPriority
      ? [
          `Ưu tiên được điều chỉnh thủ công từ ${triage.priority}`,
          ...triage.reasons,
        ]
      : triage.reasons,
    lastUpdatedAt: timestamp,
  };
}
export function updateSosLocation(
  sos: SosRequest,
  location: SosLocation,
  timestamp: string,
): SosRequest {
  return retriageSos({ ...sos, location, lastUpdatedAt: timestamp }, timestamp);
}
export function linkSosIncident(
  sos: SosRequest,
  incidentId: string,
  timestamp: string,
): SosRequest {
  return { ...sos, linkedIncidentId: incidentId, lastUpdatedAt: timestamp };
}
export function linkSosTaskAndTeam(
  sos: SosRequest,
  taskId: string,
  teamId: string,
  timestamp: string,
): SosRequest {
  const status = sos.status === "Đã xác minh" ? "Đã điều phối" : sos.status;
  return {
    ...sos,
    linkedTaskId: taskId,
    assignedTeamId: teamId,
    status,
    lastUpdatedAt: timestamp,
  };
}
export function incidentInputFromSos(sos: SosRequest): {
  input: CreateIncidentInput;
  affectedPopulation: number;
  source: string;
} {
  return {
    input: {
      title: `Yêu cầu cứu hộ ${sos.location.name}`,
      type: "SOS cứu hộ",
      severity:
        sos.priority === "P1 — Khẩn cấp"
          ? "Khẩn cấp"
          : sos.priority === "P2 — Cao"
            ? "Cao"
            : sos.priority === "P3 — Trung bình"
              ? "Trung bình"
              : "Thấp",
      location: {
        name: sos.location.address,
        coordinates: sos.location.coordinates,
      },
      description: sos.description,
    },
    affectedPopulation: sos.peopleAtRisk,
    source: `Yêu cầu ${sos.id}`,
  };
}
export function taskInputFromSos(
  sos: SosRequest,
  teamId: string,
): NewTaskInput {
  if (!sos.linkedIncidentId) throw new Error("SOS chưa liên kết với sự cố.");
  return {
    incidentId: sos.linkedIncidentId,
    title: `Cứu hộ ${sos.peopleAtRisk} người tại ${sos.location.name}`,
    type: "Cứu hộ SOS",
    priority:
      sos.priority === "P1 — Khẩn cấp"
        ? "Khẩn cấp"
        : sos.priority === "P2 — Cao"
          ? "Cao"
          : sos.priority === "P3 — Trung bình"
            ? "Trung bình"
            : "Thấp",
    teamId,
    assignee: "",
    location: sos.location.address,
    dueAt: "21/08/2026 12:00",
    description: sos.description,
  };
}
export function evacuationInputFromSos(
  sos: SosRequest,
  shelterId: string,
): NewEvacuationInput {
  if (!sos.linkedIncidentId) throw new Error("SOS chưa liên kết với sự cố.");
  return {
    incidentId: sos.linkedIncidentId,
    sourceArea: sos.location.name,
    sourceCoordinates: sos.location.coordinates,
    destinationShelterId: shelterId,
    estimatedPopulation: sos.peopleAtRisk,
    priority:
      sos.priority === "P1 — Khẩn cấp"
        ? "Khẩn cấp"
        : sos.priority === "P2 — Cao"
          ? "Cao"
          : "Trung bình",
    expectedCompletion: "21/08/2026 13:00",
    notes: `Tạo từ ${sos.id}`,
  };
}
export function resolveSos(
  sos: SosRequest,
  summary: string,
  timestamp: string,
): SosRequest {
  if (!summary.trim()) throw new Error("Phải nhập kết quả xử lý.");
  if (!["Đang cứu hộ", "Đã điều phối"].includes(sos.status))
    throw new Error("SOS chưa ở giai đoạn có thể đánh dấu đã xử lý.");
  return {
    ...sos,
    status: "Đã xử lý",
    resolutionSummary: summary,
    lastUpdatedAt: timestamp,
  };
}
