import type { CitizenReport, CitizenReportStatus } from "./types";

export const citizenReportReviewDecisions: readonly Exclude<
  CitizenReportStatus,
  "Mới"
>[] = ["Hợp lệ", "Không hợp lệ", "Trùng"];

export function isCitizenReportOpen(report: CitizenReport) {
  return report.status === "Mới";
}

export function assertCitizenReportReviewable(report: CitizenReport) {
  if (report.status !== "Mới")
    throw new Error(`Phản ánh ${report.code} đã được đánh giá (${report.status}).`);
}
