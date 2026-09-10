import type { Incident, IncidentEvent } from "@/domain/incidents/types";
import type { IncidentTask, TaskUpdate } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { SosRequest } from "@/domain/sos/types";
import type { TaskReview } from "@/domain/tasks/types";
import type { CitizenReport } from "@/domain/reports/types";
import type {
  AnalyticsPeriod,
  CitizenReportAnalytics,
  DistributionRow,
  IncidentAnalytics,
  IncidentTiming,
  OperationalException,
  OperationalReport,
  OperationalReportType,
  OperationalSummary,
  ShelterAnalytics,
  SosAnalytics,
  TaskAnalytics,
  TeamAnalytics,
} from "@/domain/analytics/types";

export interface AnalyticsData {
  metadata: { asOf: string; source: string };
  incidents: Incident[];
  events: IncidentEvent[];
  tasks: IncidentTask[];
  taskUpdates: TaskUpdate[];
  teams: RescueTeam[];
  shelters: Shelter[];
  sosRequests: SosRequest[];
  taskReviews: TaskReview[];
  citizenReports: CitizenReport[];
}
export interface ReportActor {
  id: string;
  displayName: string;
}
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function parseOperationalDate(
  value: string,
  anchor?: string,
  endOfDay = false,
) {
  const text = value.trim();
  let match = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (match) {
    const [, d, m, y, hh, mm, ss] = match;
    return new Date(
      +y,
      +m - 1,
      +d,
      hh ? +hh : endOfDay ? 23 : 0,
      mm ? +mm : endOfDay ? 59 : 0,
      ss ? +ss : endOfDay ? 59 : 0,
    ).getTime();
  }
  match = text.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match && anchor) {
    const day = anchor.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (day) return parseOperationalDate(`${day[1]} ${text}`);
  }
  return Number.NaN;
}
const reference = (data: AnalyticsData, filter: AnalyticsPeriod = {}) =>
  parseOperationalDate(filter.referenceTime ?? data.metadata.asOf);
const minutes = (from: number, to: number) =>
  Number.isFinite(from) && Number.isFinite(to) && to >= from
    ? Math.round((to - from) / 60000)
    : null;
const average = (values: Array<number | null>) => {
  const valid = values.filter(
    (item): item is number => item !== null && Number.isFinite(item),
  );
  return valid.length
    ? Math.round(valid.reduce((sum, item) => sum + item, 0) / valid.length)
    : null;
};
const distribution = (values: string[]): DistributionRow[] => {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts]
    .map(([label, value]) => ({
      label,
      value,
      percentage: values.length ? Math.round((value / values.length) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "vi"));
};
const inPeriod = (date: string, filter: AnalyticsPeriod = {}) => {
  const value = parseOperationalDate(date);
  // Dấu thời gian không hợp lệ không được âm thầm đưa vào kỳ báo cáo.
  if (!Number.isFinite(value)) return false;
  const from = filter.from
    ? parseOperationalDate(filter.from)
    : Number.NEGATIVE_INFINITY;
  const to = filter.to
    ? parseOperationalDate(filter.to, undefined, true)
    : Number.POSITIVE_INFINITY;
  return value >= from && value <= to;
};
const inScope = (value: string, scope?: string) =>
  !scope ||
  scope === "Toàn bộ Hà Nội" ||
  normalize(value).includes(normalize(scope.replace(", Hà Nội", "")));
function filteredIncidents(data: AnalyticsData, filter: AnalyticsPeriod = {}) {
  return data.incidents.filter(
    (item) =>
      (!filter.incidentId || item.id === filter.incidentId) &&
      inScope(
        `${item.location.name} ${item.affectedArea}`,
        filter.geographicScope,
      ) &&
      inPeriod(item.createdAt, filter),
  );
}
const incidentIds = (data: AnalyticsData, filter: AnalyticsPeriod = {}) =>
  new Set(filteredIncidents(data, filter).map((item) => item.id));
const isOpenTask = (task: IncidentTask) =>
  !["Hoàn thành", "Đã hủy"].includes(task.status);
const isOpenIncident = (incident: Incident) =>
  !["Đã đóng", "Đã kiểm soát"].includes(incident.status);
/**
 * SOS chỉ được coi là kết thúc khi cán bộ đã đóng/từ chối/hủy. Trạng thái
 * "Đã xử lý" là đơn vị báo xong nhưng CHƯA được duyệt đóng ⇒ vẫn tính mở.
 */
const isOpenSos = (status: string) =>
  !["Đã đóng", "Từ chối", "Hủy"].includes(status);
const isClosedSos = (status: string) => status === "Đã đóng";
const eventEpoch = (event: IncidentEvent, incident: Incident) =>
  parseOperationalDate(event.timestamp, incident.createdAt);
function incidentEventTime(
  events: IncidentEvent[],
  incident: Incident,
  types: string[],
) {
  const values = events
    .filter(
      (event) => event.incidentId === incident.id && types.includes(event.type),
    )
    .map((event) => eventEpoch(event, incident))
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : Number.NaN;
}
function getIncidentTimings(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): IncidentTiming[] {
  const now = reference(data, filter);
  return filteredIncidents(data, filter)
    .map((incident) => {
      const created = parseOperationalDate(incident.createdAt);
      const acknowledged = incidentEventTime(data.events, incident, [
        "severity",
        "acknowledged",
        "assessment",
      ]);
      const dispatched = incidentEventTime(data.events, incident, [
        "assignment",
        "dispatch",
      ]);
      const resolved = incident.closedAt
        ? parseOperationalDate(incident.closedAt)
        : incident.status === "Đã kiểm soát"
          ? parseOperationalDate(incident.updatedAt)
          : Number.NaN;
      return {
        id: incident.id,
        code: incident.code,
        title: incident.title,
        area: incident.location.name,
        responseMinutes: minutes(
          created,
          Number.isFinite(resolved) ? resolved : now,
        ),
        acknowledgementMinutes: minutes(created, acknowledged),
        dispatchMinutes: minutes(
          Number.isFinite(acknowledged) ? acknowledged : created,
          dispatched,
        ),
        resolutionMinutes: minutes(
          Number.isFinite(dispatched) ? dispatched : created,
          resolved,
        ),
        basis: "Dẫn xuất" as const,
        overdue: isOpenIncident(incident) && (minutes(created, now) ?? 0) > 120,
      };
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (b.responseMinutes ?? 0) - (a.responseMinutes ?? 0),
    );
}

export function getIncidentAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): IncidentAnalytics {
  const incidents = filteredIncidents(data, filter);
  const ids = new Set(incidents.map((item) => item.id));
  const linkedSos = data.sosRequests.filter(
    (item) => item.linkedIncidentId && ids.has(item.linkedIncidentId),
  );
  const timings = getIncidentTimings(data, filter);
  const affectedPopulation = incidents.reduce(
    (sum, item) => sum + item.affectedPopulation,
    0,
  );
  const rescuedPopulation = linkedSos
    .filter((item) => isClosedSos(item.status))
    .reduce((sum, item) => sum + item.peopleAtRisk, 0);
  const pendingPopulation = linkedSos
    .filter((item) => isOpenSos(item.status))
    .reduce((sum, item) => sum + item.peopleAtRisk, 0);
  return {
    bySeverity: distribution(incidents.map((item) => item.severity)),
    byStatus: distribution(incidents.map((item) => item.status)),
    byArea: distribution(
      incidents.map(
        (item) =>
          item.location.name.split(",").slice(-3, -1).join(",").trim() ||
          item.location.name,
      ),
    ),
    timings,
    averageAcknowledgementMinutes: average(
      timings.map((item) => item.acknowledgementMinutes),
    ),
    averageDispatchMinutes: average(
      timings.map((item) => item.dispatchMinutes),
    ),
    averageResolutionMinutes: average(
      timings.map((item) => item.resolutionMinutes),
    ),
    overdueCount: timings.filter((item) => item.overdue).length,
    affectedPopulation,
    rescuedPopulation,
    pendingPopulation,
  };
}

export function getTaskAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): TaskAnalytics {
  const ids = incidentIds(data, filter);
  const now = reference(data, filter);
  const tasks = data.tasks.filter(
    (item) => ids.has(item.incidentId) && inPeriod(item.createdAt, filter),
  );
  const completed = tasks.filter((item) => item.status === "Hoàn thành");
  const overdue = tasks.filter(
    (item) => isOpenTask(item) && parseOperationalDate(item.dueAt) < now,
  );
  const incidentMap = new Map(data.incidents.map((item) => [item.id, item]));
  const byIncident = [...new Set(tasks.map((item) => item.incidentId))]
    .map((id) => {
      const rows = tasks.filter((item) => item.incidentId === id);
      const incident = incidentMap.get(id);
      return {
        incidentId: id,
        code: incident?.code ?? id,
        title: incident?.title ?? "Không xác định",
        total: rows.length,
        open: rows.filter(isOpenTask).length,
        overdue: rows.filter((item) => overdue.includes(item)).length,
      };
    })
    .sort((a, b) => b.open - a.open);
  const completionTimes = completed.map((item) =>
    minutes(
      parseOperationalDate(item.createdAt),
      parseOperationalDate(item.completedAt ?? ""),
    ),
  );
  const startDelays = tasks.map((task) => {
    const update = data.taskUpdates
      .filter((item) => item.taskId === task.id)
      .sort(
        (a, b) =>
          parseOperationalDate(a.timestamp, task.createdAt) -
          parseOperationalDate(b.timestamp, task.createdAt),
      )[0];
    return update
      ? minutes(
          parseOperationalDate(task.createdAt),
          parseOperationalDate(update.timestamp, task.createdAt),
        )
      : null;
  });
  return {
    byStatus: distribution(tasks.map((item) => item.status)),
    byPriority: distribution(tasks.map((item) => item.priority)),
    overdueCount: overdue.length,
    completionRate: tasks.length
      ? Math.round((completed.length / tasks.length) * 100)
      : 0,
    averageCompletionMinutes: average(completionTimes),
    unassignedCount: tasks.filter((item) => isOpenTask(item) && !item.teamId)
      .length,
    progressBands: distribution(
      tasks.map((item) =>
        item.progress === 100
          ? "100%"
          : item.progress >= 75
            ? "75–99%"
            : item.progress >= 50
              ? "50–74%"
              : item.progress > 0
                ? "1–49%"
                : "0%",
      ),
    ),
    byIncident,
    dispatchToStartMinutes: average(startDelays),
    awaitingReviewCount: tasks.filter((item) => item.status === "Chờ xác nhận")
      .length,
    rejectedReviewCount: data.taskReviews.filter(
      (review) =>
        review.decision === "Từ chối" &&
        tasks.some((task) => task.id === review.taskId),
    ).length,
    reassignmentCount: tasks.reduce(
      (sum, task) => sum + Math.max(0, (task.assignmentHistory?.length ?? 0) - 1),
      0,
    ),
  };
}

export function getTeamAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): TeamAnalytics {
  const ids = incidentIds(data, filter);
  const tasks = data.tasks.filter(
    (item) => ids.has(item.incidentId) && isOpenTask(item),
  );
  const deployed = data.teams.filter((team) =>
    Boolean(team.currentTask || team.currentIncident),
  );
  const available = data.teams.filter(
    (team) =>
      team.availability === "Có thể điều phối" || team.status === "Sẵn sàng",
  );
  const unavailable = data.teams.filter(
    (team) =>
      ["Không sẵn sàng"].includes(team.availability) ||
      ["Mất liên lạc", "Không khả dụng"].includes(team.status),
  );
  const capabilities = [
    ...new Set(data.teams.flatMap((team) => team.capabilities)),
  ]
    .map((capability) => ({
      capability,
      available: data.teams.filter(
        (team) =>
          team.capabilities.includes(capability) &&
          (team.availability === "Có thể điều phối" ||
            team.status === "Sẵn sàng"),
      ).length,
      deployed: data.teams.filter(
        (team) =>
          team.capabilities.includes(capability) && deployed.includes(team),
      ).length,
      demand: tasks.filter((task) =>
        normalize(`${task.type} ${task.description}`).includes(
          normalize(capability.split(" ")[0]),
        ),
      ).length,
    }))
    .filter((item) => item.available + item.deployed + item.demand > 0)
    .sort(
      (a, b) =>
        b.demand - a.demand || a.capability.localeCompare(b.capability, "vi"),
    );
  return {
    total: data.teams.length,
    available: available.length,
    deployed: deployed.length,
    unavailable: unavailable.length,
    utilizationRate: data.teams.length
      ? Math.round((deployed.length / data.teams.length) * 100)
      : 0,
    workload: data.teams
      .map((team) => ({
        teamId: team.id,
        code: team.code,
        name: team.name,
        activeTasks: tasks.filter((task) => task.teamId === team.id).length,
        incidentId: team.currentIncident,
        assignment: team.currentTask ?? "Chưa phân công",
      }))
      .sort((a, b) => b.activeTasks - a.activeTasks),
    capability: capabilities,
  };
}

export function getShelterAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): ShelterAnalytics {
  const shelters = data.shelters.filter(
    (item) =>
      inScope(item.administrativeArea, filter.geographicScope) &&
      (!filter.incidentId ||
        item.linkedIncidentIds.includes(filter.incidentId)),
  );
  const occupancy = shelters.reduce(
    (sum, item) => sum + item.currentOccupancy,
    0,
  );
  const capacity = shelters.reduce((sum, item) => sum + item.capacity, 0);
  return {
    total: shelters.length,
    occupancy,
    capacity,
    utilizationRate: capacity ? Math.round((occupancy / capacity) * 100) : 0,
    overloaded: shelters.filter(
      (item) =>
        item.currentOccupancy > item.capacity || item.status === "Quá tải",
    ).length,
    rows: shelters
      .map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        area: item.administrativeArea,
        occupancy: item.currentOccupancy,
        capacity: item.capacity,
        reserved: item.reservedCapacity,
        utilization: item.capacity
          ? Math.round((item.currentOccupancy / item.capacity) * 100)
          : 0,
        status: item.status,
      }))
      .sort((a, b) => b.utilization - a.utilization),
  };
}

export function getSosAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): SosAnalytics {
  const now = reference(data, filter);
  const ids = incidentIds(data, filter);
  const rows = data.sosRequests.filter(
    (item) =>
      (!filter.incidentId || item.linkedIncidentId === filter.incidentId) &&
      inScope(item.location.administrativeArea, filter.geographicScope) &&
      inPeriod(item.receivedAt, filter),
  );
  const waiting = rows.map(
    (item) =>
      minutes(
        parseOperationalDate(item.receivedAt),
        parseOperationalDate(item.closedAt ?? item.lastUpdatedAt),
      ) ?? 0,
  );
  const resolved = rows
    .filter((item) => item.closedAt)
    .map((item) =>
      minutes(
        parseOperationalDate(item.receivedAt),
        parseOperationalDate(item.closedAt ?? ""),
      ),
    );
  const taskMap = new Map(data.tasks.map((item) => [item.id, item]));
  return {
    byPriority: distribution(rows.map((item) => item.priority)),
    byStatus: distribution(rows.map((item) => item.status)),
    byVerification: distribution(rows.map((item) => item.verificationStatus)),
    byArea: distribution(rows.map((item) => item.location.administrativeArea)),
    averageWaitingMinutes: average(waiting),
    averageResolutionMinutes: average(resolved),
    unassigned: rows.filter(
      (item) => isOpenSos(item.status) && !item.assignedTeamId,
    ).length,
    vulnerableCases: rows.filter(
      (item) => item.childrenCount + item.elderlyCount + item.disabledCount > 0,
    ).length,
    incidentConversionRate: rows.length
      ? Math.round(
          (rows.filter(
            (item) => item.linkedIncidentId && ids.has(item.linkedIncidentId),
          ).length /
            rows.length) *
            100,
        )
      : 0,
    rescueChainCompleted: rows.filter(
      (item) =>
        item.linkedIncidentId &&
        item.linkedTaskId &&
        taskMap.get(item.linkedTaskId)?.status === "Hoàn thành",
    ).length,
    rows: rows
      .map((item, index) => {
        let bottleneck: string | null = null;
        if (isOpenSos(item.status) && !item.assignedTeamId)
          bottleneck = "Chưa phân công đội";
        else if (
          item.verificationStatus !== "Đã xác minh" &&
          (minutes(parseOperationalDate(item.receivedAt), now) ?? 0) > 30
        )
          bottleneck = "Chờ xác minh quá 30 phút";
        else if (
          item.linkedTaskId &&
          taskMap.get(item.linkedTaskId)?.status === "Chờ giao"
        )
          bottleneck = "Nhiệm vụ chưa được giao";
        return {
          id: item.id,
          code: item.code,
          priority: item.priority,
          status: item.status,
          area: item.location.administrativeArea,
          waitingMinutes: waiting[index],
          linkedIncidentId: item.linkedIncidentId,
          linkedTaskId: item.linkedTaskId,
          assignedTeamId: item.assignedTeamId,
          bottleneck,
        };
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.bottleneck)) - Number(Boolean(a.bottleneck)) ||
          b.waitingMinutes - a.waitingMinutes,
      ),
  };
}

export function getCitizenReportAnalytics(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): CitizenReportAnalytics {
  const now = reference(data, filter);
  const rows = data.citizenReports.filter(
    (item) =>
      inScope(item.location.administrativeArea, filter.geographicScope) &&
      inPeriod(item.createdAt, filter),
  );
  const reviewTimes = rows
    .filter((item) => item.reviewedAt)
    .map((item) =>
      minutes(
        parseOperationalDate(item.createdAt),
        parseOperationalDate(item.reviewedAt ?? ""),
      ),
    );
  return {
    total: rows.length,
    pending: rows.filter((item) => item.status === "Mới").length,
    valid: rows.filter((item) => item.status === "Hợp lệ").length,
    invalid: rows.filter((item) => item.status === "Không hợp lệ").length,
    duplicate: rows.filter((item) => item.status === "Trùng").length,
    byCategory: distribution(rows.map((item) => item.category)),
    byStatus: distribution(rows.map((item) => item.status)),
    averageReviewMinutes: average(reviewTimes),
    rows: rows
      .map((item) => ({
        id: item.id,
        code: item.code,
        category: item.category,
        status: item.status,
        area: item.location.administrativeArea,
        createdAt: item.createdAt,
        waitingMinutes:
          item.status === "Mới"
            ? minutes(parseOperationalDate(item.createdAt), now)
            : null,
      }))
      .sort(
        (a, b) =>
          Number(b.status === "Mới") - Number(a.status === "Mới") ||
          (b.waitingMinutes ?? 0) - (a.waitingMinutes ?? 0),
      ),
  };
}

export function getOperationalExceptions(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): OperationalException[] {
  const incidents = getIncidentAnalytics(data, filter);
  const tasks = getTaskAnalytics(data, filter);
  const shelters = getShelterAnalytics(data, filter);
  const sos = getSosAnalytics(data, filter);
  const reports = getCitizenReportAnalytics(data, filter);
  const result: OperationalException[] = [];
  incidents.timings
    .filter((item) => item.overdue)
    .forEach((item) =>
      result.push({
        severity: "Cao",
        module: "Sự cố",
        entityId: item.id,
        entityCode: item.code,
        title: item.title,
        reason: `Đang xử lý ${item.responseMinutes} phút, vượt ngưỡng 120 phút`,
        path: `/incidents/${item.id}`,
      }),
    );
  data.tasks
    .filter(
      (task) =>
        tasks.byIncident.some((row) => row.incidentId === task.incidentId) &&
        isOpenTask(task) &&
        parseOperationalDate(task.dueAt) < reference(data, filter),
    )
    .forEach((item) =>
      result.push({
        severity: item.priority === "Khẩn cấp" ? "Khẩn cấp" : "Cao",
        module: "Nhiệm vụ",
        entityId: item.id,
        entityCode: item.id,
        title: item.title,
        reason: `Quá hạn lúc ${item.dueAt}`,
        path: `/tasks/${item.id}`,
      }),
    );
  shelters.rows
    .filter((item) => item.utilization > 100)
    .forEach((item) =>
      result.push({
        severity: "Khẩn cấp",
        module: "Điểm sơ tán",
        entityId: item.id,
        entityCode: item.code,
        title: item.name,
        reason: `Vượt sức chứa ${item.occupancy - item.capacity} người`,
        path: `/shelters/${item.id}`,
      }),
    );
  sos.rows
    .filter((item) => item.bottleneck)
    .forEach((item) =>
      result.push({
        severity: item.priority.startsWith("P1") ? "Khẩn cấp" : "Cao",
        module: "SOS",
        entityId: item.id,
        entityCode: item.code,
        title: item.area,
        reason: item.bottleneck ?? "",
        path: `/sos/${item.id}`,
      }),
    );
  reports.rows
    .filter((item) => (item.waitingMinutes ?? 0) > 120)
    .forEach((item) =>
      result.push({
        severity: "Trung bình",
        module: "Phản ánh",
        entityId: item.id,
        entityCode: item.code,
        title: `${item.category} · ${item.area}`,
        reason: `Chờ đánh giá ${item.waitingMinutes} phút`,
        path: "/reports",
      }),
    );
  return result
    .sort(
      (a, b) =>
        ["Khẩn cấp", "Cao", "Trung bình"].indexOf(a.severity) -
        ["Khẩn cấp", "Cao", "Trung bình"].indexOf(b.severity),
    )
    .slice(0, 20);
}

export function getOperationalSummary(
  data: AnalyticsData,
  filter: AnalyticsPeriod = {},
): OperationalSummary {
  const ids = incidentIds(data, filter);
  const now = reference(data, filter);
  const tasks = data.tasks.filter((item) => ids.has(item.incidentId));
  const sos = data.sosRequests.filter(
    (item) =>
      (!item.linkedIncidentId || ids.has(item.linkedIncidentId)) &&
      inScope(item.location.administrativeArea, filter.geographicScope),
  );
  const shelters = getShelterAnalytics(data, filter);
  const reports = getCitizenReportAnalytics(data, filter);
  return {
    metrics: [
      {
        label: "Sự cố đang hoạt động",
        value: filteredIncidents(data, filter).filter(isOpenIncident).length,
        basis: "Ghi nhận",
        description: "Chưa kiểm soát hoặc đóng",
      },
      {
        label: "Sự cố khẩn cấp",
        value: filteredIncidents(data, filter).filter(
          (item) => item.severity === "Khẩn cấp" && isOpenIncident(item),
        ).length,
        basis: "Ghi nhận",
        description: "Mức Khẩn cấp đang mở",
      },
      {
        label: "Nhiệm vụ mở / quá hạn",
        value: tasks.filter(isOpenTask).length,
        basis: "Dẫn xuất",
        description: `${tasks.filter((item) => isOpenTask(item) && parseOperationalDate(item.dueAt) < now).length} quá hạn`,
      },
      {
        label: "SOS đang hoạt động",
        value: sos.filter((item) => isOpenSos(item.status)).length,
        basis: "Ghi nhận",
        description: `${sos.filter((item) => isOpenSos(item.status) && !item.assignedTeamId).length} chưa phân công`,
      },
      {
        label: "Đội sẵn sàng / triển khai",
        value: getTeamAnalytics(data, filter).available,
        basis: "Dẫn xuất",
        description: `${getTeamAnalytics(data, filter).deployed} đội đang triển khai`,
      },
      {
        label: "Sức chứa điểm sơ tán",
        value: shelters.utilizationRate,
        basis: "Dẫn xuất",
        description: `${shelters.overloaded} điểm quá tải`,
      },
      {
        label: "Nhiệm vụ chờ xác nhận",
        value: tasks.filter((item) => item.status === "Chờ xác nhận").length,
        basis: "Ghi nhận",
        description: "Đơn vị đã báo xong, chờ cán bộ xác nhận",
      },
      {
        label: "SOS chờ duyệt đóng",
        value: sos.filter((item) => item.status === "Đã xử lý").length,
        basis: "Ghi nhận",
        description: "Đã xử lý nhưng chưa được cán bộ đóng",
      },
      {
        label: "Phản ánh chờ đánh giá",
        value: reports.pending,
        basis: "Ghi nhận",
        description: `${reports.valid} hợp lệ · ${reports.duplicate} trùng`,
      },
    ],
    exceptions: getOperationalExceptions(data, filter),
  };
}

export function collectInvalidReportTimestamps(data: AnalyticsData) {
  const candidates: Array<{ entityId: string; field: string; value: string }> = [
    ...data.incidents.map((item) => ({ entityId: item.id, field: "Thời điểm tạo sự cố", value: item.createdAt })),
    ...data.tasks.map((item) => ({ entityId: item.id, field: "Thời điểm tạo nhiệm vụ", value: item.createdAt })),
    ...data.sosRequests.map((item) => ({ entityId: item.id, field: "Thời điểm tiếp nhận SOS", value: item.receivedAt })),
    ...data.citizenReports.map((item) => ({ entityId: item.id, field: "Thời điểm tạo phản ánh", value: item.createdAt })),
    ...data.events.map((item) => ({ entityId: item.incidentId, field: "Dấu thời gian diễn biến sự cố", value: item.timestamp })),
  ];
  return candidates.filter((item) => {
    const anchor = item.field === "Dấu thời gian diễn biến sự cố"
      ? data.incidents.find((incident) => incident.id === item.entityId)?.createdAt
      : undefined;
    return !Number.isFinite(parseOperationalDate(item.value, anchor));
  });
}

export function buildOperationalReport(
  data: AnalyticsData,
  type: OperationalReportType,
  filter: AnalyticsPeriod,
  actor: ReportActor,
): OperationalReport {
  const incidents = filteredIncidents(data, filter);
  const incident = getIncidentAnalytics(data, filter);
  const task = getTaskAnalytics(data, filter);
  const team = getTeamAnalytics(data, filter);
  const shelter = getShelterAnalytics(data, filter);
  const sos = getSosAnalytics(data, filter);
  const reports = getCitizenReportAnalytics(data, filter);
  const exceptions = getOperationalExceptions(data, filter);
  const completedTasks = data.tasks.filter(
    (item) =>
      item.status === "Hoàn thành" &&
      incidentIds(data, filter).has(item.incidentId),
  );
  const outstandingTasks = data.tasks.filter(
    (item) =>
      isOpenTask(item) && incidentIds(data, filter).has(item.incidentId),
  );
  const awaitingReview = outstandingTasks.filter(
    (item) => item.status === "Chờ xác nhận",
  );
  const sosAwaitingClose = data.sosRequests.filter(
    (item) =>
      item.status === "Đã xử lý" &&
      inScope(item.location.administrativeArea, filter.geographicScope),
  );
  const asOf = filter.referenceTime ?? data.metadata.asOf;
  const period =
    filter.from || filter.to
      ? `${filter.from ?? "đầu kỳ"} – ${filter.to ?? asOf}`
      : `Đến ${asOf}`;
  const invalidTimestamps = collectInvalidReportTimestamps(data);
  return {
    type,
    title: `${type} — VNDMS`,
    period,
    scope: filter.geographicScope ?? "Toàn bộ Hà Nội",
    incidentScope: filter.incidentId ?? "Tất cả sự cố trong phạm vi",
    situationSummary: `${incidents.length} sự cố trong phạm vi báo cáo, ${incident.affectedPopulation.toLocaleString("vi-VN")} người bị ảnh hưởng. ${task.overdueCount} nhiệm vụ quá hạn và ${exceptions.length} ngoại lệ cần theo dõi.`,
    findings: [
      `${incident.overdueCount} sự cố vượt ngưỡng xử lý 120 phút.`,
      `${sos.unassigned} SOS đang mở chưa được phân công.`,
      `${shelter.overloaded} điểm sơ tán vượt sức chứa.`,
      `${awaitingReview.length} nhiệm vụ đã báo xong chờ cán bộ xác nhận.`,
      `${reports.pending} phản ánh của người dân chưa được đánh giá.`,
    ],
    responseStatistics: [
      {
        label: "Sự cố trong phạm vi",
        value: String(incidents.length),
        basis: "Ghi nhận",
      },
      {
        label: "Thời gian xác nhận trung bình",
        value:
          incident.averageAcknowledgementMinutes === null
            ? "Chưa đủ dữ liệu"
            : `${incident.averageAcknowledgementMinutes} phút`,
        basis: "Dẫn xuất",
      },
      {
        label: "Tỷ lệ hoàn thành nhiệm vụ",
        value: `${task.completionRate}%`,
        basis: "Dẫn xuất",
      },
      {
        label: "SOS đã đóng / tổng",
        value: `${sos.rows.filter((item) => item.status === "Đã đóng").length}/${sos.rows.length}`,
        basis: "Ghi nhận",
      },
      {
        label: "Thời gian xử lý SOS trung bình",
        value:
          sos.averageResolutionMinutes === null
            ? "Chưa đủ dữ liệu"
            : `${sos.averageResolutionMinutes} phút`,
        basis: "Dẫn xuất",
      },
    ],
    resourceUtilization: [
      `${team.deployed}/${team.total} đội đang triển khai (${team.utilizationRate}%).`,
      `${shelter.occupancy.toLocaleString("vi-VN")}/${shelter.capacity.toLocaleString("vi-VN")} chỗ đang sử dụng.`,
    ],
    majorExceptions: exceptions,
    completedActions: completedTasks
      .map((item) => `${item.id} — ${item.title}`)
      .slice(0, 12),
    outstandingActions: outstandingTasks
      .map((item) => `${item.id} — ${item.title} (${item.status})`)
      .slice(0, 12),
    pendingConfirmation: [
      ...awaitingReview.map(
        (item) => `${item.id} — ${item.title} (đơn vị đã báo xong, chờ xác nhận)`,
      ),
      ...sosAwaitingClose.map(
        (item) => `${item.code} — SOS đã xử lý, chờ cán bộ duyệt đóng`,
      ),
    ].slice(0, 12),
    audit: {
      generatedAt: asOf,
      generatedById: actor.id,
      generatedBy: actor.displayName,
      source: `${data.metadata.source}; lát cắt dữ liệu vận hành đã phân quyền`,
      dataPolicy:
        "Giá trị ghi nhận được tách biệt với chỉ số tính toán; bản ghi có dấu thời gian không hợp lệ bị loại và được công khai trong báo cáo.",
      invalidTimestamps,
    },
  };
}
