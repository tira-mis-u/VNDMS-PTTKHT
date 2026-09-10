import type {
  CitizenReport,
  CitizenReportCategory,
  CitizenReportLocation,
  CitizenReportStatus,
} from "../../domain/reports/types";
import { assertCitizenReportReviewable } from "../../domain/reports/rules";

export interface NewCitizenReportInput {
  reporterName: string;
  contact: string;
  category: CitizenReportCategory;
  description: string;
  location: CitizenReportLocation;
}

export function createCitizenReportEntity(
  id: string,
  input: NewCitizenReportInput,
  ownerUserId: string,
  timestamp: string,
): CitizenReport {
  if (!input.description.trim())
    throw new Error("Nội dung phản ánh không được để trống.");
  if (!input.location.address.trim())
    throw new Error("Phải mô tả vị trí xảy ra sự việc.");
  return {
    id,
    code: id,
    ownerUserId,
    reporterName: input.reporterName,
    contact: input.contact,
    category: input.category,
    description: input.description.trim(),
    location: {
      address: input.location.address.trim(),
      administrativeArea: input.location.administrativeArea,
      coordinates: input.location.coordinates,
    },
    status: "Mới",
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    duplicateOfId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function reviewCitizenReportEntity(
  report: CitizenReport,
  decision: Exclude<CitizenReportStatus, "Mới">,
  note: string,
  reviewer: string,
  timestamp: string,
  duplicateOfId: string | null = null,
): CitizenReport {
  assertCitizenReportReviewable(report);
  if (decision !== "Hợp lệ" && !note.trim())
    throw new Error("Phải ghi lý do khi đánh dấu Không hợp lệ hoặc Trùng.");
  if (decision === "Trùng" && !duplicateOfId)
    throw new Error("Phải chỉ rõ phản ánh/SOS gốc khi đánh dấu Trùng.");
  return {
    ...report,
    status: decision,
    reviewNote: note.trim() || null,
    reviewedBy: reviewer,
    reviewedAt: timestamp,
    duplicateOfId: decision === "Trùng" ? duplicateOfId : null,
    updatedAt: timestamp,
  };
}
