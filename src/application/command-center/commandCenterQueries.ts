import type { OperationalSnapshot } from "../operations/operationalSnapshot";
import type { SimulationState } from "../../domain/simulation/types";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import { isEvacuationDelayed } from "../../domain/evacuations/rules";
import { isSosWaitingTooLong } from "../../domain/sos/rules";
import { isTaskOverdue, taskPriorityRank } from "../../domain/tasks/rules";
import { hasRequestShortage, isReliefOverdue } from "../../domain/relief/rules";

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

/**
 * HÀNG ĐỢI "CẦN XỬ LÝ" — LÕI CỦA TRUNG TÂM ĐIỀU HÀNH
 *
 * Trước đây hàng đợi chỉ gom SOS, sự cố, nhiệm vụ và đội mất liên lạc. Hệ quả:
 * người làm hậu cần cứu trợ hoặc thẩm định thiệt hại mở Trung tâm điều hành ra
 * thì **không thấy việc của mình ở đâu cả** — trong khi đúng những việc đó mới
 * là thứ họ phải xử lý trong ca trực. Nay hàng đợi gom thêm:
 *   • yêu cầu cứu trợ quá hạn / thiếu hàng,
 *   • chuyến hàng gặp sự cố hoặc trễ so với dự kiến,
 *   • hồ sơ đánh giá thiệt hại chờ thẩm định.
 *
 * `canRead` lọc theo quyền đọc của chính người đang trực: không có quyền nhìn
 * loại hồ sơ nào thì loại đó không xuất hiện (tránh hàng đợi đầy việc mà người
 * xem không mở được).
 */
export function getCommandCenterActionQueue(
  source: OperationalSnapshot,
  canRead: (permission: string) => boolean = () => true,
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
  const nowMs = Date.now();

  // Cứu trợ: quá hạn cam kết hoặc không đủ hàng để đáp ứng
  const reliefItems: CommandCenterActionItem[] = source.reliefRequests
    .filter(
      (request) =>
        !["Đã đóng", "Từ chối", "Hủy", "Đã xác nhận"].includes(request.status) &&
        (isReliefOverdue(request) ||
          hasRequestShortage(request, source.reservations)),
    )
    .map((request) => {
      const overdue = isReliefOverdue(request);
      return {
        id: request.id,
        type: "Yêu cầu cứu trợ",
        priority: overdue ? "Quá hạn" : "Thiếu hàng",
        tone: overdue ? ("red" as const) : ("amber" as const),
        title: `${request.code} · ${request.justification}`,
        area: request.destination,
        time: request.requiredBy,
        status: request.status,
        action: "Xử lý",
        path: `/relief/requests/${request.id}`,
        ref: {
          kind: "warehouse" as const,
          id: request.assignedWarehouseIds[0] ?? request.id,
        },
      };
    });

  // Chuyến hàng: gặp sự cố hoặc đã quá giờ dự kiến tới nơi mà chưa tới
  const shipmentItems: CommandCenterActionItem[] = source.shipments
    .filter((shipment) => {
      if (["Hoàn tất", "Đã giao"].includes(shipment.status)) return false;
      if (shipment.status === "Có sự cố") return true;
      const eta = Date.parse(shipment.estimatedArrival);
      return (
        !shipment.actualArrival && Number.isFinite(eta) && eta < nowMs
      );
    })
    .map((shipment) => ({
      id: shipment.id,
      type: "Chuyến hàng",
      priority: shipment.status === "Có sự cố" ? "Sự cố" : "Trễ hẹn",
      tone: shipment.status === "Có sự cố" ? ("red" as const) : ("amber" as const),
      title: `${shipment.code} → ${shipment.destination}`,
      area: shipment.destination,
      time: shipment.estimatedArrival,
      status: shipment.status,
      action: "Kiểm tra",
      path: `/relief/requests/${shipment.reliefRequestId}`,
      ref: { kind: "warehouse" as const, id: shipment.warehouseId },
    }));

  // Thiệt hại: hồ sơ đã gửi nhưng chưa thẩm định xong (nghĩa vụ theo TTLT 43/2015)
  const assessmentItems: CommandCenterActionItem[] = source.damageAssessments
    .filter((item) => ["Đã gửi", "Đang thẩm định"].includes(item.status))
    .map((item) => ({
      id: item.id,
      type: "Đánh giá thiệt hại",
      priority: item.status === "Đã gửi" ? "Chờ thẩm định" : "Đang thẩm định",
      tone: "blue" as const,
      title: `${item.code} · ${item.summary}`,
      area: item.area,
      time: item.assessedAt,
      status: item.status,
      action: "Thẩm định",
      path: `/recovery/assessments/${item.id}`,
      ref: { kind: "incident" as const, id: item.incidentId },
    }));

  const groups: Array<{ permission: string; items: CommandCenterActionItem[] }> = [
    { permission: "sos_view", items: sosItems },
    { permission: "team_view", items: teamItems },
    { permission: "task_view", items: taskItems },
    { permission: "view", items: incidentItems },
    { permission: "relief_view", items: reliefItems },
    { permission: "shipment_view", items: shipmentItems },
    { permission: "damage_assessment_view", items: assessmentItems },
  ];

  const tonePriority = { red: 0, amber: 1, blue: 2 } as const;
  // Trả về TOÀN BỘ hàng đợi đã xếp hạng; phần hiển thị tự quyết định cắt bao
  // nhiêu dòng và tóm tắt phần còn lại (trước đây hàm cắt cứng 5 dòng nên
  // những việc bị đẩy ra ngoài biến mất hoàn toàn khỏi giao diện).
  return groups
    .filter((group) => canRead(group.permission))
    .flatMap((group) => group.items)
    .sort((a, b) => tonePriority[a.tone] - tonePriority[b.tone]);
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
/**
 * NGUỒN LỰC VƯỢT NGƯỠNG — **không bao gồm SOS**.
 *
 * Đợt 7: bỏ nguồn SOS khỏi dải này. Lý do đo được: ba ô đầu của dải trước đây
 * lặp lại nguyên văn ba dòng đầu của hàng đợi xử lý ngay bên dưới (cùng mã,
 * cùng chữ trạng thái), tức là chỉ huy đọc hai lần một thông tin. SOS là
 * *việc phải làm* nên thuộc hàng đợi; dải này chỉ nói về *nguồn lực* — điểm
 * sơ tán, đội, kho, tuyến sơ tán — thứ hàng đợi không có.
 */
export function getCommandCenterResourceExceptions(
  source: OperationalSnapshot,
): CommandCenterExceptionItem[] {
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
