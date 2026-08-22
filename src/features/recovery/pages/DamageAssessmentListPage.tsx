import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  filterDamageAssessments,
  type AssessmentFilters,
} from "@/application/recovery/recoveryQueries";
import { isAssessmentVerificationOverdue } from "@/domain/recovery/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button } from "@/components/ui";
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <select
        aria-label={options[0]}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <ChevronDown size={12} />
    </label>
  );
}
const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1e9)} tỷ ₫`;
export function DamageAssessmentListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { damageAssessments, incidents, can } = useOperationalState();
  const [create, setCreate] = useState(false);
  const [filters, setFilters] = useState<AssessmentFilters>({
    search: "",
    status: "Tất cả trạng thái",
    type: "Tất cả loại đánh giá",
    severity: "Tất cả mức độ",
    area: "Tất cả khu vực",
    assessor: "Tất cả cán bộ",
    incident: "Tất cả sự cố",
    verification: "Tất cả xác minh",
    dateRange: "Tất cả thời gian",
  });
  const patch = (key: keyof AssessmentFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const rows = useMemo(
    () => filterDamageAssessments(damageAssessments, filters),
    [damageAssessments, filters],
  );
  const pending = damageAssessments.filter((item) =>
    ["Đã gửi", "Đang thẩm định"].includes(item.status),
  ).length;
  return (
    <div className="workspace-content recovery-page">
      <div className="page-header recovery-header">
        <div>
          <div className="breadcrumbs">
            <span>Phục hồi</span>
            <ChevronRight size={13} />
            <b>Đánh giá thiệt hại</b>
          </div>
          <h1>Đánh giá thiệt hại</h1>
          <p>Ghi nhận, thẩm định và xác minh cơ sở cho hoạt động khôi phục</p>
        </div>
        <div className="detail-actions">
          <Button
            variant="secondary"
            onClick={() => navigate("/recovery/projects")}
          >
            Dự án khôi phục
          </Button>
          {can("damage_assessment_create") && (
            <Button onClick={() => setCreate(true)}>
              <ClipboardPlus size={15} />
              Tạo đánh giá
            </Button>
          )}
        </div>
      </div>
      <section className="recovery-strip">
        <span className={pending ? "warning" : ""}>
          <ShieldCheck size={16} />
          <b>{pending}</b> chờ xác minh
        </span>
        <span>
          <AlertTriangle size={16} />
          <b>
            {
              damageAssessments.filter((item) =>
                ["Nghiêm trọng", "Phá hủy"].includes(item.severity),
              ).length
            }
          </b>{" "}
          mức độ cao
        </span>
        <p>Ưu tiên chờ xác minh → mức độ → thiệt hại ước tính → quá hạn.</p>
      </section>
      <section className="relief-worklist">
        <div className="relief-filters">
          <label className="incident-search">
            <Search size={15} />
            <input
              value={filters.search}
              onChange={(event) => patch("search", event.target.value)}
              placeholder="Tìm mã, khu vực, cán bộ hoặc nội dung đánh giá…"
            />
            {filters.search && (
              <button onClick={() => patch("search", "")}>
                <X size={13} />
              </button>
            )}
          </label>
          <Select
            value={filters.status}
            onChange={(v) => patch("status", v)}
            options={[
              "Tất cả trạng thái",
              "Nháp",
              "Đã gửi",
              "Đang thẩm định",
              "Đã xác minh",
              "Từ chối",
            ]}
          />
          <Select
            value={filters.type}
            onChange={(v) => patch("type", v)}
            options={[
              "Tất cả loại đánh giá",
              ...new Set(damageAssessments.map((item) => item.assessmentType)),
            ]}
          />
          <Select
            value={filters.severity}
            onChange={(v) => patch("severity", v)}
            options={[
              "Tất cả mức độ",
              "Nhẹ",
              "Trung bình",
              "Nghiêm trọng",
              "Phá hủy",
            ]}
          />
          <Select
            value={filters.area}
            onChange={(v) => patch("area", v)}
            options={[
              "Tất cả khu vực",
              ...new Set(damageAssessments.map((item) => item.area)),
            ]}
          />
          <Select
            value={filters.assessor}
            onChange={(v) => patch("assessor", v)}
            options={[
              "Tất cả cán bộ",
              ...new Set(damageAssessments.map((item) => item.assessor)),
            ]}
          />
          <Select
            value={filters.incident}
            onChange={(v) => patch("incident", v)}
            options={["Tất cả sự cố", ...incidents.map((item) => item.id)]}
          />
          <Select
            value={filters.verification}
            onChange={(v) => patch("verification", v)}
            options={["Tất cả xác minh", "Đã xác minh", "Chưa xác minh"]}
          />
          <Select
            value={filters.dateRange}
            onChange={(v) => patch("dateRange", v)}
            options={["Tất cả thời gian", "Hôm nay"]}
          />
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{rows.length}</b> assessment
          </span>
          <span>Danh sách nghiệp vụ, không phải báo cáo thống kê</span>
        </div>
        <div className="assessment-table">
          <div className="assessment-table-head">
            <span>Assessment / Khu vực</span>
            <span>Loại</span>
            <span>Mức độ</span>
            <span>Trạng thái</span>
            <span>Tác động</span>
            <span>Thiệt hại ước tính</span>
            <span>Cán bộ</span>
            <span>Thời điểm</span>
            <span />
          </div>
          {rows.map((item) => (
            <button
              className="assessment-row"
              key={item.id}
              onClick={() => navigate(`/recovery/assessments/${item.id}`)}
            >
              <span>
                <b>
                  {item.code} · {item.area}
                </b>
                <small>{item.summary}</small>
                <small>
                  {item.incidentId} · revision {item.revision}
                </small>
              </span>
              <span>{item.assessmentType}</span>
              <span>
                <Badge
                  tone={
                    item.severity === "Phá hủy" ||
                    item.severity === "Nghiêm trọng"
                      ? "red"
                      : item.severity === "Trung bình"
                        ? "amber"
                        : "neutral"
                  }
                >
                  {item.severity}
                </Badge>
              </span>
              <span>
                <Badge
                  tone={
                    item.status === "Đã xác minh"
                      ? "green"
                      : item.status === "Từ chối"
                        ? "red"
                        : item.status === "Đang thẩm định"
                          ? "amber"
                          : "blue"
                  }
                >
                  {item.status}
                </Badge>
                {isAssessmentVerificationOverdue(item) && (
                  <small className="overdue">Quá hạn xác minh</small>
                )}
              </span>
              <span>
                <b>{item.affectedHouseholds} hộ</b>
                <small>
                  {item.damagedBuildings} công trình · {item.damagedRoads} tuyến
                  đường
                </small>
              </span>
              <span>
                <b>{money(item.estimatedLoss)}</b>
              </span>
              <span>
                <b>{item.assessor}</b>
                <small>{item.geographicScope}</small>
              </span>
              <span>
                <Clock3 size={12} />
                {item.assessedAt}
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>
      {create && (
        <CreateAssessmentDialog
          onClose={() => setCreate(false)}
          navigate={navigate}
        />
      )}
    </div>
  );
}
function CreateAssessmentDialog({
  onClose,
  navigate,
}: {
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const { incidents, createDamageAssessment } = useOperationalState();
  const [incidentId, setIncident] = useState("INC-0241");
  const [area, setArea] = useState("Tây Hồ, Hà Nội");
  const [assessor, setAssessor] = useState("Lê Nguyễn Minh Trí");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const save = () => {
    try {
      const incident = incidents.find((item) => item.id === incidentId)!;
      const id = createDamageAssessment({
        incidentId,
        area,
        assessmentType: "Hạ tầng",
        severity: "Trung bình",
        assessor,
        assessedAt: "21/08/2026 10:45",
        summary,
        affectedPopulation: 0,
        affectedHouseholds: 0,
        damagedBuildings: 0,
        damagedInfrastructure: 0,
        damagedRoads: 0,
        damagedAgriculture: 0,
        damagedUtilities: 0,
        estimatedLoss: 0,
        geographicScope: area,
        location: { name: area, coordinates: incident.location.coordinates },
        affectedAreaCoordinates: [
          [
            incident.location.coordinates[0] - 0.005,
            incident.location.coordinates[1] - 0.005,
          ],
          [
            incident.location.coordinates[0] + 0.005,
            incident.location.coordinates[1] - 0.005,
          ],
          [
            incident.location.coordinates[0] + 0.005,
            incident.location.coordinates[1] + 0.005,
          ],
          [
            incident.location.coordinates[0] - 0.005,
            incident.location.coordinates[1] + 0.005,
          ],
          [
            incident.location.coordinates[0] - 0.005,
            incident.location.coordinates[1] - 0.005,
          ],
        ],
      });
      onClose();
      navigate(`/recovery/assessments/${id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tạo assessment.",
      );
    }
  };
  return (
    <>
      <button className="dialog-backdrop" onClick={onClose} />
      <div className="incident-form-dialog recovery-dialog">
        <header>
          <h2>Tạo đánh giá thiệt hại</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          <label className="field">
            <span>Incident</span>
            <select
              value={incidentId}
              onChange={(e) => setIncident(e.target.value)}
            >
              {incidents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} — {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Khu vực / phạm vi</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} />
          </label>
          <label className="field field-full">
            <span>Cán bộ đánh giá</span>
            <input
              value={assessor}
              onChange={(e) => setAssessor(e.target.value)}
            />
          </label>
          <label className="field field-full">
            <span>Tóm tắt ban đầu</span>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          {error && (
            <p className="team-form-error">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>
        <footer>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save}>Tạo assessment</Button>
        </footer>
      </div>
    </>
  );
}
