import { useState } from "react";
import { Compass, Info, LocateFixed, MapPin, X } from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Button } from "@/components/ui";
import { OperationalMapExplorer } from "@/features/operational-map/components/OperationalMapExplorer";
import { useCitizenLocation } from "./useCitizenLocation";

/**
 * Trang Bản đồ tác nghiệp của người dân (/map) — ĐÚNG bản đồ tác nghiệp dùng
 * chung với lực lượng (cùng thanh lọc, cùng lớp, cùng dải bão, cùng xem lại
 * bão lịch sử, cùng chú giải, cùng khối dự báo khí tượng ECMWF-IFS), chỉ khác
 * ở dữ liệu đã lọc quyền: công dân thấy SOS của chính mình + điểm sơ tán.
 */
export function CitizenMapPage({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const { coords: gpsLocation, source: locationSource, locating, setLocation, requestGps } =
    useCitizenLocation();
  /** Tăng mỗi lần vị trí đổi để bản đồ tác nghiệp bay tới điểm mới. */
  const [locKey, setLocKey] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const user = store.currentUser!;
  const userScope = user.geographicScope.name || "Hà Nội";

  const flashFeedback = (message: string, ttl = 5000) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), ttl);
  };

  const handleRequestGps = () => {
    requestGps((ok, message) => {
      if (ok) setLocKey((key) => key + 1);
      flashFeedback(message, ok ? 5000 : 7000);
    });
  };

  return (
    <div className="citizen-portal">
      {feedback && (
        <div className="admin-feedback-toast">
          <Info size={16} />
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      <OperationalMapExplorer
        navigate={navigate}
        focus={null}
        citizen={{
          header: (
            <div className="citizen-card-header">
              <h2>
                <Compass size={18} color="#175cd3" />
                Bản đồ tác nghiệp & điểm sơ tán
              </h2>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Button
                  variant="secondary"
                  onClick={handleRequestGps}
                  disabled={locating}
                  style={{ fontSize: "12.5px", height: "32px", display: "inline-flex", gap: "5px" }}
                >
                  <LocateFixed size={14} />
                  {locating ? "Đang dò GPS…" : "Lấy vị trí GPS của tôi"}
                </Button>
                <small style={{ color: "#64748b", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <MapPin size={13} /> {userScope}
                  {locationSource === "gps"
                    ? " · GPS thiết bị"
                    : locationSource === "map"
                      ? " · vị trí tự đánh dấu"
                      : " · chưa có vị trí (chạm bản đồ để đánh dấu)"}
                </small>
              </div>
            </div>
          ),
          selectionCard: (point, onClose) => (
            <div className="citizen-map-selected" role="status">
              <div>
                <b>{point.kindLabel} · {point.code}</b>
                <span>{point.title} — {point.area}</span>
                <small>Trạng thái: {point.status}</small>
              </div>
              {point.kind === "sos" && (
                <button type="button" onClick={() => navigate("/my-requests")}>
                  Xem trong Yêu cầu của tôi
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Đóng">
                <X size={14} />
              </button>
            </div>
          ),
          onPickLocation: (coords) => {
            setLocation(coords, "map");
            setLocKey((key) => key + 1);
            flashFeedback(
              `Đã đánh dấu vị trí trên bản đồ: ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)} (không phải GPS thiết bị).`,
            );
          },
          highlightLocation: gpsLocation ? { coords: gpsLocation, key: locKey } : null,
          legendHint: (
            <span className="citizen-legend-hint">Bật nút ⓘ góc phải bản đồ để tra cứu tỉnh thành & thời tiết</span>
          ),
        }}
      />
    </div>
  );
}
