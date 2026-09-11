import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  ChevronRight,
  Clock3,
  MapPin,
  MessageSquareWarning,
  Radio,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { SosRequest } from "@/domain/sos/types";
import type { CitizenReport } from "@/domain/reports/types";
import { isSosWaitingTooLong } from "@/domain/sos/rules";
import { isCitizenReportOpen } from "@/domain/reports/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { defaultScopedArea, scopeAreaOptions } from "@/application/areas/scopedAreas";
import { Badge, Button, EmptyState, PageSectionHeader, Input } from "@/components/ui";
import { CitizenReportReviewDialog } from "@/features/reports/components/CitizenReportReviewDialog";

/**
 * HÀNG ĐỢI TIẾP NHẬN CHUNG — SOS + PHẢN ÁNH GỘP MỘT (Yêu cầu 4)
 * ─────────────────────────────────────────────────────────────
 * SOS và phản ánh của dân là MỘT dòng tiếp nhận duy nhất: cùng người gửi, cùng
 * vị trí, cùng vòng đời tiếp nhận → xác minh → điều phối. Tách hai hàng đợi
 * khiến cán bộ trực phải đảo qua lại và dễ sót phản ánh đang leo thang thành
 * SOS. Trang này gộp cả hai vào một hàng đợi, phân biệt bằng huy hiệu loại và
 * bộ lọc; bấm vào SOS vẫn mở hồ sơ SOS chi tiết như cũ, phản ánh đánh giá
 * ngay tại chỗ.
 *
 * Dữ liệu đã lọc quyền từ store: cán bộ thấy toàn bộ trong địa bàn, đơn vị
 * cứu hộ thấy SOS + phản ánh của chính mình.
 */

type IntakeType = "all" | "sos" | "report";

type IntakeRow =
  | { key: string; type: "sos"; ts: number; sos: SosRequest }
  | { key: string; type: "report"; ts: number; report: CitizenReport };

/** Chuyển "21/08/2026 08:00" thành timestamp để sắp xếp. */
function parseVnTime(value: string): number {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return 0;
  const [, day, month, year, hour = "0", minute = "0"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  ).getTime();
}

const SOS_DONE = ["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"];
const isSosOpen = (sos: SosRequest) => !SOS_DONE.includes(sos.status);

/** SOS mở xếp trước theo ưu tiên, sau đó tới phản ánh mở, cuối cùng là việc đã xong. */
function urgencyRank(row: IntakeRow): number {
  if (row.type === "sos") {
    if (!isSosOpen(row.sos)) return 10;
    if (row.sos.priority.startsWith("P1")) return 0;
    if (row.sos.priority.startsWith("P2")) return 1;
    if (row.sos.priority.startsWith("P3")) return 2;
    return 3;
  }
  return isCitizenReportOpen(row.report) ? 4 : 11;
}

const sosPriorityTone = (priority: string) =>
  priority.startsWith("P1")
    ? "red"
    : priority.startsWith("P2")
      ? "amber"
      : priority.startsWith("P3")
        ? "blue"
        : "neutral";

const sosStatusTone = (status: string) =>
  status === "Đã đóng" || status === "Đã xử lý"
    ? "green"
    : status === "Từ chối" || status === "Hủy"
      ? "neutral"
      : status === "Không liên lạc được"
        ? "red"
        : "blue";

const reportStatusTone = (status: CitizenReport["status"]) =>
  status === "Hợp lệ"
    ? "green"
    : status === "Mới"
      ? "blue"
      : status === "Trùng"
        ? "amber"
        : "neutral";

function IntakeSelect({
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

export function IntakeQueuePage({
  navigate,
  initialType = "all",
}: {
  navigate: (path: string) => void;
  /** Deep-link /reports mở sẵn tab phản ánh; mặc định là tất cả. */
  initialType?: IntakeType;
}) {
  const store = useOperationalState();
  const sosRequests = store.sosRequests;
  const reports = store.citizenReports;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<IntakeType>(initialType);
  // Dropdown khu vực khoanh theo địa bàn trong hồ sơ (vd ở Tây Hồ thì chỉ
  // liệt kê khu vực thuộc Tây Hồ); địa bàn chỉ còn 1 khu vực thì chọn sẵn.
  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const sos of sosRequests)
      set.add(sos.location.administrativeArea.split(",")[0]);
    for (const report of reports)
      set.add(report.location.administrativeArea.split(",")[0]);
    return scopeAreaOptions([...set].sort(), store.currentUser?.geographicScope);
  }, [sosRequests, reports, store.currentUser?.geographicScope]);
  const [area, setArea] = useState(() => defaultScopedArea(areas));
  const [openOnly, setOpenOnly] = useState(false);
  const [reviewing, setReviewing] = useState<CitizenReport | null>(null);

  const rows = useMemo<IntakeRow[]>(() => {
    const query = search.trim().toLowerCase();
    const list: IntakeRow[] = [
      ...sosRequests.map(
        (sos): IntakeRow => ({
          key: `sos-${sos.id}`,
          type: "sos",
          ts: parseVnTime(sos.receivedAt),
          sos,
        }),
      ),
      ...reports.map(
        (report): IntakeRow => ({
          key: `report-${report.id}`,
          type: "report",
          ts: parseVnTime(report.createdAt),
          report,
        }),
      ),
    ];
    return list
      .filter((row) => {
        if (typeFilter !== "all" && row.type !== typeFilter) return false;
        if (openOnly) {
          if (row.type === "sos" ? !isSosOpen(row.sos) : !isCitizenReportOpen(row.report))
            return false;
        }
        const rowArea =
          row.type === "sos"
            ? row.sos.location.administrativeArea.split(",")[0]
            : row.report.location.administrativeArea.split(",")[0];
        if (area !== "Tất cả khu vực" && rowArea !== area) return false;
        if (!query) return true;
        const haystack =
          row.type === "sos"
            ? `${row.sos.code} ${row.sos.reporter.name} ${row.sos.reporter.contact} ${row.sos.description} ${row.sos.location.address}`
            : `${row.report.code} ${row.report.reporterName} ${row.report.contact} ${row.report.description} ${row.report.location.address}`;
        return haystack.toLowerCase().includes(query);
      })
      .sort((a, b) => urgencyRank(a) - urgencyRank(b) || b.ts - a.ts);
  }, [sosRequests, reports, search, typeFilter, area, openOnly]);

  const p1 = sosRequests.filter(
    (sos) => sos.priority.startsWith("P1") && isSosOpen(sos),
  ).length;
  const unverified = sosRequests.filter(
    (sos) => sos.verificationStatus !== "Đã xác minh" && isSosOpen(sos),
  ).length;
  const pendingReports = reports.filter(isCitizenReportOpen).length;
  const canReview = store.can("report_review");

  const typeTabs: Array<{ value: IntakeType; label: string }> = [
    { value: "all", label: `Tất cả (${sosRequests.length + reports.length})` },
    { value: "sos", label: `SOS (${sosRequests.length})` },
    { value: "report", label: `Phản ánh (${reports.length})` },
  ];

  return (
    <div className="workspace-content alerts-page">
      <PageSectionHeader
        section="Ứng phó"
        title="Tiếp nhận yêu cầu"
        description="Một hàng đợi duy nhất cho mọi tín hiệu từ người dân: SOS khẩn cấp và phản ánh hiện trường. SOS mở xếp trước theo ưu tiên, phản ánh mở xếp sau, việc đã xong xếp cuối."
        icon={Radio}
      />

      <section className="alert-summary-grid" aria-label="Tổng quan tiếp nhận">
        <div className={p1 ? "alert-summary-card danger" : "alert-summary-card"}>
          <span className="alert-summary-icon tone-red">
            <AlertTriangle size={17} />
          </span>
          <div>
            <small>SOS P1 đang mở</small>
            <b>{p1}</b>
            <p>Cần can thiệp ngay lập tức</p>
          </div>
        </div>
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-amber">
            <ShieldCheck size={17} />
          </span>
          <div>
            <small>SOS chờ xác minh</small>
            <b>{unverified}</b>
            <p>Chưa có kết luận xác minh</p>
          </div>
        </div>
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-blue">
            <MessageSquareWarning size={17} />
          </span>
          <div>
            <small>Phản ánh chờ đánh giá</small>
            <b>{pendingReports}</b>
            <p>Chưa kết luận Hợp lệ / Trùng</p>
          </div>
        </div>
        <div className="alert-summary-card">
          <span className="alert-summary-icon tone-blue">
            <CheckCheck size={17} />
          </span>
          <div>
            <small>Tổng tiếp nhận</small>
            <b>{sosRequests.length + reports.length}</b>
            <p>Trong phạm vi phân quyền hiện tại</p>
          </div>
        </div>
      </section>

      <section className="content-section alert-queue">
        <div className="alerts-toolbar">
          <label className="ui-search incident-search alerts-search">
            <Search size={14} />
            <Input
              aria-label="Tìm kiếm SOS và phản ánh"
              placeholder="Tìm mã, người gửi, số liên hệ, địa chỉ, nội dung…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <IntakeSelect
            value={
              typeFilter === "all" ? "Tất cả loại" : typeFilter === "sos" ? "SOS" : "Phản ánh"
            }
            onChange={(value) =>
              setTypeFilter(value === "SOS" ? "sos" : value === "Phản ánh" ? "report" : "all")
            }
            options={["Tất cả loại", "SOS", "Phản ánh"]}
          />
          <IntakeSelect
            value={area}
            onChange={setArea}
            options={["Tất cả khu vực", ...areas]}
          />
          <label className="intake-open-toggle">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(event) => setOpenOnly(event.target.checked)}
            />
            Chỉ việc đang mở
          </label>
        </div>
        <div className="intake-type-tabs" role="tablist" aria-label="Loại tiếp nhận">
          {typeTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={typeFilter === tab.value}
              className={typeFilter === tab.value ? "active" : ""}
              onClick={() => setTypeFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> tiếp nhận phù hợp
          </span>
          <span>SOS mở theo ưu tiên trước, sau đó tới phản ánh mở</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Không có tiếp nhận phù hợp"
            description="Chưa có SOS hay phản ánh nào khớp bộ lọc trong phạm vi phân quyền hiện tại."
          />
        ) : (
          <div className="alert-list">
            {rows.map((row) =>
              row.type === "sos" ? (
                <article
                  className={`alert-row alert-severity-${
                    row.sos.priority.startsWith("P1")
                      ? "critical"
                      : row.sos.priority.startsWith("P2")
                        ? "high"
                        : "medium"
                  } ${isSosOpen(row.sos) ? "alert-unread" : ""}`}
                  key={row.key}
                >
                  <div
                    className="alert-row-main"
                    onClick={() => navigate(`/sos/${row.sos.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        navigate(`/sos/${row.sos.id}`);
                    }}
                  >
                    <div className="alert-row-head">
                      <Badge tone="red">SOS</Badge>
                      <Badge tone={sosPriorityTone(row.sos.priority)}>
                        {row.sos.priority}
                      </Badge>
                      <Badge tone={sosStatusTone(row.sos.status)}>{row.sos.status}</Badge>
                      <span className="alert-row-condition">{row.sos.code}</span>
                      <time>{row.sos.receivedAt}</time>
                    </div>
                    <h3>
                      {row.sos.code} · {row.sos.location.name}
                    </h3>
                    <p>{row.sos.description}</p>
                    <div className="alert-row-meta">
                      <span>
                        <MapPin size={12} /> {row.sos.location.administrativeArea}
                      </span>
                      <span>
                        <Users size={12} /> {row.sos.peopleAtRisk} người ·{" "}
                        {row.sos.injuredCount} bị thương
                      </span>
                      <span>
                        Xác minh: <b>{row.sos.verificationStatus}</b> ·{" "}
                        {row.sos.assignedTeamId
                          ? `Đội ${row.sos.assignedTeamId}`
                          : "Chưa giao đội"}
                      </span>
                      {isSosWaitingTooLong(row.sos) && isSosOpen(row.sos) && (
                        <span className="waiting">
                          <Clock3 size={11} /> Chờ xử lý lâu
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="alert-row-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Mở hồ sơ SOS"
                      onClick={() => navigate(`/sos/${row.sos.id}`)}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </article>
              ) : (
                <article
                  className={`alert-row alert-severity-medium ${
                    isCitizenReportOpen(row.report) ? "alert-unread" : ""
                  }`}
                  key={row.key}
                >
                  <div className="alert-row-main">
                    <div className="alert-row-head">
                      <Badge tone="amber">Phản ánh</Badge>
                      <Badge tone={reportStatusTone(row.report.status)}>
                        {row.report.status}
                      </Badge>
                      <span className="alert-row-category">{row.report.category}</span>
                      <span className="alert-row-condition">{row.report.code}</span>
                      <time>{row.report.createdAt}</time>
                    </div>
                    <h3>{row.report.description}</h3>
                    <p>
                      <MapPin size={12} /> {row.report.location.address} ·{" "}
                      {row.report.location.administrativeArea}
                      {row.report.location.coordinates
                        ? ` · GPS ${row.report.location.coordinates[1].toFixed(4)}, ${row.report.location.coordinates[0].toFixed(4)}`
                        : " · Không có GPS"}
                    </p>
                    <div className="alert-row-meta">
                      <span>
                        Người gửi: <b>{row.report.reporterName}</b> · {row.report.contact}
                      </span>
                      {row.report.reviewedBy && (
                        <span>
                          Kết luận bởi: <b>{row.report.reviewedBy}</b> · {row.report.reviewedAt}
                          {row.report.reviewNote ? ` · ${row.report.reviewNote}` : ""}
                          {row.report.duplicateOfId ? ` · trùng ${row.report.duplicateOfId}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="alert-row-actions">
                    {canReview && isCitizenReportOpen(row.report) && (
                      <Button size="sm" onClick={() => setReviewing(row.report)}>
                        Đánh giá
                      </Button>
                    )}
                    {row.report.duplicateOfId?.startsWith("SOS-") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/sos/${row.report.duplicateOfId}`)}
                      >
                        Mở SOS gốc
                      </Button>
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </section>
      {reviewing && (
        <CitizenReportReviewDialog report={reviewing} onClose={() => setReviewing(null)} />
      )}
    </div>
  );
}
