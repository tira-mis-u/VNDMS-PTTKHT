import type { AlertSeverity } from "../../domain/alerts/types";
import type { PublishedAlert } from "../../domain/published-alerts/types";
import {
  assertPublishedAlertEditable,
  assertPublishedAlertTransition,
} from "../../domain/published-alerts/rules";

export interface PublishedAlertDraftInput {
  title: string;
  content: string;
  severity: AlertSeverity;
  areaName: string;
}

function validate(input: PublishedAlertDraftInput) {
  if (!input.title.trim()) throw new Error("Tiêu đề cảnh báo không được để trống.");
  if (!input.content.trim()) throw new Error("Nội dung cảnh báo không được để trống.");
  if (!input.areaName.trim()) throw new Error("Phải nêu khu vực áp dụng.");
}

export function createPublishedAlertDraft(
  id: string,
  input: PublishedAlertDraftInput,
  actor: string,
  timestamp: string,
): PublishedAlert {
  validate(input);
  return {
    id,
    code: id,
    title: input.title.trim(),
    content: input.content.trim(),
    severity: input.severity,
    areaName: input.areaName.trim(),
    status: "Nháp",
    revision: 0,
    createdBy: actor,
    createdAt: timestamp,
    publishedAt: null,
    withdrawnAt: null,
    updatedAt: timestamp,
  };
}

export function updatePublishedAlertEntity(
  alert: PublishedAlert,
  input: PublishedAlertDraftInput,
  timestamp: string,
): PublishedAlert {
  assertPublishedAlertEditable(alert);
  validate(input);
  return {
    ...alert,
    title: input.title.trim(),
    content: input.content.trim(),
    severity: input.severity,
    areaName: input.areaName.trim(),
    // Cập nhật sau công bố tạo bản tin mới cho người dân.
    revision: alert.status === "Đã công bố" ? alert.revision + 1 : alert.revision,
    updatedAt: timestamp,
  };
}

export function publishAlertEntity(
  alert: PublishedAlert,
  timestamp: string,
): PublishedAlert {
  assertPublishedAlertTransition(alert, "Đã công bố");
  return {
    ...alert,
    status: "Đã công bố",
    revision: 1,
    publishedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function withdrawAlertEntity(
  alert: PublishedAlert,
  reason: string,
  timestamp: string,
): PublishedAlert {
  assertPublishedAlertTransition(alert, "Đã thu hồi");
  if (!reason.trim()) throw new Error("Phải ghi lý do thu hồi cảnh báo.");
  return {
    ...alert,
    status: "Đã thu hồi",
    withdrawnAt: timestamp,
    updatedAt: timestamp,
  };
}
