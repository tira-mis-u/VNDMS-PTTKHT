import type { Incident } from "../incidents/types";
import type { IncidentTask, TaskUpdate } from "../tasks/types";
import type { RescueTeam } from "../teams/types";
import type { Shelter } from "../shelters/types";
import type { SosRequest } from "../sos/types";
import type {
  AlertCategory,
  AlertCondition,
  AlertInteraction,
  AlertReadReceipt,
  AlertSeverity,
  AlertSourceType,
  AlertStatus,
  DerivedAlert,
  OperationalAlert,
} from "./types";
import { alertSeverityRank } from "./types";
import {
  demoCurrentTime,
  isTaskOverdue,
  parseVietnameseDate,
  taskPriorityRank,
} from "../tasks/rules";
import { isSosWaitingTooLong } from "../sos/rules";
import { calculateShelterCapacity } from "../shelters/rules";

/**
 * Phần canonical state mà việc suy ra cảnh báo cần đọc.
 * Structural subset — OperationalSnapshot thỏa mãn trực tiếp.
 */
export interface AlertDerivationInput {
  incidents: Incident[];
  tasks: IncidentTask[];
  taskUpdates: TaskUpdate[];
  teams: RescueTeam[];
  shelters: Shelter[];
  sosRequests: SosRequest[];
}

/** Đồng hồ demo deterministic, dùng chung với các module canonical khác. */
export const alertClock = demoCurrentTime;

const MINUTE = 60 * 1000;

const minutesBetween = (from: string, to: Date) => {
  const start = parseVietnameseDate(from).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.round((to.getTime() - start) / MINUTE));
};

const fmtDuration = (minutes: number) =>
  minutes >= 120
    ? `${Math.round(minutes / 60)} giờ`
    : `${Math.max(1, minutes)} phút`;

interface AlertSeed {
  category: AlertCategory;
  condition: AlertCondition;
  severity: AlertSeverity;
  title: string;
  message: string;
  sourceType: AlertSourceType;
  sourceId: string;
  sourceCode: string;
  sourcePath: string;
  sourceLabel: string;
  readPermission: DerivedAlert["readPermission"];
  geographicScope?: string;
  ownerTeamId?: string | null;
  detectedAt: string;
}

const makeAlert = (seed: AlertSeed): DerivedAlert => ({
  key: `${seed.category}:${seed.sourceType}:${seed.sourceId}:${seed.condition}`,
  category: seed.category,
  condition: seed.condition,
  severity: seed.severity,
  title: seed.title,
  message: seed.message,
  source: {
    type: seed.sourceType,
    id: seed.sourceId,
    code: seed.sourceCode,
    path: seed.sourcePath,
    label: seed.sourceLabel,
  },
  readPermission: seed.readPermission,
  geographicScope: seed.geographicScope,
  ownerTeamId: seed.ownerTeamId ?? null,
  requiresAcknowledgement: seed.severity === "critical",
  detectedAt: seed.detectedAt,
});

const ACTIVE_INCIDENT: ReadonlyArray<Incident["status"]> = [
  "Mới",
  "Đánh giá",
  "Đang xử lý",
  "Đang điều phối",
];
const OPEN_SOS: ReadonlyArray<SosRequest["status"]> = [
  "Mới tiếp nhận",
  "Đang xác minh",
  "Đã xác minh",
  "Đã điều phối",
  "Đang cứu hộ",
  "Không liên lạc được",
];
const OPEN_TASK: ReadonlyArray<IncidentTask["status"]> = [
  "Chờ giao",
  "Đã giao",
  "Đã tiếp nhận",
  "Đang thực hiện",
  "Chờ xác nhận",
];

function deriveIncidentAlerts(input: AlertDerivationInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const incident of input.incidents) {
    if (!ACTIVE_INCIDENT.includes(incident.status)) continue;
    const scope = `${incident.location.name}, ${incident.affectedArea}`;
    const base = {
      category: "incident" as const,
      sourceType: "Incident" as const,
      sourceId: incident.id,
      sourceCode: incident.code,
      sourcePath: `/incidents/${incident.id}`,
      sourceLabel: "Sự cố thiên tai",
      readPermission: "view" as const,
      geographicScope: scope,
      ownerTeamId: incident.assignedTeamId,
    };
    if (incident.severity === "Khẩn cấp")
      alerts.push(
        makeAlert({
          ...base,
          condition: "incident_critical_active",
          severity: "critical",
          title: `Sự cố khẩn cấp ${incident.code} đang trong quá trình xử lý`,
          message: `${incident.title} tại ${incident.location.name} ở mức Khẩn cấp, trạng thái “${incident.status}”, tiến độ ${incident.progress}%. Cần theo dõi chỉ đạo liên tục cho tới khi kiểm soát.`,
          detectedAt: incident.updatedAt,
        }),
      );
    else if (incident.severity === "Cao" && incident.progress < 50)
      alerts.push(
        makeAlert({
          ...base,
          condition: "incident_high_early_stage",
          severity: "high",
          title: `Sự cố mức Cao ${incident.code} còn ở giai đoạn đầu`,
          message: `${incident.title} tại ${incident.location.name} mới đạt ${incident.progress}% tiến độ. Cần đẩy nhanh điều phối để tránh leo thang.`,
          detectedAt: incident.updatedAt,
        }),
      );
    if (!incident.assignedTeamId && incident.severity !== "Khẩn cấp")
      alerts.push(
        makeAlert({
          ...base,
          condition: "incident_no_team",
          severity: incident.severity === "Cao" ? "high" : "medium",
          title: `Sự cố ${incident.code} chưa có đội phụ trách`,
          message: `${incident.title} tại ${incident.location.name} đang “${incident.status}” nhưng chưa được gán đội cứu hộ nào.`,
          detectedAt: incident.createdAt,
        }),
      );
    // Điều phối "cho có": đội đã được điều tới nhưng chưa có nhiệm vụ nào đang
    // mở cho sự cố → đội đứng chờ vô thời hạn. Alert tự biến mất ngay khi một
    // nhiệm vụ được giao cho sự cố này.
    if (incident.status === "Đang điều phối" && incident.assignedTeamId) {
      const hasOpenTask = input.tasks.some(
        (task) =>
          task.incidentId === incident.id &&
          OPEN_TASK.includes(task.status),
      );
      if (!hasOpenTask)
        alerts.push(
          makeAlert({
            ...base,
            condition: "incident_dispatch_no_task",
            severity: incident.severity === "Khẩn cấp" ? "critical" : "high",
            title: `Sự cố ${incident.code} có đội nhưng chưa có nhiệm vụ`,
            message: `${incident.assignedTeamId} đã được điều phối tới “${incident.title}” nhưng chưa có nhiệm vụ nào đang mở cho sự cố. Giao nhiệm vụ để đội bắt đầu — nếu không, điều phối chỉ nằm trên giấy.`,
            detectedAt: incident.updatedAt,
          }),
        );
    }
    // Mọi nhiệm vụ của sự cố đã xong → nhắc cán bộ chốt "Đã kiểm soát"
    // (quyết định vẫn là của người; alert tự tắt sau khi đổi trạng thái).
    if (incident.status === "Đang xử lý" || incident.status === "Đang điều phối") {
      const incidentTasks = input.tasks.filter(
        (task) =>
          task.incidentId === incident.id && task.status !== "Đã hủy",
      );
      if (
        incidentTasks.length > 0 &&
        incidentTasks.every((task) => task.status === "Hoàn thành")
      )
        alerts.push(
          makeAlert({
            ...base,
            condition: "incident_all_tasks_completed",
            severity: "medium",
            title: `Sự cố ${incident.code} đã xong toàn bộ nhiệm vụ`,
            message: `${incidentTasks.length} nhiệm vụ của “${incident.title}” đều đã hoàn thành, tiến độ ${incident.progress}%. Cân nhắc chuyển sự cố sang “Đã kiểm soát” hoặc đóng khi hiện trường xác nhận an toàn.`,
            detectedAt: incident.updatedAt,
          }),
        );
    }
  }
  return alerts;
}

function deriveSosAlerts(input: AlertDerivationInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const sos of input.sosRequests) {
    if (!OPEN_SOS.includes(sos.status)) continue;
    const base = {
      category: "sos" as const,
      sourceType: "SOS" as const,
      sourceId: sos.id,
      sourceCode: sos.code,
      sourcePath: `/sos/${sos.id}`,
      sourceLabel: "Yêu cầu SOS",
      readPermission: "sos_view" as const,
      geographicScope: sos.location.administrativeArea,
      ownerTeamId: sos.assignedTeamId,
    };
    if (
      sos.priority.startsWith("P1") &&
      sos.verificationStatus === "Đã xác minh" &&
      !sos.assignedTeamId
    ) {
      alerts.push(
        makeAlert({
          ...base,
          condition: "sos_p1_verified_unassigned",
          severity: "critical",
          title: `SOS khẩn cấp ${sos.code} đã xác minh nhưng chưa điều phối`,
          message: `${sos.peopleAtRisk} người đang gặp nguy hiểm tại ${sos.location.name}. Yêu cầu đã xác minh từ ${sos.receivedAt} nhưng chưa có đội cứu hộ nào được điều phối.`,
          detectedAt: sos.receivedAt,
        }),
      );
      continue;
    }
    if (isSosWaitingTooLong(sos)) {
      alerts.push(
        makeAlert({
          ...base,
          condition: "sos_waiting_too_long",
          severity: sos.priority.startsWith("P1") ? "critical" : "high",
          title: `SOS ${sos.code} chờ xử lý ${fmtDuration(minutesBetween(sos.receivedAt, alertClock))}`,
          message: `Yêu cầu từ ${sos.reporter.name} tại ${sos.location.name} tiếp nhận lúc ${sos.receivedAt}, mức ${sos.priority}, hiện “${sos.status}”. Cần rà soát hàng đợi xác minh.`,
          detectedAt: sos.receivedAt,
        }),
      );
      continue;
    }
    if (
      sos.communicationStatus === "Mất liên lạc" ||
      sos.status === "Không liên lạc được"
    )
      alerts.push(
        makeAlert({
          ...base,
          condition: "sos_contact_lost",
          severity: "high",
          title: `Mất liên lạc với SOS ${sos.code}`,
          message: `Lần liên lạc cuối ${sos.lastContactAt} tại ${sos.location.name}. Cần cử lực lượng xác minh hiện trường.`,
          detectedAt: sos.lastContactAt,
        }),
      );
  }
  return alerts;
}

function deriveTaskAlerts(input: AlertDerivationInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const task of input.tasks) {
    if (!OPEN_TASK.includes(task.status)) continue;
    const incident = input.incidents.find(
      (item) => item.id === task.incidentId,
    );
    const base = {
      category: "task" as const,
      sourceType: "Task" as const,
      sourceId: task.id,
      sourceCode: task.id,
      sourcePath: `/tasks/${task.id}`,
      sourceLabel: "Nhiệm vụ cứu hộ",
      readPermission: "task_view" as const,
      geographicScope: incident?.location.name ?? task.location,
      ownerTeamId: task.teamId || null,
    };
    if (isTaskOverdue(task)) {
      alerts.push(
        makeAlert({
          ...base,
          condition: "task_overdue",
          severity: task.priority === "Khẩn cấp" ? "critical" : "high",
          title: `Nhiệm vụ ${task.id} đã quá hạn hoàn thành`,
          message: `“${task.title}” (${task.location}) có hạn ${task.dueAt}, hiện “${task.status}”, tiến độ ${task.progress}%. Cần cập nhật kế hoạch hoặc điều thêm lực lượng.`,
          detectedAt: task.dueAt,
        }),
      );
    }
    if (
      taskPriorityRank[task.priority] >= taskPriorityRank["Cao"] &&
      task.status === "Chờ giao" &&
      !task.teamId
    )
      alerts.push(
        makeAlert({
          ...base,
          condition: "task_high_priority_unassigned",
          severity: task.priority === "Khẩn cấp" ? "critical" : "high",
          title: `Nhiệm vụ ưu tiên ${task.priority} chưa giao đội`,
          message: `“${task.title}” thuộc ${task.incidentId} đang “Chờ giao” và chưa có đội phụ trách. Hạn hoàn thành ${task.dueAt}.`,
          detectedAt: task.createdAt,
        }),
      );
    if (task.status === "Đang thực hiện") {
      const updates = input.taskUpdates
        .filter((update) => update.taskId === task.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const lastBeat = updates[0]?.timestamp;
      const stale =
        updates.length === 0 ||
        (lastBeat ? minutesAgo(lastBeat) : Number.POSITIVE_INFINITY) > 3 * 60;
      if (stale && task.progress < 50)
        alerts.push(
          makeAlert({
            ...base,
            condition: "task_stalled",
            severity: "medium",
            title: `Nhiệm vụ ${task.id} đang đình trệ`,
            message: `“${task.title}” đang thực hiện nhưng tiến độ ${task.progress}% và ${
              lastBeat
                ? `chưa có cập nhật hiện trường trong ${fmtDuration(minutesAgo(lastBeat))}`
                : "chưa có báo cáo hiện trường nào"
            }.`,
            detectedAt: lastBeat
              ? `21/08/2026 ${lastBeat}`
              : task.updatedAt,
          }),
        );
    }
  }
  return alerts;
}

function minutesAgo(timeOnly: string) {
  const [hour, minute] = timeOnly.split(":").map(Number);
  const at = new Date(alertClock);
  at.setHours(hour, minute, 0, 0);
  return Math.max(0, Math.round((alertClock.getTime() - at.getTime()) / MINUTE));
}

function deriveTeamAlerts(input: AlertDerivationInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  const crisisOngoing = input.incidents.some(
    (incident) =>
      incident.severity === "Khẩn cấp" &&
      ACTIVE_INCIDENT.includes(incident.status),
  );
  for (const team of input.teams) {
    const base = {
      category: "team" as const,
      sourceType: "Team" as const,
      sourceId: team.id,
      sourceCode: team.code,
      sourcePath: `/teams/${team.id}`,
      sourceLabel: "Đội cứu hộ",
      readPermission: "team_view" as const,
      geographicScope: `${team.region}, ${team.operatingScope}`,
      ownerTeamId: team.id,
    };
    if (
      team.status === "Mất liên lạc" ||
      team.communicationStatus === "Mất liên lạc"
    )
      alerts.push(
        makeAlert({
          ...base,
          condition: "team_communication_lost",
          severity: "high",
          title: `Đội ${team.code} mất liên lạc`,
          message: `Không nhận được vị trí/liên lạc mới từ ${team.name} kể từ ${team.lastLocationUpdate}. Cần xác minh an toàn lực lượng.`,
          detectedAt: team.updatedAt,
        }),
      );
    else if (team.status === "Không khả dụng" && crisisOngoing)
      alerts.push(
        makeAlert({
          ...base,
          condition: "team_unavailable_during_response",
          severity: "medium",
          title: `Đội ${team.code} không khả dụng khi đang ứng phó khẩn cấp`,
          message: `${team.name} (${team.region}) đang “Không khả dụng” trong khi hệ thống có sự cố mức Khẩn cấp. Cần đánh giá khả năng huy động lại.`,
          detectedAt: team.updatedAt,
        }),
      );
  }
  return alerts;
}

function deriveShelterAlerts(input: AlertDerivationInput): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const shelter of input.shelters) {
    const capacity = calculateShelterCapacity(shelter);
    const base = {
      category: "shelter" as const,
      sourceType: "Shelter" as const,
      sourceId: shelter.id,
      sourceCode: shelter.code,
      sourcePath: `/shelters/${shelter.id}`,
      sourceLabel: "Điểm sơ tán",
      readPermission: "shelter_view" as const,
      geographicScope: shelter.administrativeArea,
    };
    if (capacity.isOverloaded || shelter.status === "Quá tải")
      alerts.push(
        makeAlert({
          ...base,
          condition: "shelter_overloaded",
          severity: "critical",
          title: `Điểm sơ tán ${shelter.code} đang quá tải`,
          message: `${shelter.name} đang chứa ${shelter.currentOccupancy}/${shelter.capacity} người. Cần mở điểm mới hoặc điều chuyển ngay.`,
          detectedAt: shelter.updatedAt,
        }),
      );
    else if (capacity.isNearCapacity || shelter.status === "Gần đầy")
      alerts.push(
        makeAlert({
          ...base,
          condition: "shelter_near_capacity",
          severity: "high",
          title: `Điểm sơ tán ${shelter.code} sắp hết sức chứa`,
          message: `${shelter.name} chỉ còn ${capacity.availableCapacity} chỗ khả dụng (${shelter.currentOccupancy}/${shelter.capacity}, đã giữ ${shelter.reservedCapacity}). Cần chuẩn bị điểm dự phòng.`,
          detectedAt: shelter.updatedAt,
        }),
      );
    if (
      shelter.accessibility === "Không thể tiếp cận" ||
      shelter.status === "Không thể tiếp cận"
    )
      alerts.push(
        makeAlert({
          ...base,
          condition: "shelter_inaccessible",
          severity: "medium",
          title: `Không thể tiếp cận điểm sơ tán ${shelter.code}`,
          message: `${shelter.name} tại ${shelter.administrativeArea} hiện không thể tiếp cận. Sức chứa ${shelter.capacity} chỗ đang bị khóa khỏi kế hoạch sơ tán.`,
          detectedAt: shelter.updatedAt,
        }),
      );
  }
  return alerts;
}

export function compareAlerts(a: DerivedAlert, b: DerivedAlert) {
  return (
    alertSeverityRank[b.severity] - alertSeverityRank[a.severity] ||
    parseVietnameseDate(b.detectedAt).getTime() -
      parseVietnameseDate(a.detectedAt).getTime() ||
    a.key.localeCompare(b.key)
  );
}

/**
 * Suy ra toàn bộ cảnh báo tác nghiệp từ canonical state.
 * Thuần túy, deterministic, khử trùng lặp theo alert key.
 * Khi điều kiện không còn đúng, cảnh báo tự biến mất khỏi kết quả.
 */
export function deriveOperationalAlerts(
  input: AlertDerivationInput,
): DerivedAlert[] {
  const alerts = [
    ...deriveIncidentAlerts(input),
    ...deriveSosAlerts(input),
    ...deriveTaskAlerts(input),
    ...deriveTeamAlerts(input),
    ...deriveShelterAlerts(input),
  ];
  const seen = new Set<string>();
  return alerts
    .filter((alert) => {
      if (seen.has(alert.key)) return false;
      seen.add(alert.key);
      return true;
    })
    .sort(compareAlerts);
}

export function resolveAlertState(
  alert: DerivedAlert,
  interaction: AlertInteraction | undefined,
  userId: string,
): OperationalAlert {
  const receipt = interaction?.readBy.find((item) => item.userId === userId);
  const acknowledgement = interaction?.acknowledgement ?? null;
  const status: AlertStatus = acknowledgement
    ? "Đã xác nhận"
    : receipt
      ? "Đã đọc"
      : "Chưa đọc";
  return {
    ...alert,
    status,
    readAt: receipt?.readAt ?? null,
    acknowledgedAt: acknowledgement?.at ?? null,
    acknowledgedBy: acknowledgement?.actor ?? null,
  };
}

export function resolveAlertsForUser(
  alerts: DerivedAlert[],
  interactions: AlertInteraction[],
  userId: string,
): OperationalAlert[] {
  const byKey = new Map(
    interactions.map((interaction) => [interaction.alertKey, interaction]),
  );
  return alerts.map((alert) =>
    resolveAlertState(alert, byKey.get(alert.key), userId),
  );
}

export function assertAlertCanAcknowledge(alert: OperationalAlert) {
  if (!alert.requiresAcknowledgement)
    throw new Error("Cảnh báo này không yêu cầu xác nhận.");
  if (alert.acknowledgedAt)
    throw new Error("Cảnh báo này đã được xác nhận trước đó.");
}

export function markAlertUnread(
  interactions: AlertInteraction[],
  alertKey: string,
  userId: string,
): AlertInteraction[] {
  return interactions
    .map((item) =>
      item.alertKey === alertKey
        ? {
            ...item,
            readBy: item.readBy.filter((receipt) => receipt.userId !== userId),
          }
        : item,
    )
    .filter(
      (item) => item.readBy.length > 0 || item.acknowledgement !== null,
    );
}

export function markAlertRead(
  interactions: AlertInteraction[],
  alertKey: string,
  receipt: AlertReadReceipt,
): AlertInteraction[] {
  const existing = interactions.find((item) => item.alertKey === alertKey);
  if (existing?.readBy.some((item) => item.userId === receipt.userId))
    return interactions;
  if (!existing)
    return [
      {
        alertKey,
        readBy: [receipt],
        acknowledgement: null,
      },
      ...interactions,
    ];
  return interactions.map((item) =>
    item.alertKey === alertKey
      ? { ...item, readBy: [receipt, ...item.readBy] }
      : item,
  );
}

export function acknowledgeAlert(
  interactions: AlertInteraction[],
  alertKey: string,
  acknowledgement: NonNullable<AlertInteraction["acknowledgement"]>,
): AlertInteraction[] {
  const existing = interactions.find((item) => item.alertKey === alertKey);
  if (!existing)
    return [{ alertKey, readBy: [], acknowledgement }, ...interactions];
  return interactions.map((item) =>
    item.alertKey === alertKey ? { ...item, acknowledgement } : item,
  );
}
