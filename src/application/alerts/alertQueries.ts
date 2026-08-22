import type { AuthUser } from "../../domain/auth/types";
import type {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
  OperationalAlert,
} from "../../domain/alerts/types";
import type { OperationalSnapshot } from "../operations/operationalSnapshot";
import {
  alertSeverityLabels,
  alertCategoryLabels,
  alertSeverityRank,
} from "../../domain/alerts/types";
import {
  compareAlerts,
  deriveOperationalAlerts,
  resolveAlertsForUser,
} from "../../domain/alerts/rules";
import { hasPermission } from "../../lib/permissions/permissions";
import type { AuthorizationResource } from "../../lib/security/authorization";
import { parseVietnameseDate, demoCurrentTime } from "../../domain/tasks/rules";

/**
 * Authorized Alert View: cảnh báo chỉ được suy ra từ Authorized Operational
 * View (canonical read model đã qua lọc quyền) và yêu cầu thêm alert_view.
 * Một điều kiện không nhìn thấy được ở entity nguồn thì alert của nó cũng
 * không tồn tại đối với ngườii dùng đó — không có đường bypass nào.
 */
export function deriveAuthorizedAlerts(
  user: AuthUser | null,
  authorizedView: OperationalSnapshot,
): OperationalAlert[] {
  if (!user || !user.active || !hasPermission(user.role, "alert_view"))
    return [];
  const derived = deriveOperationalAlerts(authorizedView);
  return resolveAlertsForUser(derived, authorizedView.alertInteractions, user.id);
}

/** Resource phục vụ resource-aware authorization cho mutation alert. */
export function alertAuthorizationResource(
  alert: Pick<
    OperationalAlert,
    "key" | "geographicScope" | "ownerTeamId" | "ownerWarehouseId"
  >,
): AuthorizationResource {
  return {
    type: "OperationalAlert",
    id: alert.key,
    geographicScope: alert.geographicScope,
    assignedTeamId: alert.ownerTeamId ?? null,
    warehouseId: alert.ownerWarehouseId ?? null,
  };
}

export interface AlertFilters {
  search: string;
  severity: string;
  category: string;
  status: string;
  time: string;
}

export const alertTimeOptions = [
  "Tất cả thởi gian",
  "30 phút gần nhất",
  "1 giờ gần nhất",
  "3 giờ gần nhất",
  "24 giờ gần nhất",
];

const timeWindowMinutes: Record<string, number> = {
  "30 phút gần nhất": 30,
  "1 giờ gần nhất": 60,
  "3 giờ gần nhất": 180,
  "24 giờ gần nhất": 24 * 60,
};

function matchesTime(alert: OperationalAlert, option: string) {
  const windowMinutes = timeWindowMinutes[option];
  if (!windowMinutes) return true;
  const detected = parseVietnameseDate(alert.detectedAt).getTime();
  if (!Number.isFinite(detected)) return true;
  return demoCurrentTime.getTime() - detected <= windowMinutes * 60 * 1000;
}

export function filterAndSortAlerts(
  alerts: OperationalAlert[],
  filters: AlertFilters,
): OperationalAlert[] {
  const query = filters.search
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return alerts
    .filter((alert) => {
      if (
        filters.severity !== "Tất cả mức độ" &&
        alertSeverityLabels[alert.severity] !== filters.severity
      )
        return false;
      if (
        filters.category !== "Tất cả nhóm" &&
        alertCategoryLabels[alert.category] !== filters.category
      )
        return false;
      if (
        filters.status !== "Tất cả trạng thái" &&
        alert.status !== filters.status
      )
        return false;
      if (!matchesTime(alert, filters.time)) return false;
      if (!query) return true;
      const text = `${alert.title} ${alert.message} ${alert.source.code} ${alert.source.label} ${alert.key}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return text.includes(query);
    })
    .sort(compareAlerts);
}

export interface AlertSummary {
  total: number;
  unread: number;
  critical: number;
  pendingAcknowledgement: number;
  byCategory: Array<{ category: AlertCategory; label: string; count: number }>;
}

export function summarizeAlerts(alerts: OperationalAlert[]): AlertSummary {
  const byCategory = (
    Object.entries(alertCategoryLabels) as Array<[AlertCategory, string]>
  )
    .map(([category, label]) => ({
      category,
      label,
      count: alerts.filter((alert) => alert.category === category).length,
    }))
    .filter((entry) => entry.count > 0);
  return {
    total: alerts.length,
    unread: alerts.filter((alert) => alert.status === "Chưa đọc").length,
    critical: alerts.filter((alert) => alert.severity === "critical").length,
    pendingAcknowledgement: alerts.filter(
      (alert) => alert.requiresAcknowledgement && !alert.acknowledgedAt,
    ).length,
    byCategory,
  };
}

export interface AlertAnalytics {
  bySeverity: Array<{ severity: AlertSeverity; label: string; count: number }>;
  byCategory: Array<{ category: AlertCategory; label: string; count: number }>;
  unresolved: number;
  acknowledgementRate: number | null;
}

/** Aggregation thuần trên Authorized Alert View — Analytics không phải nguồn alert. */
export function getAlertAnalytics(alerts: OperationalAlert[]): AlertAnalytics {
  const bySeverity = (
    Object.entries(alertSeverityLabels) as Array<[AlertSeverity, string]>
  ).map(([severity, label]) => ({
    severity,
    label,
    count: alerts.filter((alert) => alert.severity === severity).length,
  }));
  const requiring = alerts.filter((alert) => alert.requiresAcknowledgement);
  const acknowledged = requiring.filter((alert) => alert.acknowledgedAt);
  return {
    bySeverity: bySeverity.sort(
      (a, b) => alertSeverityRank[b.severity] - alertSeverityRank[a.severity],
    ),
    byCategory: summarizeAlerts(alerts).byCategory,
    unresolved: alerts.filter(
      (alert) =>
        !alert.acknowledgedAt &&
        (alert.requiresAcknowledgement || alert.status !== "Đã đọc"),
    ).length,
    acknowledgementRate: requiring.length
      ? Math.round((acknowledged.length / requiring.length) * 100)
      : null,
  };
}


/** Route canonical của alert detail (History API router hiện hữu). */
export function alertDetailPath(alert: Pick<OperationalAlert, "key">) {
  return `/alerts/${encodeURIComponent(alert.key)}`;
}

export const alertStatusOptions: AlertStatus[] = [
  "Chưa đọc",
  "Đã đọc",
  "Đã xác nhận",
];
