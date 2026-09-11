import { useMemo, useState } from "react";
import {
  Info,
  LifeBuoy,
  MapPin,
  Radio,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button } from "@/components/ui";
import { CitizenReportModal, SosCreationModal } from "./CitizenRequestModals";
import { useCitizenLocation } from "./useCitizenLocation";

/** Chuyển "21/08/2026 08:00" thành timestamp để sắp xếp dòng thời gian chung. */
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

type MyRequestFilter = "all" | "sos" | "report";

/**
 * Trang Yêu cầu của tôi (/my-requests) — dòng thời gian chung
 * các yêu cầu của chính mình (mới nhất xếp trước) + nút gửi SOS/phản ánh mới.
 */
export function CitizenRequestsPage() {
  const store = useOperationalState();
  const { coords: gpsLocation, source: locationSource, requestGps } = useCitizenLocation();
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [createdSosId, setCreatedSosId] = useState<string | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<MyRequestFilter>("all");

  const user = store.currentUser!;

  // SOS/phản ánh của chính tài khoản đang đăng nhập (theo ownerUserId).
  const mySosList = store.sosRequests.filter((sos) => sos.ownerUserId === user.id);
  const myReports = store.citizenReports.filter((report) => report.ownerUserId === user.id);

  /** Dòng thời gian chung: SOS và phản ánh của chính mình, mới nhất xếp trước. */
  const myRequests = useMemo(() => {
    const rows: Array<
      | { key: string; type: "sos"; ts: number; sos: (typeof mySosList)[number] }
      | { key: string; type: "report"; ts: number; report: (typeof myReports)[number] }
    > = [
      ...mySosList.map((sos) => ({
        key: `sos-${sos.id}`,
        type: "sos" as const,
        ts: parseVnTime(sos.receivedAt),
        sos,
      })),
      ...myReports.map((report) => ({
        key: `report-${report.id}`,
        type: "report" as const,
        ts: parseVnTime(report.createdAt),
        report,
      })),
    ];
    return rows
      .filter((row) => requestFilter === "all" || row.type === requestFilter)
      .sort((a, b) => b.ts - a.ts);
  }, [mySosList, myReports, requestFilter]);

  const handleRequestGps = () => {
    // Biểu mẫu SOS tự hiển thị badge vị trí; chỉ cần cập nhật cache dùng chung.
    requestGps(() => {});
  };

  return (
    <div className="citizen-portal">
      <div className="citizen-section-card" id="citizen-my-requests">
        <div className="citizen-card-header">
          <h2>
            <Radio size={18} color="#dc2626" />
            Yêu cầu của tôi ({mySosList.length + myReports.length})
          </h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant="secondary"
              onClick={() => setSosModalOpen(true)}
              style={{ fontSize: "12.5px", height: "30px" }}
            >
              + Gửi SOS
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReportModalOpen(true)}
              style={{ fontSize: "12.5px", height: "30px" }}
            >
              + Gửi phản ánh
            </Button>
          </div>
        </div>
        {createdSosId && (
          <div
            className="admin-feedback-toast"
            style={{ margin: "10px 16px 0", backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}
          >
            <Info size={16} />
            <span>
              Đã ghi nhận yêu cầu SOS <b>{createdSosId}</b> (trạng thái Mới). Cán bộ sẽ xác minh
              và điều phối; bạn sẽ thấy tiến trình ngay tại đây.
            </span>
            <button onClick={() => setCreatedSosId(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        {createdReportId && (
          <div className="admin-feedback-toast" style={{ margin: "10px 16px 0" }}>
            <Info size={16} />
            <span>
              Đã ghi nhận phản ánh <b>{createdReportId}</b> (trạng thái Mới). Cán bộ sẽ đánh giá
              Hợp lệ / Không hợp lệ / Trùng và bạn sẽ thấy kết quả tại đây.
            </span>
            <button onClick={() => setCreatedReportId(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        <div className="citizen-request-filters" role="group" aria-label="Lọc yêu cầu của tôi">
          <button
            type="button"
            className={requestFilter === "all" ? "active" : ""}
            onClick={() => setRequestFilter("all")}
          >
            Tất cả ({mySosList.length + myReports.length})
          </button>
          <button
            type="button"
            className={requestFilter === "sos" ? "active" : ""}
            onClick={() => setRequestFilter("sos")}
          >
            SOS ({mySosList.length})
          </button>
          <button
            type="button"
            className={requestFilter === "report" ? "active" : ""}
            onClick={() => setRequestFilter("report")}
          >
            Phản ánh ({myReports.length})
          </button>
        </div>
        <div className="citizen-my-sos-list">
          {myRequests.map((row) =>
            row.type === "sos" ? (
              <div key={row.key} className="citizen-sos-card">
                <div className="citizen-sos-head">
                  <div>
                    <Badge tone="red">SOS</Badge>{" "}
                    <b>Mã cứu nạn: {row.sos.id}</b> · <small style={{ color: "#64748b" }}>{row.sos.receivedAt}</small>
                  </div>
                  <Badge tone={row.sos.status === "Đã xử lý" || row.sos.status === "Đã đóng" ? "green" : "red"}>
                    {row.sos.status}
                  </Badge>
                </div>
                <p className="citizen-sos-desc">{row.sos.description}</p>
                <div className="citizen-sos-meta">
                  <span>
                    <MapPin size={13} /> {row.sos.location.address}
                    {row.sos.gpsCaptured ? " · GPS thiết bị" : " · không có GPS thiết bị"}
                  </span>
                  <span>
                    <Users size={13} /> {row.sos.peopleAtRisk} người ({row.sos.elderlyCount} người già, {row.sos.childrenCount} trẻ nhỏ)
                  </span>
                  {row.sos.assignedTeamId && (
                    <span style={{ color: "#16a34a", fontWeight: "600" }}>
                      <LifeBuoy size={13} /> Đội cứu hộ: {row.sos.assignedTeamId}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div key={row.key} className="citizen-sos-card">
                <div className="citizen-sos-head">
                  <div>
                    <Badge tone="amber">Phản ánh</Badge>{" "}
                    <b>Mã phản ánh: {row.report.code}</b> · <small style={{ color: "#64748b" }}>{row.report.createdAt}</small>
                  </div>
                  <Badge
                    tone={
                      row.report.status === "Hợp lệ"
                        ? "green"
                        : row.report.status === "Mới"
                          ? "blue"
                          : row.report.status === "Trùng"
                            ? "amber"
                            : "neutral"
                    }
                  >
                    {row.report.status}
                  </Badge>
                </div>
                <p className="citizen-sos-desc">
                  <b>{row.report.category}:</b> {row.report.description}
                </p>
                <div className="citizen-sos-meta">
                  <span>
                    <MapPin size={13} /> {row.report.location.address}
                    {row.report.location.coordinates ? " · có tọa độ" : " · không có tọa độ"}
                  </span>
                  {row.report.reviewNote && (
                    <span>
                      <Info size={13} /> {row.report.reviewNote}
                    </span>
                  )}
                </div>
              </div>
            ),
          )}
          {!myRequests.length && (
            <div style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
              <ShieldCheck size={36} color="#16a34a" style={{ margin: "0 auto 8px" }} />
              <b style={{ display: "block", color: "#334155" }}>
                {requestFilter === "all"
                  ? "Bạn chưa gửi yêu cầu nào."
                  : requestFilter === "sos"
                    ? "Bạn chưa có yêu cầu cứu hộ nào."
                    : "Bạn chưa gửi phản ánh nào."}
              </b>
              <span style={{ fontSize: "13px" }}>
                Khi gặp nguy hiểm, hãy nhấn nút “GỬI ĐỊNH VỊ SOS 1 CHẠM” ở Trang chủ. Thông tin hiện trường
                chưa khẩn cấp (ngập, sạt lở, cây đổ, mất điện…) thì gửi phản ánh.
              </span>
            </div>
          )}
        </div>
      </div>

      {sosModalOpen && (
        <SosCreationModal
          location={gpsLocation}
          locationSource={locationSource}
          onRequestGps={handleRequestGps}
          onClose={() => setSosModalOpen(false)}
          onSuccess={(id) => {
            setSosModalOpen(false);
            setCreatedSosId(id);
          }}
        />
      )}
      {reportModalOpen && (
        <CitizenReportModal
          location={gpsLocation}
          locationSource={locationSource}
          onClose={() => setReportModalOpen(false)}
          onSuccess={(id) => {
            setReportModalOpen(false);
            setCreatedReportId(id);
          }}
        />
      )}
    </div>
  );
}
