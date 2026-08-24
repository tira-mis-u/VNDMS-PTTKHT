import type { IncidentSeverity } from "../../domain/incidents/types";
import type { RescueTeam } from "../../domain/teams/types";
import type { SosPriority, SosRequest } from "../../domain/sos/types";
import type { Incident } from "../../domain/incidents/types";
import type { IncidentTask } from "../../domain/tasks/types";
import type { OperationalAlert } from "../../domain/alerts/types";
import type { CreateIncidentInput } from "../incidents/incidentUseCases";
import type { NewTaskInput } from "../tasks/taskUseCases";
import { canReleaseTaskAssignment } from "../tasks/taskUseCases";
import type { Permission } from "../../lib/permissions/permissions";

/**
 * Command Center Operational Actions: compose các capability ĐÃ CÓ của
 * Incident/Task/Team/SOS/Alert thành workflow cho 5 quick actions. Module này
 * không sở hữu operational dataset — mọi candidate đọc từ authorized view của
 * store, mọi hành động thực thi qua store command (canonical mutation
 * boundary). Plan chỉ được phép thực thi sau khi người dùng xác nhận.
 */

export type QuickActionLabel =
  | "Tạo sự cố"
  | "Giao nhiệm vụ"
  | "Gửi cảnh báo"
  | "Điều phối đội"
  | "Xử lý SOS";

export type SosTriageMode = "verify" | "priority" | "reject" | "rescue";

export type DispatchMode = "dispatch" | "recall";

export const dispatchModeLabels: Record<DispatchMode, string> = {
  dispatch: "Điều đội tới sự cố",
  recall: "Thu hồi đội khỏi nhiệm vụ",
};

export const sosTriageModeLabels: Record<SosTriageMode, string> = {
  verify: "Hoàn tất xác minh",
  priority: "Điều chỉnh mức ưu tiên",
  reject: "Từ chối SOS không hợp lệ",
  rescue: "Điều đội cứu hộ",
};

export const quickActionLabels: QuickActionLabel[] = [
  "Tạo sự cố",
  "Giao nhiệm vụ",
  "Gửi cảnh báo",
  "Điều phối đội",
  "Xử lý SOS",
];

export type CommandCenterActionPlan =
  | {
      kind: "create_incident";
      label: "Tạo sự cố";
      permission: Extract<Permission, "create">;
      input: CreateIncidentInput;
      resources: string[];
    }
  | {
      kind: "create_task";
      label: "Giao nhiệm vụ";
      permission: Extract<Permission, "task_create">;
      input: NewTaskInput;
      resources: string[];
    }
  | {
      kind: "acknowledge_alert";
      label: "Gửi cảnh báo";
      permission: Extract<Permission, "alert_acknowledge">;
      alertKey: string;
      resources: string[];
    }
  | {
      kind: "dispatch_team";
      label: "Điều phối đội";
      permission: Extract<Permission, "dispatch">;
      incidentId: string;
      teamId: string;
      resources: string[];
    }
  | {
      kind: "recall_team";
      label: "Điều phối đội";
      permission: Extract<Permission, "team_assign">;
      teamId: string;
      resources: string[];
    }
  | {
      kind: "sos_triage";
      label: "Xử lý SOS";
      permission: Extract<
        Permission,
        "sos_verify" | "sos_triage" | "sos_dispatch"
      >;
      sosId: string;
      mode: SosTriageMode;
      priority?: SosPriority;
      teamId?: string;
      resources: string[];
    };

export interface CommandCenterActionContext {
  incidents: Incident[];
  teams: RescueTeam[];
  sosRequests: SosRequest[];
  alerts: OperationalAlert[];
  tasks?: IncidentTask[];
}

export const incidentTypeOptions = [
  "Lũ, ngập lụt",
  "Ngập đô thị",
  "Sạt lở",
  "Giông lốc",
];

export const incidentSeverityOptions: IncidentSeverity[] = [
  "Khẩn cấp",
  "Cao",
  "Trung bình",
  "Thấp",
];

export const taskTypeOptions = [
  "Cứu hộ",
  "Sơ tán",
  "Vận chuyển",
  "Kiểm tra",
];

export const taskPriorityOptions = ["Khẩn cấp", "Cao", "Trung bình", "Thấp"];

export const sosPriorityOptions: SosPriority[] = [
  "P1 — Khẩn cấp",
  "P2 — Cao",
  "P3 — Trung bình",
  "P4 — Thấp",
];

/** Sự cố còn mở, có thể tạo nhiệm vụ/điều đội tới. */
export function openIncidents(context: Pick<CommandCenterActionContext, "incidents">) {
  return context.incidents.filter((incident) => incident.status !== "Đã đóng");
}

/** SOS còn phải xử lý trong ca trực — mức ưu tiên và thời điểm tiếp nhận trước. */
export function triageableSos(
  context: Pick<CommandCenterActionContext, "sosRequests">,
) {
  return [...context.sosRequests]
    .filter(
      (sos) =>
        sos.verificationStatus !== "Không hợp lệ" &&
        !["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(sos.status),
    )
    .sort(
      (a, b) =>
        sosPriorityOptions.indexOf(a.priority) -
          sosPriorityOptions.indexOf(b.priority) ||
        b.receivedAt.localeCompare(a.receivedAt),
    );
}

/** Cảnh báo (Authorized Alert View) đang chờ xác nhận tiếp nhận. */
export function acknowledgeableAlerts(
  context: Pick<CommandCenterActionContext, "alerts">,
) {
  return context.alerts.filter(
    (alert) => alert.requiresAcknowledgement && !alert.acknowledgedAt,
  );
}

/** Đội sẵn sàng điều phối — khớp predicate đang dùng trong các dialog hiện hữu. */
export function dispatchableTeams(
  context: Pick<CommandCenterActionContext, "teams">,
) {
  return context.teams.filter(
    (team) =>
      team.status === "Sẵn sàng" &&
      !team.currentTask &&
      !team.currentEvacuationOperation,
  );
}

/** Đội đang giữ nhiệm vụ có thể thu hồi theo lifecycle — khớp `canReleaseTaskAssignment`. */
export function recallableTeams(
  context: Pick<CommandCenterActionContext, "teams" | "tasks">,
) {
  const tasks = context.tasks ?? [];
  return context.teams
    .map((team) => ({
      team,
      task: tasks.find((task) => task.id === team.currentTask),
    }))
    .filter(
      (item): item is { team: (typeof context.teams)[number]; task: (typeof tasks)[number] } =>
        Boolean(item.team.currentTask) &&
        Boolean(item.task) &&
        canReleaseTaskAssignment(item.task!),
    );
}

export type PlanResult =
  | { ok: true; plan: CommandCenterActionPlan; summaryLines: string[] }
  | { ok: false; error: string };

const invalid = (error: string): PlanResult => ({ ok: false, error });
const valid = (
  plan: CommandCenterActionPlan,
  summaryLines: string[],
): PlanResult => ({ ok: true, plan, summaryLines });

function assertConfirmed(confirmed: boolean) {
  return confirmed ? null : "Thao tác chưa được xác nhận.";
}

function findIncident(context: CommandCenterActionContext, incidentId: string) {
  return context.incidents.find((incident) => incident.id === incidentId);
}

function findSos(context: CommandCenterActionContext, sosId: string) {
  return context.sosRequests.find((sos) => sos.id === sosId);
}

export function buildCreateIncidentPlan(
  input: {
    confirmed: boolean;
    title: string;
    type: string;
    severity: IncidentSeverity;
    area: string;
    description: string;
  },
): PlanResult {
  const notConfirmed = assertConfirmed(input.confirmed);
  if (notConfirmed) return invalid(notConfirmed);
  if (!input.title.trim()) return invalid("Tên sự cố không được để trống.");
  if (!input.area.trim()) return invalid("Khu vực sự cố không được để trống.");
  const incidentInput: CreateIncidentInput = {
    title: input.title.trim(),
    type: input.type,
    severity: input.severity,
    location: { name: input.area.trim(), coordinates: [105.825, 21.071] },
    description: input.description.trim(),
  };
  return valid(
    {
      kind: "create_incident",
      label: "Tạo sự cố",
      permission: "create",
      input: incidentInput,
      resources: [`Khu vực: ${incidentInput.location.name}`],
    },
    [
      `Sự cố “${incidentInput.title}” sẽ được tiếp nhận với mức ${incidentInput.severity}.`,
      `Khu vực: ${incidentInput.location.name}.`,
      "Sự cố mới xuất hiện trong hàng đợi Trung tâm điều hành và danh sách Sự cố.",
    ],
  );
}

export function buildCreateTaskPlan(
  context: CommandCenterActionContext,
  input: {
    confirmed: boolean;
    incidentId: string;
    title: string;
    type: string;
    priority: string;
    teamId: string;
    dueAt: string;
    description: string;
  },
): PlanResult {
  const notConfirmed = assertConfirmed(input.confirmed);
  if (notConfirmed) return invalid(notConfirmed);
  const incident = findIncident(context, input.incidentId);
  if (!incident) return invalid("Phải chọn sự cố liên quan trong phạm vi hiện tại.");
  if (incident.status === "Đã đóng")
    return invalid("Sự cố đã đóng, không thể giao nhiệm vụ mới.");
  if (!input.title.trim()) return invalid("Tên nhiệm vụ không được để trống.");
  if (!input.dueAt.trim()) return invalid("Phải có thời hạn hoàn thành.");
  if (input.teamId && !context.teams.some((team) => team.id === input.teamId))
    return invalid("Đội được chọn không nằm trong phạm vi truy cập hiện tại.");
  const taskInput: NewTaskInput = {
    incidentId: incident.id,
    title: input.title.trim(),
    type: input.type,
    priority: input.priority as NewTaskInput["priority"],
    teamId: input.teamId || "",
    assignee: input.teamId
      ? (context.teams.find((team) => team.id === input.teamId)?.leader ?? "")
      : "",
    location: incident.location.name,
    dueAt: input.dueAt.trim(),
    description: input.description.trim(),
  };
  const resources = [
    `Sự cố: ${incident.id} · ${incident.title}`,
    ...(input.teamId ? [`Đội phụ trách: ${input.teamId}`] : []),
  ];
  return valid(
    {
      kind: "create_task",
      label: "Giao nhiệm vụ",
      permission: "task_create",
      input: taskInput,
      resources,
    },
    [
      `Nhiệm vụ “${taskInput.title}” (mức ${taskInput.priority}) sẽ gắn với ${incident.id}.`,
      input.teamId
        ? `Đội ${input.teamId} được gán ngay và áp dụng ràng buộc điều động hiện hữu.`
        : "Nhiệm vụ ở trạng thái chờ giao đội.",
      `Hạn hoàn thành: ${taskInput.dueAt}.`,
    ],
  );
}

export function buildAcknowledgeAlertPlan(
  context: CommandCenterActionContext,
  input: { confirmed: boolean; alertKey: string },
): PlanResult {
  const notConfirmed = assertConfirmed(input.confirmed);
  if (notConfirmed) return invalid(notConfirmed);
  const candidates = acknowledgeableAlerts(context);
  const alert = candidates.find((item) => item.key === input.alertKey);
  if (!candidates.length)
    return invalid("Không có cảnh báo nào đang chờ xác nhận tiếp nhận.");
  if (!alert)
    return invalid(
      "Cảnh báo đã được xác nhận hoặc điều kiện tạo cảnh báo đã thay đổi.",
    );
  return valid(
    {
      kind: "acknowledge_alert",
      label: "Gửi cảnh báo",
      permission: "alert_acknowledge",
      alertKey: alert.key,
      resources: [
        `Nguồn: ${alert.source.label} ${alert.source.code}`,
        `Phạm vi: ${alert.geographicScope || "Toàn quốc"}`,
      ],
    },
    [
      `Xác nhận đã tiếp nhận “${alert.title}” (mức ${alert.severity === "critical" ? "Khẩn cấp" : alert.severity}).`,
      "Thao tác ghi nhận người thực hiện và thời điểm xác nhận; cảnh báo vẫn được suy ra từ dữ liệu nghiệp vụ chính thức.",
    ],
  );
}

export function buildDispatchTeamPlan(
  context: CommandCenterActionContext,
  input: { confirmed: boolean; incidentId: string; teamId: string },
): PlanResult {
  const notConfirmed = assertConfirmed(input.confirmed);
  if (notConfirmed) return invalid(notConfirmed);
  const incident = findIncident(context, input.incidentId);
  if (!incident)
    return invalid("Phải chọn sự cố cần điều phối trong phạm vi hiện tại.");
  if (incident.status === "Đã đóng")
    return invalid("Sự cố đã đóng, không thể điều đội tới.");
  const team = context.teams.find((item) => item.id === input.teamId);
  if (!team)
    return invalid("Phải chọn đội trong phạm vi truy cập hiện tại.");
  if (team.status !== "Sẵn sàng" || team.currentTask || team.currentEvacuationOperation)
    return invalid(
      `Đội ${team.id} hiện không sẵn sàng (${team.status}${team.currentTask ? `, đang nhiệm vụ ${team.currentTask}` : ""}${team.currentEvacuationOperation ? `, đang sơ tán ${team.currentEvacuationOperation}` : ""}).`,
    );
  return valid(
    {
      kind: "dispatch_team",
      label: "Điều phối đội",
      permission: "dispatch",
      incidentId: incident.id,
      teamId: team.id,
      resources: [
        `Sự cố: ${incident.id} · ${incident.title}`,
        `Đội: ${team.id} · ${team.name}`,
        `Khu vực: ${incident.location.name}`,
      ],
    },
    [
      `Đội ${team.id} sẽ chuyển sang điều động tới ${incident.id}.`,
      `Phạm vi địa bàn sự cố: ${incident.affectedArea || incident.location.name}.`,
      "Điều kiện sẵn sàng và điều động được kiểm tra lại tại quy trình cập nhật an toàn.",
    ],
  );
}

export function buildRecallTeamPlan(
  context: CommandCenterActionContext,
  input: { confirmed: boolean; teamId: string },
): PlanResult {
  const notConfirmed = assertConfirmed(input.confirmed);
  if (notConfirmed) return invalid(notConfirmed);
  const team = context.teams.find((item) => item.id === input.teamId);
  if (!team) return invalid("Phải chọn đội trong phạm vi truy cập hiện tại.");
  if (!team.currentTask)
    return invalid(`Đội ${team.id} không giữ nhiệm vụ nào để thu hồi.`);
  const task = context.tasks?.find((item) => item.id === team.currentTask);
  if (!task || !canReleaseTaskAssignment(task))
    return invalid(
      `Nhiệm vụ ${team.currentTask} đang ở trạng thái “${task?.status ?? "không xác định"}” — chỉ có thể thu hồi khi nhiệm vụ chưa được tiếp nhận hoặc bắt đầu.`,
    );
  return valid(
    {
      kind: "recall_team",
      label: "Điều phối đội",
      permission: "team_assign",
      teamId: team.id,
      resources: [
        `Đội: ${team.id} · ${team.name}`,
        `Nhiệm vụ đang giữ: ${team.currentTask}${task ? ` · ${task.title}` : ""}`,
      ],
    },
    [
      `Thu hồi đội ${team.id} khỏi nhiệm vụ ${team.currentTask}.`,
      task
        ? `Nhiệm vụ “${task.title}” sẽ trở về trạng thái chờ phân công lại.`
        : "Nhiệm vụ liên quan được cập nhật theo quy trình hiện hữu.",
      "Đồng bộ hai phía đội cứu hộ và nhiệm vụ qua lệnh nghiệp vụ chính thức; đội sau đó có thể được điều phối lại.",
    ],
  );
}

export function buildSosTriagePlan(
  context: CommandCenterActionContext,
  input: {
    confirmed: boolean;
    sosId: string;
    mode: SosTriageMode;
    priority?: SosPriority;
    teamId?: string;
  },
): PlanResult {
  const notConfirmed = assertConfirmed(input.confirmed);
  if (notConfirmed) return invalid(notConfirmed);
  const sos = findSos(context, input.sosId);
  if (!sos)
    return invalid("Phải chọn SOS cần xử lý trong phạm vi hiện tại.");
  if (["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(sos.status))
    return invalid(`SOS ${sos.id} đã kết thúc (“${sos.status}”).`);
  if (sos.verificationStatus === "Không hợp lệ")
    return invalid(`SOS ${sos.id} đã bị đánh giá không hợp lệ.`);
  if (input.mode === "verify") {
    if (sos.verificationStatus === "Đã xác minh")
      return invalid(`SOS ${sos.id} đã được xác minh trước đó.`);
    return valid(
      {
        kind: "sos_triage",
        label: "Xử lý SOS",
        permission: "sos_verify",
        sosId: sos.id,
        mode: "verify",
        resources: [
          `SOS: ${sos.id} · ${sos.location.name}`,
          `Ưu tiên: ${sos.priority} · ${sos.peopleAtRisk} người gặp nguy hiểm`,
        ],
      },
      [
        `Hoàn tất xác minh SOS ${sos.id} (${sos.priority}).`,
        `Địa bàn: ${sos.location.administrativeArea}.`,
        "Sau xác minh có thể điều đội ngay trong cùng danh sách hàng đợi.",
      ],
    );
  }
  if (input.mode === "reject") {
    if (sos.verificationStatus === "Đã xác minh")
      return invalid("Không thể từ chối SOS đã xác minh.");
    return valid(
      {
        kind: "sos_triage",
        label: "Xử lý SOS",
        permission: "sos_verify",
        sosId: sos.id,
        mode: "reject",
        resources: [`SOS: ${sos.id} · ${sos.location.name}`],
      },
      [
        `Từ chối SOS ${sos.id} — đánh giá không hợp lệ.`,
        "Trạng thái và nhật ký được ghi nhận theo quy trình SOS hiện hữu.",
      ],
    );
  }
  if (input.mode === "priority") {
    if (!input.priority) return invalid("Phải chọn mức ưu tiên mới.");
    if (input.priority === sos.priority)
      return invalid("Mức ưu tiên mới trùng mức hiện tại.");
    return valid(
      {
        kind: "sos_triage",
        label: "Xử lý SOS",
        permission: "sos_triage",
        sosId: sos.id,
        mode: "priority",
        priority: input.priority,
        resources: [
          `SOS: ${sos.id} · ${sos.location.name}`,
          `Ưu tiên hiện tại: ${sos.priority}`,
        ],
      },
      [
        `Điều chỉnh ưu tiên SOS ${sos.id}: ${sos.priority} → ${input.priority}.`,
        "Thứ tự hàng đợi Trung tâm điều hành cập nhật theo trạng thái chính thức.",
      ],
    );
  }
  const team = context.teams.find((item) => item.id === input.teamId);
  if (!team) return invalid("Phải chọn đội cứu hộ để điều đội.");
  if (team.status !== "Sẵn sàng" || team.currentTask || team.currentEvacuationOperation)
    return invalid(`Đội ${team.id} hiện không sẵn sàng điều đội.`);
  if (sos.verificationStatus !== "Đã xác minh")
    return invalid(
      "Chỉ điều đội cho SOS đã xác minh — thực hiện “Hoàn tất xác minh” trước.",
    );
  return valid(
    {
      kind: "sos_triage",
      label: "Xử lý SOS",
      permission: "sos_dispatch",
      sosId: sos.id,
      mode: "rescue",
      priority: undefined,
      teamId: team.id,
      resources: [
        `SOS: ${sos.id} · ${sos.location.name}`,
        `Đội: ${team.id} · ${team.name}`,
      ],
    },
    [
      `Tạo nhiệm vụ cứu hộ từ SOS ${sos.id} và gán đội ${team.id}.`,
      `Phạm vi địa bàn: ${sos.location.administrativeArea}.`,
      "Nhiệm vụ mới xuất hiện trong phân hệ Nhiệm vụ và hàng đợi Trung tâm điều hành.",
    ],
  );
}

/** Người dùng đã bấm “Xác nhận và thực hiện” — route plan tới store command. */
export interface CommandCenterActionExecutor {
  createIncident: (input: CreateIncidentInput) => string;
  createTask: (input: NewTaskInput) => string;
  acknowledgeAlert: (alertKey: string) => void;
  dispatchTeam: (incidentId: string, teamId: string) => void;
  releaseTeamFromTask: (teamId: string) => void;
  verifySos: (sosId: string) => void;
  rejectSos: (sosId: string) => void;
  updateSosPriority: (sosId: string, priority: SosPriority) => void;
  createRescueTaskFromSos: (sosId: string, teamId: string) => string;
}

export interface CommandCenterActionOutcome {
  entityId?: string;
  entityPath?: string;
  message: string;
}

export function executeCommandCenterAction(
  commands: CommandCenterActionExecutor,
  plan: CommandCenterActionPlan,
): CommandCenterActionOutcome {
  if (plan.kind === "create_incident") {
    const entityId = commands.createIncident(plan.input);
    return {
      entityId,
      entityPath: `/incidents/${entityId}`,
      message: `Đã tạo sự cố ${entityId} và ghi nhận vào dữ liệu nghiệp vụ chuẩn.`,
    };
  }
  if (plan.kind === "create_task") {
    const entityId = commands.createTask(plan.input);
    return {
      entityId,
      entityPath: `/tasks/${entityId}`,
      message: `Đã giao nhiệm vụ ${entityId}${
        plan.input.teamId ? ` cho đội ${plan.input.teamId}` : ""
      }.`,
    };
  }
  if (plan.kind === "acknowledge_alert") {
    commands.acknowledgeAlert(plan.alertKey);
    return { message: "Đã xác nhận tiếp nhận cảnh báo." };
  }
  if (plan.kind === "dispatch_team") {
    commands.dispatchTeam(plan.incidentId, plan.teamId);
    return {
      entityId: plan.incidentId,
      entityPath: `/incidents/${plan.incidentId}`,
      message: `Đã điều đội ${plan.teamId} tới ${plan.incidentId}.`,
    };
  }
  if (plan.kind === "recall_team") {
    commands.releaseTeamFromTask(plan.teamId);
    return {
      entityId: plan.teamId,
      entityPath: `/teams/${plan.teamId}`,
      message: `Đã thu hồi đội ${plan.teamId} khỏi nhiệm vụ — đội sẵn sàng điều phối lại.`,
    };
  }
  if (plan.mode === "verify") {
    commands.verifySos(plan.sosId);
    return {
      entityId: plan.sosId,
      entityPath: `/sos/${plan.sosId}`,
      message: `Đã hoàn tất xác minh ${plan.sosId}.`,
    };
  }
  if (plan.mode === "reject") {
    commands.rejectSos(plan.sosId);
    return {
      entityId: plan.sosId,
      entityPath: `/sos/${plan.sosId}`,
      message: `Đã từ chối ${plan.sosId} theo quy trình xác minh.`,
    };
  }
  if (plan.mode === "priority") {
    commands.updateSosPriority(plan.sosId, plan.priority!);
    return {
      entityId: plan.sosId,
      entityPath: `/sos/${plan.sosId}`,
      message: `Đã điều chỉnh ưu tiên ${plan.sosId} sang ${plan.priority}.`,
    };
  }
  const entityId = commands.createRescueTaskFromSos(plan.sosId, plan.teamId!);
  return {
    entityId,
    entityPath: `/tasks/${entityId}`,
    message: `Đã tạo nhiệm vụ cứu hộ ${entityId} từ ${plan.sosId} cho đội ${plan.teamId}.`,
  };
}
