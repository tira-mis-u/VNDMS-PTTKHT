import type {
  EvacuationOperation,
  EvacuationPriority,
  EvacuationStatus,
  RouteStatus,
} from "../../domain/evacuations/types";
import type { Incident } from "../../domain/incidents/types";
import type { OperationalAlert } from "../../domain/alerts/types";
import type { RescueTeam } from "../../domain/teams/types";
import type { Shelter } from "../../domain/shelters/types";
import { calculateShelterCapacity } from "../../domain/shelters/rules";
import {
  getEvacuationTransitions,
  isEvacuationDelayed,
  routeRequiresAlternative,
} from "../../domain/evacuations/rules";
import { demoCurrentTime, parseVietnameseDate } from "../../domain/tasks/rules";
import type { Permission } from "../../lib/permissions/permissions";

/**
 * Truy vấn Evacuation Operations Workspace. Mọi query nhận đúng các bộ sưu tập
 * đã đi qua authorized canonical read model (giá trị từ OperationalProvider),
 * nên phạm vi nhìn thấy theo vai trò/địa bàn/ownership đã được áp dụng từ
 * trước — module này không thực thi lại phân quyền và không đọc canonical
 * state trực tiếp.
 */

export const evacuationStatusOptions: EvacuationStatus[] = [
  "Dự kiến",
  "Đã phê duyệt",
  "Đang triển khai",
  "Tạm dừng",
  "Hoàn thành",
  "Đã hủy",
];

export const evacuationPriorityOptions: EvacuationPriority[] = [
  "Khẩn cấp",
  "Cao",
  "Trung bình",
  "Thấp",
];

export const evacuationRouteOptions: RouteStatus[] = [
  "Thông suốt",
  "Hạn chế",
  "Bị chặn",
  "Đang dùng tuyến thay thế",
];

export const evacuationProgressOptions = [
  "Tất cả tiến độ",
  "Trễ hoặc bị chặn",
  "Chưa bắt đầu",
  "Đang diễn ra",
  "Hoàn tất",
];

export interface EvacuationFilters {
  search: string;
  status: string;
  priority: string;
  route: string;
  progress: string;
  sort: "Ưu tiên điều hành" | "Tiến độ tăng dần" | "Hoàn thành dự kiến";
}

/** Route canonical của trang chi tiết (History API router hiện hữu). */
export function evacuationDetailPath(
  operation: Pick<EvacuationOperation, "id">,
) {
  return `/evacuations/${encodeURIComponent(operation.id)}`;
}

export function isActiveEvacuation(operation: EvacuationOperation) {
  return !["Hoàn thành", "Đã hủy"].includes(operation.status);
}

function isOverdue(operation: EvacuationOperation, now: Date) {
  return (
    isActiveEvacuation(operation) &&
    parseVietnameseDate(operation.expectedCompletion).getTime() <
      now.getTime()
  );
}

export function matchesEvacuationFilters(
  operation: EvacuationOperation,
  filters: EvacuationFilters,
  now: Date = demoCurrentTime,
) {
  const q = filters.search.trim().toLowerCase();
  const delayed = isEvacuationDelayed(operation);
  return (
    (!q ||
      `${operation.id} ${operation.sourceArea} ${operation.route.name} ${operation.assignedTeamId ?? ""} ${operation.destinationShelterId} ${operation.incidentId}`
        .toLowerCase()
        .includes(q)) &&
    (filters.status === "Tất cả trạng thái" ||
      operation.status === filters.status) &&
    (filters.priority === "Tất cả ưu tiên" ||
      operation.priority === filters.priority) &&
    (filters.route === "Tất cả tuyến" ||
      operation.route.status === filters.route) &&
    (filters.progress === "Tất cả tiến độ" ||
      (filters.progress === "Trễ hoặc bị chặn"
        ? delayed || isOverdue(operation, now)
        : filters.progress === "Chưa bắt đầu"
          ? operation.progress === 0
          : filters.progress === "Đang diễn ra"
            ? operation.progress > 0 && operation.progress < 100
            : operation.progress === 100))
  );
}

function operationalRank(operation: EvacuationOperation, now: Date) {
  if (!isActiveEvacuation(operation)) return 50;
  let score = 0;
  if (isEvacuationDelayed(operation)) score += 30;
  if (isOverdue(operation, now)) score += 25;
  if (
    !operation.assignedTeamId &&
    !["Hoàn thành", "Đã hủy", "Dự kiến"].includes(operation.status)
  )
    score += 15;
  if (operation.priority === "Khẩn cấp") score += 12;
  else if (operation.priority === "Cao") score += 8;
  else if (operation.priority === "Trung bình") score += 4;
  if (operation.status === "Đang triển khai") score += 6;
  if (
    operation.route.status === "Hạn chế" ||
    operation.route.status === "Đang dùng tuyến thay thế"
  )
    score += 4;
  return -score;
}

export function sortEvacuations(
  operations: EvacuationOperation[],
  filters: Pick<EvacuationFilters, "sort">,
  now: Date = demoCurrentTime,
) {
  return [...operations].sort((left, right) => {
    if (filters.sort === "Tiến độ tăng dần")
      return (
        left.progress - right.progress ||
        operationalRank(left, now) - operationalRank(right, now)
      );
    if (filters.sort === "Hoàn thành dự kiến")
      return (
        parseVietnameseDate(left.expectedCompletion).getTime() -
        parseVietnameseDate(right.expectedCompletion).getTime()
      );
    return (
      operationalRank(left, now) - operationalRank(right, now) ||
      parseVietnameseDate(left.expectedCompletion).getTime() -
        parseVietnameseDate(right.expectedCompletion).getTime()
    );
  });
}

export function filterAndSortEvacuations(
  operations: EvacuationOperation[],
  filters: EvacuationFilters,
  now: Date = demoCurrentTime,
) {
  return sortEvacuations(
    operations.filter((operation) =>
      matchesEvacuationFilters(operation, filters, now),
    ),
    filters,
    now,
  );
}

export interface EvacuationSummary {
  total: number;
  active: number;
  delayed: number;
  noTeam: number;
  evacuated: number;
  estimated: number;
}

export function summarizeEvacuations(
  operations: EvacuationOperation[],
): EvacuationSummary {
  return {
    total: operations.length,
    active: operations.filter(isActiveEvacuation).length,
    delayed: operations.filter(
      (operation) =>
        isEvacuationDelayed(operation) && isActiveEvacuation(operation),
    ).length,
    noTeam: operations.filter(
      (operation) => !operation.assignedTeamId && isActiveEvacuation(operation),
    ).length,
    evacuated: operations.reduce(
      (sum, operation) => sum + operation.evacuatedPopulation,
      0,
    ),
    estimated: operations.reduce(
      (sum, operation) => sum + operation.estimatedPopulation,
      0,
    ),
  };
}

/** Khuyến nghị xử lý suy ra thuần từ canonical state — không phải bản ghi. */
export function evacuationRecommendations(
  operation: EvacuationOperation,
  now: Date = demoCurrentTime,
) {
  const recommendations: string[] = [];
  if (!isActiveEvacuation(operation)) return recommendations;
  if (isOverdue(operation, now))
    recommendations.push(
      `Đã quá thời điểm hoàn thành dự kiến (${operation.expectedCompletion}) — cần đánh giá lại kế hoạch và cam kết mốc mới với điều hành khu vực.`,
    );
  if (operation.route.status === "Bị chặn")
    recommendations.push(
      operation.route.alternativeCoordinates.length
        ? "Tuyến chính đang bị chặn — cân nhắc kích hoạt tuyến thay thế đã lập hoặc điều đội hỗ trợ thông tuyến."
        : "Tuyến chính đang bị chặn và chưa có tuyến thay thế — cần lập phương án tuyến mới trước khi triển khai lại.",
    );
  if (
    !operation.assignedTeamId &&
    ["Đã phê duyệt", "Đang triển khai", "Tạm dừng"].includes(operation.status)
  )
    recommendations.push(
      "Hoạt động cần đội phụ trách — phân công đội sẵn sàng trước khi triển khai hoặc khôi phục.",
    );
  if (
    operation.status === "Đang triển khai" &&
    operation.startTime &&
    operation.progress < 40 &&
    now.getTime() - parseVietnameseDate(operation.startTime).getTime() >
      60 * 60 * 1000
  )
    recommendations.push(
      `Tiến độ chậm (${operation.progress}% sau hơn 1 giờ triển khai) — rà soát năng lực đội, tuyến đường hoặc bổ sung phương tiện.`,
    );
  return recommendations;
}

/** Read model cho detail page: gộp operation với các thực thể liên kết đã authorized. */
export interface EvacuationView {
  operation: EvacuationOperation;
  incident?: Incident;
  shelter?: Shelter;
  team?: RescueTeam;
  remainingPopulation: number;
  delayed: boolean;
  overdue: boolean;
  availableTransitions: EvacuationStatus[];
  needsAlternativeRoute: boolean;
  shelterCapacity: ReturnType<typeof calculateShelterCapacity> | null;
  recommendations: string[];
}

export function toEvacuationView(
  operation: EvacuationOperation,
  context: {
    incidents: Incident[];
    shelters: Shelter[];
    teams: RescueTeam[];
  },
  now: Date = demoCurrentTime,
): EvacuationView {
  const shelter = context.shelters.find(
    (item) => item.id === operation.destinationShelterId,
  );
  return {
    operation,
    incident: context.incidents.find(
      (item) => item.id === operation.incidentId,
    ),
    shelter,
    team: context.teams.find((item) => item.id === operation.assignedTeamId),
    remainingPopulation: Math.max(
      0,
      operation.estimatedPopulation - operation.evacuatedPopulation,
    ),
    delayed: isEvacuationDelayed(operation),
    overdue: isOverdue(operation, now),
    availableTransitions: getEvacuationTransitions(operation.status),
    needsAlternativeRoute: routeRequiresAlternative(operation.route.status),
    shelterCapacity: shelter ? calculateShelterCapacity(shelter) : null,
    recommendations: evacuationRecommendations(operation, now),
  };
}

export function getEvacuationView(
  operations: EvacuationOperation[],
  operationId: string,
  context: {
    incidents: Incident[];
    shelters: Shelter[];
    teams: RescueTeam[];
  },
  now: Date = demoCurrentTime,
) {
  const operation = operations.find((item) => item.id === operationId);
  return operation ? toEvacuationView(operation, context, now) : undefined;
}

/**
 * Cross-link Alerts: lấy cảnh báo (Authorized Alert View) trỏ về hoạt động
 * sơ tán này. Chỉ đọc — trang chi tiết không thay đổi trạng thái cảnh báo.
 */
export function getLinkedEvacuationAlerts(
  alerts: OperationalAlert[],
  operation: Pick<EvacuationOperation, "id">,
) {
  return alerts.filter(
    (alert) =>
      alert.source.type === "Evacuation" && alert.source.id === operation.id,
  );
}

/** Quyền trên từng hành động để presentation disable/tooltip; boundary vẫn enforce. */
export function getEvacuationPermissions(
  operation: EvacuationOperation,
  can: (permission: Permission, resourceScope?: string) => boolean,
) {
  const scope = operation.sourceArea;
  const ended = ["Hoàn thành", "Đã hủy"].includes(operation.status);
  const check = (permission: Permission) => can(permission, scope);
  return {
    approve:
      !ended && operation.status === "Dự kiến" && check("evacuation_approve"),
    assign: !ended && check("evacuation_assign"),
    update: !ended && check("evacuation_update"),
    complete: !ended && check("evacuation_complete"),
    cancel: !ended && check("evacuation_cancel"),
  };
}
