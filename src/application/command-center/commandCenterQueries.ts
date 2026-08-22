import type { OperationalSnapshot } from "../operations/operationalSnapshot";
import type { SimulationState } from "../../domain/simulation/types";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import { isEvacuationDelayed } from "../../domain/evacuations/rules";
import { isSosWaitingTooLong } from "../../domain/sos/rules";
import { isTaskOverdue, taskPriorityRank } from "../../domain/tasks/rules";

export type CommandCenterEntityKind =
  "incident" | "sos" | "team" | "shelter" | "warehouse";
export type CommandCenterEntityRef = {
  kind: CommandCenterEntityKind;
  id: string;
};
export type CommandTone = "red" | "amber" | "blue" | "green" | "neutral";

export const commandCenterScenario = {
  id: "red-river-flood-hanoi",
  name: "Lũ Sông Hồng — Hà Nội",
  scope: "Hà Nội",
} as const;

export function getCommandCenterHeader(
  source: OperationalSnapshot,
  simulation: SimulationState,
) {
  const active = source.incidents.filter(
    (item) => !["Đã đóng", "Đã kiểm soát"].includes(item.status),
  );
  const updatedAt =
    source.events[0]?.timestamp ??
    source.incidents[0]?.updatedAt ??
    "Chưa có cập nhật";
  return {
    ...commandCenterScenario,
    status:
      simulation.status === "Đang chạy"
        ? "Đang mô phỏng"
        : active.length
          ? "Đang ứng phó"
          : "Đang theo dõi",
    updatedAt,
  };
}

const severityRank: Record<string, number> = {
  "Khẩn cấp": 4,
  Cao: 3,
  "Trung bình": 2,
  Thấp: 1,
};
export function getSituationSummary(source: OperationalSnapshot) {
  const active = source.incidents.filter(
    (item) => !["Đã đóng", "Đã kiểm soát"].includes(item.status),
  );
  const lead = [...active].sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity],
  )[0];
  const deployedTeams = source.teams.filter((team) =>
    ["Đang điều động", "Đang thực hiện"].includes(team.status),
  );
  const teamExceptions = source.teams.filter((team) =>
    ["Mất liên lạc", "Không khả dụng"].includes(team.status),
  );
  return {
    level: lead?.severity ?? "Thấp",
    description: lead
      ? `${lead.title} tại ${lead.location.name} đang là sự cố ưu tiên cao nhất trong phạm vi được phép đọc.`
      : "Không có sự cố đang xử lý trong phạm vi được phép đọc.",
    metrics: [
      {
        label: "Sự cố đang xử lý",
        value: String(active.length).padStart(2, "0"),
      },
      {
        label: "Đội đang triển khai",
        value: String(deployedTeams.length).padStart(2, "0"),
      },
      {
        label: "Đội sẵn sàng",
        value: String(
          source.teams.filter((team) => team.status === "Sẵn sàng").length,
        ).padStart(2, "0"),
      },
      {
        label: "Ngoại lệ lực lượng",
        value: String(teamExceptions.length).padStart(2, "0"),
        tone: "red" as const,
      },
    ],
  };
}

export interface CommandCenterActionItem {
  id: string;
  type: string;
  priority: string;
  tone: "red" | "amber" | "blue";
  title: string;
  area: string;
  time: string;
  status: string;
  action: string;
  path: string;
  ref: CommandCenterEntityRef;
}

export function getCommandCenterActionQueue(
  source: OperationalSnapshot,
): CommandCenterActionItem[] {
  const sosItems: CommandCenterActionItem[] = source.sosRequests
    .filter(
      (sos) =>
        !["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(sos.status) &&
        (sos.priority.startsWith("P1") ||
          !sos.assignedTeamId ||
          isSosWaitingTooLong(sos)),
    )
    .map((sos) => ({
      id: sos.id,
      type: "SOS khẩn cấp",
      priority: sos.priority,
      tone: sos.priority.startsWith("P1") ? "red" : "amber",
      title: sos.description,
      area: sos.location.name,
      time: sos.receivedAt,
      status: sos.status,
      action: "Xử lý",
      path: `/sos/${sos.id}`,
      ref: { kind: "sos", id: sos.id },
    }));
  const incidentItems: CommandCenterActionItem[] = source.incidents
    .filter((item) => item.status === "Mới" || !item.assignedTeamId)
    .map((item) => ({
      id: item.id,
      type: "Sự cố",
      priority: item.severity === "Khẩn cấp" ? "Khẩn cấp" : "Cần đánh giá",
      tone: item.severity === "Khẩn cấp" ? "red" : "amber",
      title: item.title,
      area: item.location.name,
      time: item.createdAt,
      status: item.status,
      action: item.assignedTeamId ? "Đánh giá" : "Phân công",
      path: `/incidents/${item.id}`,
      ref: { kind: "incident", id: item.id },
    }));
  const taskItems: CommandCenterActionItem[] = source.tasks
    .filter(
      (task) =>
        !["Hoàn thành", "Đã hủy"].includes(task.status) &&
        (isTaskOverdue(task) ||
          task.priority === "Khẩn cấp" ||
          task.status === "Chờ giao"),
    )
    .sort(
      (a, b) =>
        Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) ||
        taskPriorityRank[b.priority] - taskPriorityRank[a.priority],
    )
    .map((task) => ({
      id: task.id,
      type: "Nhiệm vụ",
      priority: isTaskOverdue(task) ? "Quá hạn" : task.priority,
      tone:
        isTaskOverdue(task) || task.priority === "Khẩn cấp"
          ? "red"
          : task.priority === "Cao"
            ? "amber"
            : "blue",
      title: task.title,
      area: task.location,
      time: task.dueAt,
      status: task.status,
      action: task.status === "Chờ giao" ? "Phân công" : "Xử lý",
      path: `/tasks/${task.id}`,
      ref: { kind: "incident", id: task.incidentId },
    }));
  const teamItems: CommandCenterActionItem[] = source.teams
    .filter((team) => team.status === "Mất liên lạc")
    .map((team) => ({
      id: team.id,
      type: "Đội cứu hộ",
      priority: "Mất liên lạc",
      tone: "red",
      title: `Không nhận được vị trí mới từ ${team.name}`,
      area: team.region,
      time: team.lastLocationUpdate,
      status: team.status,
      action: "Kiểm tra",
      path: `/teams/${team.id}`,
      ref: { kind: "team", id: team.id },
    }));
  return [...sosItems, ...teamItems, ...taskItems, ...incidentItems].slice(
    0,
    5,
  );
}

export interface CommandCenterTimelineItem {
  id: string;
  time: string;
  title: string;
  meta: string;
  tone: CommandTone;
}
export function getCommandCenterTimeline(
  source: OperationalSnapshot,
): CommandCenterTimelineItem[] {
  const incidentEvents = source.events.map((event) => ({
    id: event.id,
    time: event.timestamp,
    title: event.message,
    meta: `${event.incidentId} · ${event.actor}`,
    tone:
      event.type === "closed"
        ? ("green" as const)
        : event.type === "severity"
          ? ("amber" as const)
          : ("blue" as const),
  }));
  const teamEvents = source.teamEvents.map((event) => ({
    id: event.id,
    time: event.timestamp,
    title: event.message,
    meta: `${event.teamId} · ${event.actor}`,
    tone:
      event.type === "communication"
        ? ("red" as const)
        : event.type === "location"
          ? ("green" as const)
          : ("blue" as const),
  }));
  const sosEvents = source.sosEvents.map((event) => ({
    id: event.id,
    time: event.timestamp,
    title: event.message,
    meta: `${event.sosId} · ${event.actor}`,
    tone:
      event.type === "resolved"
        ? ("green" as const)
        : event.type === "communication"
          ? ("red" as const)
          : ("blue" as const),
  }));
  return [...teamEvents, ...sosEvents, ...incidentEvents].slice(0, 5);
}

export interface CommandCenterExceptionItem {
  id: string;
  kind: "team" | "shelter" | "evacuation" | "sos" | "warehouse";
  name: string;
  owner: string;
  value: number;
  display: string;
  state: string;
  tone: "red" | "amber" | "blue";
  action: string;
}
export function getCommandCenterResourceExceptions(
  source: OperationalSnapshot,
): CommandCenterExceptionItem[] {
  const sosItems: CommandCenterExceptionItem[] = source.sosRequests
    .filter(
      (sos) =>
        !["Đã đóng", "Từ chối", "Hủy"].includes(sos.status) &&
        (sos.priority.startsWith("P1") ||
          isSosWaitingTooLong(sos) ||
          !sos.assignedTeamId),
    )
    .map((sos) => ({
      id: sos.id,
      kind: "sos",
      name: sos.location.name,
      owner: `Yêu cầu ${sos.id}`,
      value: sos.status === "Đang cứu hộ" ? 65 : sos.assignedTeamId ? 35 : 10,
      display: !sos.assignedTeamId ? "Chưa giao đội" : sos.status,
      state: sos.priority,
      tone: sos.priority.startsWith("P1") ? "red" : "amber",
      action: "Xử lý",
    }));
  const shelterItems: CommandCenterExceptionItem[] = source.shelters
    .filter((shelter) =>
      ["Quá tải", "Gần đầy", "Không thể tiếp cận"].includes(shelter.status),
    )
    .map((shelter) => {
      const capacity = calculateShelterCapacity(shelter);
      return {
        id: shelter.id,
        kind: "shelter",
        name: shelter.name,
        owner: `Điểm sơ tán ${shelter.id}`,
        value: Math.min(100, capacity.occupancyPercentage),
        display:
          shelter.status === "Không thể tiếp cận"
            ? shelter.accessibility
            : `${shelter.currentOccupancy}/${shelter.capacity} người`,
        state: shelter.status,
        tone: shelter.status === "Gần đầy" ? "amber" : "red",
        action: "Xử lý",
      };
    });
  const evacuationItems: CommandCenterExceptionItem[] =
    source.evacuationOperations
      .filter(isEvacuationDelayed)
      .map((operation) => ({
        id: operation.id,
        kind: "evacuation",
        name: operation.sourceArea,
        owner: `Sơ tán ${operation.id}`,
        value: operation.progress,
        display: operation.route.status,
        state: operation.status,
        tone: "amber",
        action: "Điều phối",
      }));
  const teamItems: CommandCenterExceptionItem[] = source.teams
    .filter(
      (team) =>
        team.status === "Mất liên lạc" || team.status === "Không khả dụng",
    )
    .map((team) => ({
      id: team.id,
      kind: "team",
      name: team.name,
      owner: `Đội cứu hộ ${team.id}`,
      value: team.status === "Mất liên lạc" ? 0 : 20,
      display:
        team.status === "Mất liên lạc"
          ? `Vị trí cuối ${team.lastLocationUpdate}`
          : team.availability,
      state: team.status,
      tone: "red",
      action: "Kiểm tra",
    }));
  const warehouseItems: CommandCenterExceptionItem[] = source.inventory
    .filter(
      (item) =>
        item.quantityOnHand - item.quantityReserved <= item.reorderLevel,
    )
    .map((item) => ({
      id: item.warehouseId,
      kind: "warehouse",
      name: item.name,
      owner: `Kho ${item.warehouseId}`,
      value: Math.min(
        100,
        Math.round(
          (item.quantityOnHand / Math.max(1, item.reorderLevel)) * 100,
        ),
      ),
      display: `${item.quantityOnHand - item.quantityReserved} ${item.unit} khả dụng`,
      state: "Dưới ngưỡng",
      tone: "amber",
      action: "Theo dõi",
    }));
  return [
    ...sosItems,
    ...shelterItems,
    ...evacuationItems,
    ...teamItems,
    ...warehouseItems,
  ].slice(0, 4);
}

export function findCommandCenterEntity(
  source: OperationalSnapshot,
  ref: CommandCenterEntityRef,
) {
  if (ref.kind === "incident")
    return source.incidents.find((item) => item.id === ref.id);
  if (ref.kind === "sos")
    return source.sosRequests.find((item) => item.id === ref.id);
  if (ref.kind === "team")
    return source.teams.find((item) => item.id === ref.id);
  if (ref.kind === "shelter")
    return source.shelters.find((item) => item.id === ref.id);
  return source.warehouses.find((item) => item.id === ref.id);
}
