import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  CheckCheck,
  Clock3,
  MapPin,
  MessageSquareWarning,
  Search,
  X,
} from "lucide-react";
import type { CitizenReport } from "@/domain/reports/types";
import { citizenReportCategories } from "@/domain/reports/types";
import { isCitizenReportOpen } from "@/domain/reports/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, EmptyState, PageSectionHeader, Input } from "@/components/ui";
import { CitizenReportReviewDialog } from "../components/CitizenReportReviewDialog";

const statusTone = (status: CitizenReport["status"]) =>
  status === "Hợp lệ"
    ? "green"
    : status === "Mới"
      ? "blue"
      : status === "Trùng"
        ? "amber"
        : "neutral";

function ReportSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <UiSelect
        aria-label={options[0]}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </UiSelect>
    </label>
  );
}

/**
 * Hàng đợi phản ánh của người dân cho cán bộ phòng chống thiên tai.
 * Tái dùng bố cục/CSS của Trung tâm cảnh báo (alert-summary-grid, alert-list…).
 */
export function CitizenReportListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const store = useOperationalState();
  const reports = store.citizenReports;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Tất cả trạng thái");
  const [category, setCategory] = useState("Tất cả loại");
  const [reviewing, setReviewing] = useState<CitizenReport | null>(null);
  const rows = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            (status === "Tất cả trạng thái" || report.status === status) &&
            (category === "Tất cả loại" || report.category === category) &&
            (!search ||
              `${report.code} ${report.reporterName} ${report.contact} ${report.description} ${report.location.address}`
                .toLowerCase()
                .includes(search.toLowerCase())),
        )
        .sort((a, b) => {
          const openDiff = Number(isCitizenReportOpen(b)) - Number(isCitizenReportOpen(a));
          return openDiff || b.createdAt.localeCompare(a.createdAt);
        }),
    [reports, search, status, category],
  );
  const open = reports.filter(isCitizenReportOpen).length;
  const valid = reports.filter((report) => report.status === "Hợp lệ").length;
  const canReview = store.can("report_review");
  return (
    <div className="workspace-content alerts-page">
      <PageSectionHeader
        section="Ứng phó"
        title="Phản ánh từ người dân"
        description="Thông tin hiện trường do người dân gửi qua Cổng công dân. Cán bộ đánh giá Hợp lệ / Không hợp lệ / Trùng trước khi đưa vào sự cố hoặc SOS."
        icon={MessageSquareWarning}
      />
      <section className="alert-summary-grid" aria-label="Tổng quan phản ánh">
        <div className={open ? "alert-summary-card danger" : "alert-summary-card"}>
          <span className="alert-summary-icon tone-amber">
            <Clock3 size={17} />
          </span>
          <div>
            <small>Chờ đánh giá</small>
            <b>{open}</b>
            <p>Phản ánh mới chưa có kết luận</p>
          </div>
        </div>
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-blue">
            <CheckCheck size={17} />
          </span>
          <div>
            <small>Hợp lệ</small>
            <b>{valid}</b>
            <p>Đã xác nhận là thông tin đúng</p>
          </div>
        </div>
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-blue">
            <MessageSquareWarning size={17} />
          </span>
          <div>
            <small>Tổng số</small>
            <b>{reports.length}</b>
            <p>Trong phạm vi phân quyền hiện tại</p>
          </div>
        </div>
      </section>

      <section className="content-section alert-queue">
        <div className="alerts-toolbar">
          <label className="ui-search incident-search alerts-search">
            <Search size={14} />
            <Input
              aria-label="Tìm kiếm phản ánh"
              placeholder="Tìm theo mã, người gửi, địa chỉ, nội dung…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <ReportSelect
            value={status}
            onChange={setStatus}
            options={["Tất cả trạng thái", "Mới", "Hợp lệ", "Không hợp lệ", "Trùng"]}
          />
          <ReportSelect
            value={category}
            onChange={setCategory}
            options={["Tất cả loại", ...citizenReportCategories]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> phản ánh phù hợp
          </span>
          <span>Phản ánh mới xếp trước, sau đó theo thời gian gửi</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Không có phản ánh phù hợp"
            description="Chưa có phản ánh nào khớp bộ lọc trong phạm vi phân quyền hiện tại."
          />
        ) : (
          <div className="alert-list">
            {rows.map((report) => (
              <article
                className={`alert-row alert-severity-medium ${
                  isCitizenReportOpen(report) ? "alert-unread" : ""
                }`}
                key={report.id}
              >
                <div className="alert-row-main">
                  <div className="alert-row-head">
                    <Badge tone={statusTone(report.status)}>{report.status}</Badge>
                    <span className="alert-row-category">{report.category}</span>
                    <span className="alert-row-condition">{report.code}</span>
                    <time>{report.createdAt}</time>
                  </div>
                  <h3>{report.description}</h3>
                  <p>
                    <MapPin size={12} /> {report.location.address} ·{" "}
                    {report.location.administrativeArea}
                    {report.location.coordinates
                      ? ` · GPS ${report.location.coordinates[1].toFixed(4)}, ${report.location.coordinates[0].toFixed(4)}`
                      : " · Không có GPS"}
                  </p>
                  <div className="alert-row-meta">
                    <span>
                      Người gửi: <b>{report.reporterName}</b> · {report.contact}
                    </span>
                    {report.reviewedBy && (
                      <span>
                        Kết luận bởi: <b>{report.reviewedBy}</b> · {report.reviewedAt}
                        {report.reviewNote ? ` · ${report.reviewNote}` : ""}
                        {report.duplicateOfId ? ` · trùng ${report.duplicateOfId}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="alert-row-actions">
                  {canReview && isCitizenReportOpen(report) && (
                    <Button size="sm" onClick={() => setReviewing(report)}>
                      Đánh giá
                    </Button>
                  )}
                  {report.duplicateOfId?.startsWith("SOS-") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/sos/${report.duplicateOfId}`)}
                    >
                      Mở SOS gốc
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {reviewing && (
        <CitizenReportReviewDialog
          report={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
