import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  HelpCircle,
  Info,
  LifeBuoy,
  MapPin,
  Package,
  PhoneCall,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge } from "@/components/ui";
import {
  fetchEcmwfWeatherData,
  type StationForecast,
} from "@/infrastructure/weather/ecmwfWeatherService";
import {
  pushLiveLocationPing,
  removeLiveLocationPing,
} from "@/infrastructure/redis/redisClient";
import { SosCreationModal } from "./CitizenRequestModals";
import { useCitizenLocation, type CitizenLocationSource } from "./useCitizenLocation";

/* ─────────────── Trang chủ — Cổng thông tin công dân ───────────────
 * Chỉ giữ: SOS 1 chạm, thống kê nhanh, thời tiết, cảnh báo công bố,
 * điểm sơ tán, đường dây nóng, cẩm nang.
 * Bản đồ tác nghiệp → trang riêng (CitizenMapPage, /map).
 * Dòng thời gian yêu cầu → trang riêng (CitizenRequestsPage, /my-requests).
 */
export function CitizenPortal() {
  const store = useOperationalState();
  // Vị trí dùng chung giữa các trang công dân (GPS thiết bị hoặc điểm tự
  // chạm trên bản đồ) — không bao giờ là tọa độ mặc định.
  const { coords: gpsLocation, source: locationSource, locating, setLocation, requestGps } =
    useCitizenLocation();
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [createdSosId, setCreatedSosId] = useState<{ id: string; source: CitizenLocationSource } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  /** Cửa sổ hoàn tác 5 giây sau SOS 1 chạm: hết giờ thì chốt, không rút được nữa. */
  const [undoSos, setUndoSos] = useState<{ id: string; secondsLeft: number } | null>(null);

  const user = store.currentUser!;
  const userScope = user.geographicScope.name || "Hà Nội";

  // SOS/phản ánh của chính tài khoản đang đăng nhập (theo ownerUserId).
  const mySosList = store.sosRequests.filter((sos) => sos.ownerUserId === user.id);
  const myReports = store.citizenReports.filter((report) => report.ownerUserId === user.id);

  // Đếm ngược cửa sổ hoàn tác 5 giây.
  useEffect(() => {
    if (!undoSos) return;
    if (undoSos.secondsLeft <= 0) {
      setUndoSos(null);
      return;
    }
    const timer = window.setTimeout(
      () =>
        setUndoSos((current) =>
          current ? { ...current, secondsLeft: current.secondsLeft - 1 } : current,
        ),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [undoSos]);

  const flashFeedback = (message: string, ttl = 6000) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), ttl);
  };

  const handleUndoSos = () => {
    if (!undoSos) return;
    try {
      store.cancelOwnSos(undoSos.id);
      // Rút lại cả tín hiệu hoảng loạn vừa phát — trừ khi người dân đang bật
      // chế độ phát định vị thường xuyên (beacon) thì giữ nguyên để cứu hộ
      // vẫn thấy vị trí.
      if (localStorage.getItem("vndms_beacon_active") !== "true") {
        void removeLiveLocationPing(user.id, user.role);
      }
      setUndoSos(null);
      setCreatedSosId(null);
      flashFeedback(
        `Đã rút lại yêu cầu SOS ${undoSos.id}. Nếu vẫn cần cứu hộ, hãy gửi lại tín hiệu mới.`,
      );
    } catch (err) {
      flashFeedback(
        err instanceof Error
          ? err.message
          : "Không thể rút lại SOS này — vui lòng gọi đường dây nóng để được hỗ trợ.",
      );
    }
  };

  const openShelters = store.shelters.filter((s) => s.status === "Sẵn sàng" || s.status === "Đang tiếp nhận");
  // Công dân xem cảnh báo do cán bộ CÔNG BỐ (không phải cảnh báo tác nghiệp nội bộ)
  const activeAlerts = store.publishedAlerts
    .filter((alert) => alert.status === "Đã công bố")
    .slice(0, 4);

  const [weatherList, setWeatherList] = useState<StationForecast[]>([]);
  useEffect(() => {
    fetchEcmwfWeatherData()
      .then((data) => setWeatherList(data))
      .catch(() => {});
  }, []);

  const localWeather =
    weatherList.find((w) => userScope.toLowerCase().includes(w.stationName.split(" ")[0].toLowerCase())) ||
    weatherList[0];

  const handleRequestGps = () => {
    requestGps((ok, message) => flashFeedback(message, ok ? 5000 : 7000));
  };

  // SOS 1 chạm: CHỈ gửi khi có vị trí thật (GPS thiết bị hoặc điểm người dân đã chạm trên bản đồ)
  const handleOneClickSos = () => {
    const emitSos = (coords: [number, number], addrDetail: string, source: CitizenLocationSource) => {
      try {
        const id = store.createSos({
          reporter: {
            name: user.displayName,
            contact: user.phone || user.organization?.replace("SĐT: ", "") || "Chưa cập nhật",
            source: "Người dân",
          },
          location: {
            name: addrDetail,
            address: addrDetail,
            administrativeArea: userScope,
            coordinates: coords,
            accessCondition: "Tiếp cận bình thường",
            floodDepth: "Chưa đo",
          },
          description: `TÍN HIỆU SOS KHẨN CẤP 1 CHẠM: Công dân ${user.displayName} phát tín hiệu cứu hộ khẩn cấp từ thiết bị di động tại tọa độ [${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}]. Cần lực lượng ứng cứu ngay!`,
          peopleAtRisk: 1,
          elderlyCount: 0,
          childrenCount: 0,
          injuredCount: 0,
          missingCount: 0,
          disabledCount: 0,
          severity: "Đe dọa tính mạng",
          communicationStatus: "Kết nối",
          gpsCaptured: source === "gps",
        });

        // Đồng bộ tọa độ khẩn cấp vào Redis cho toàn hệ thống
        pushLiveLocationPing({
          id: user.id,
          type: "citizen",
          role: "citizen",
          name: user.displayName,
          coordinates: coords,
          phone: user.phone,
          status: "TÍN HIỆU SOS KHẨN CẤP",
          isPanicSOS: true,
          timestamp: Date.now(),
        });

        setCreatedSosId({ id, source });
        setLocation(coords, source);
        // SOS 1 chạm gửi ngay (không delay tình huống khẩn cấp), đồng thời mở
        // cửa sổ hoàn tác 5 giây phòng bấm nhầm.
        setUndoSos({ id, secondsLeft: 5 });
      } catch (err) {
        flashFeedback(err instanceof Error ? err.message : "Không thể gửi tín hiệu SOS.");
      }
    };

    // Không có GPS: dùng điểm người dân đã chạm trên bản đồ ở trang Bản đồ
    // tác nghiệp (nếu có); nếu không, mở biểu mẫu để nhập địa chỉ và chọn vị
    // trí — KHÔNG gửi tọa độ mặc định.
    const noGps = () => {
      if (gpsLocation && locationSource === "map") {
        emitSos(
          gpsLocation,
          `Vị trí người dân đánh dấu trên bản đồ: ${gpsLocation[1].toFixed(5)}, ${gpsLocation[0].toFixed(5)} (${userScope})`,
          "map",
        );
        return;
      }
      flashFeedback(
        "Không lấy được vị trí GPS nên chưa gửi SOS. Hãy cấp quyền định vị, hoặc sang mục Bản đồ tác nghiệp để đánh dấu vị trí rồi gửi qua biểu mẫu chi tiết.",
        7000,
      );
      setSosModalOpen(true);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          const address = `Vị trí GPS thiết bị: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (${userScope})`;
          emitSos(coords, address, "gps");
        },
        noGps,
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else {
      noGps();
    }
  };

  return (
    <div className="citizen-portal">
      {/* Hero Banner with 1-Click SOS Trigger */}
      <section className="citizen-hero-banner">
        <div className="citizen-hero-content">
          <div className="citizen-hero-badge">
            <ShieldCheck size={15} />
            <span>CỔNG THÔNG TIN PHÒNG CHỐNG THIÊN TAI DÀNH CHO CÔNG DÂN</span>
          </div>
          <h1>Xin chào, {user.displayName}!</h1>
          <p>
            Bạn đang kết nối với Hệ thống Giám sát & Ứng phó Thiên tai Quốc gia (VNDMS).
            Địa bàn đăng ký: <b>{userScope}</b>. Khi gặp nguy hiểm do bão lũ, chỉ cần <b>1 chạm</b> để gửi định vị cứu hộ.
          </p>
        </div>

        <div className="citizen-sos-actions-group">
          <button
            id="btn-one-click-sos"
            className="citizen-sos-trigger-btn"
            onClick={handleOneClickSos}
            disabled={locating}
            type="button"
            title="Gửi ngay tọa độ GPS và thông tin của bạn tới Ban chỉ huy & Đội cứu hộ gần nhất"
          >
            <Radio size={24} className={locating ? "animate-spin" : ""} />
            <span>{locating ? "ĐANG ĐỊNH VỊ GPS..." : "GỬI ĐỊNH VỊ SOS 1 CHẠM"}</span>
          </button>

          <button
            className="citizen-sos-form-trigger"
            onClick={() => setSosModalOpen(true)}
            type="button"
          >
            + Nhập chi tiết cứu hộ nâng cao
          </button>
        </div>
      </section>

      {/* Success Notification if SOS created */}
      {createdSosId && (
        <div className="admin-feedback-toast" style={{ backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
          <AlertCircle size={20} color="#dc2626" />
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: "14.5px" }}>ĐÃ GHI NHẬN YÊU CẦU SOS #{createdSosId.id} — TRẠNG THÁI: MỚI TIẾP NHẬN</b>
            <p style={{ margin: "3px 0 0", fontSize: "13px", lineHeight: "1.4" }}>
              {createdSosId.source === "gps"
                ? "Yêu cầu kèm tọa độ GPS từ thiết bị của bạn."
                : createdSosId.source === "map"
                  ? "Yêu cầu kèm vị trí bạn đã đánh dấu trên bản đồ (không phải GPS thiết bị)."
                  : "Yêu cầu chưa có tọa độ GPS; cán bộ sẽ xác định theo địa chỉ bạn cung cấp."}{" "}
              Cán bộ phòng chống thiên tai tại <b>{userScope}</b> sẽ xác minh và điều phối; theo dõi tiến trình tại mục “Yêu cầu của tôi”.
            </p>
            {undoSos && undoSos.id === createdSosId.id && undoSos.secondsLeft > 0 && (
              <div className="citizen-undo-bar" role="status" aria-live="polite">
                <Undo2 size={15} />
                <span className="citizen-undo-track" aria-hidden="true">
                  <i style={{ width: `${(undoSos.secondsLeft / 5) * 100}%` }} />
                </span>
                <span>
                  Gửi nhầm? Hoàn tác trong <b>{undoSos.secondsLeft}s</b>
                </span>
                <button type="button" onClick={handleUndoSos}>
                  Hoàn tác
                </button>
              </div>
            )}
          </div>
          <button onClick={() => { setCreatedSosId(null); setUndoSos(null); }}>
            <X size={16} />
          </button>
        </div>
      )}

      {feedback && (
        <div className="admin-feedback-toast">
          <Info size={16} />
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <section className="citizen-stats-grid">
        <div className="citizen-stat-card">
          <div className="citizen-stat-icon red">
            <Radio size={24} />
          </div>
          <div className="citizen-stat-info">
            <b>{mySosList.length + myReports.length}</b>
            <span>Yêu cầu của bạn</span>
          </div>
        </div>

        <div className="citizen-stat-card">
          <div className="citizen-stat-icon green">
            <Building2 size={24} />
          </div>
          <div className="citizen-stat-info">
            <b>{openShelters.length} / {store.shelters.length}</b>
            <span>Điểm sơ tán an toàn mở</span>
          </div>
        </div>

        <div className="citizen-stat-card">
          <div className="citizen-stat-icon amber">
            <AlertTriangle size={24} />
          </div>
          <div className="citizen-stat-info">
            <b>{store.publishedAlerts.filter((alert) => alert.status === "Đã công bố").length}</b>
            <span>Cảnh báo thiên tai đang công bố</span>
          </div>
        </div>

        <div className="citizen-stat-card">
          <div className="citizen-stat-icon blue">
            <LifeBuoy size={24} />
          </div>
          <div className="citizen-stat-info">
            <b>{store.incidents.filter((i) => i.status !== "Đã đóng").length}</b>
            <span>Khu vực ngập lụt / Sự cố</span>
          </div>
        </div>
      </section>

      {/* ECMWF Weather Status Strip */}
      {localWeather && (
        <div style={{
          background: "var(--surface-card, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "10px",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--tint-sky)",
              color: "var(--wx-rain-fg)",
              display: "grid",
              placeItems: "center",
            }}>
              <Waves size={18} />
            </span>
            <div>
              <b style={{ fontSize: "13.5px" }}>Dự báo khí tượng ECMWF — {localWeather.stationName}</b>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "var(--text-secondary, #64748b)" }}>
                Nhiệt độ: <b>{localWeather.current.temperature.toFixed(1)}°C</b> · Lượng mưa 24h: <b>{localWeather.current.precipitation.toFixed(1)} mm</b> · Gió giật: <b>{localWeather.current.windGusts.toFixed(0)} km/h</b> · Dòng chảy bề mặt: <b>{localWeather.current.runoff.toFixed(2)} mm</b>
              </p>
            </div>
          </div>
          <Badge tone={localWeather.dailySummary[0]?.floodRiskLevel === "Đặc biệt nghiêm trọng" ? "red" : localWeather.dailySummary[0]?.floodRiskLevel === "Nguy cơ cao" ? "amber" : "green"}>
            Nguy cơ: {localWeather.dailySummary[0]?.floodRiskLevel || "Bình thường"}
          </Badge>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="citizen-main-layout">
        {/* Left Column */}
        <div className="citizen-main-col">
          {/* Active Alerts */}
          <div className="citizen-section-card">
            <div className="citizen-card-header">
              <h2>
                <AlertTriangle size={18} color="#d97706" />
                Cảnh báo thiên tai trong khu vực
              </h2>
              <small>{activeAlerts.length} bản tin đang công bố</small>
            </div>
            <div className="citizen-alert-list">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`citizen-alert-item ${
                    alert.severity === "critical"
                      ? "critical"
                      : alert.severity === "high"
                        ? "warning"
                        : "info"
                  }`}
                >
                  <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4>{alert.title}</h4>
                    <p>{alert.content}</p>
                    <small>
                      Khu vực: <b>{alert.areaName}</b> · Công bố: {alert.publishedAt ?? alert.updatedAt}
                      {alert.revision > 1 ? ` · bản cập nhật ${alert.revision}` : ""}
                    </small>
                  </div>
                </div>
              ))}
              {!activeAlerts.length && (
                <p style={{ color: "var(--muted)", padding: "16px 20px", margin: 0 }}>
                  Hiện tại không có cảnh báo nguy hiểm khẩn cấp nào trên địa bàn.
                </p>
              )}
            </div>
          </div>

          {/* Shelters Lookup */}
          <div className="citizen-section-card">
            <div className="citizen-card-header">
              <h2>
                <Building2 size={18} color="#2563eb" />
                Điểm sơ tán an toàn gần bạn ({openShelters.length} điểm đang mở)
              </h2>
            </div>
            <div className="citizen-shelter-grid">
              {openShelters.map((shelter) => {
                const available = shelter.capacity - shelter.currentOccupancy;
                return (
                  <div key={shelter.id} className="citizen-shelter-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h4>{shelter.name}</h4>
                      <Badge tone="green">{shelter.status}</Badge>
                    </div>
                    <p>
                      <MapPin size={13} /> {shelter.address}
                    </p>
                    <div className="citizen-shelter-capacity">
                      Sức chứa: <b>{shelter.currentOccupancy} / {shelter.capacity} người</b>
                      <span style={{ display: "block", color: "#16a34a", fontWeight: "600", marginTop: "2px" }}>
                        (Còn trống: {available > 0 ? available : 0} chỗ)
                      </span>
                    </div>
                    {shelter.responsibleOfficer && (
                      <small style={{ color: "var(--muted)", marginTop: "4px" }}>
                        Quản lý: {shelter.responsibleOfficer.name} ({shelter.responsibleOfficer.phone})
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="citizen-side-col">
          {/* Emergency Hotline Numbers */}
          <div className="citizen-section-card">
            <div className="citizen-card-header">
              <h2>
                <PhoneCall size={18} color="#dc2626" />
                Đường dây nóng khẩn cấp
              </h2>
            </div>
            <div className="citizen-hotline-grid">
              <a href="tel:114" className="citizen-hotline-item">
                <span className="hotline-num">114</span>
                <span className="hotline-label">Cứu nạn cứu hộ PCCC</span>
              </a>
              <a href="tel:115" className="citizen-hotline-item">
                <span className="hotline-num">115</span>
                <span className="hotline-label">Cấp cứu y tế</span>
              </a>
              <a href="tel:112" className="citizen-hotline-item">
                <span className="hotline-num">112</span>
                <span className="hotline-label">Yêu cầu trợ giúp cứu nạn</span>
              </a>
              <a href="tel:18001091" className="citizen-hotline-item">
                <span className="hotline-num">1800</span>
                <span className="hotline-label">Tổng đài PCTT Quốc gia</span>
              </a>
            </div>
          </div>

          {/* Survival Guidelines */}
          <div className="citizen-section-card">
            <div className="citizen-card-header">
              <h2>
                <HelpCircle size={18} color="#16a34a" />
                Cẩm nang ứng phó thiên tai
              </h2>
            </div>
            <div className="citizen-guide-list">
              <div className="citizen-guide-item">
                <div className="citizen-guide-icon">
                  <Package size={16} />
                </div>
                <div className="citizen-guide-content">
                  <h5>Chuẩn bị túi cứu hộ 72 giờ</h5>
                  <p>Chuẩn bị sẵn nước sạch, đồ hộp, đèn pin, sạc dự phòng, thuốc thiết yếu và giấy tờ tùy thân trong túi chống nước.</p>
                </div>
              </div>

              <div className="citizen-guide-item">
                <div className="citizen-guide-icon">
                  <Waves size={16} />
                </div>
                <div className="citizen-guide-content">
                  <h5>Khi nước lũ tràn vào nhà</h5>
                  <p>Ngắt cầu dao điện chính ngay lập tức. Di chuyển người già và trẻ nhỏ lên tầng cao hoặc đến điểm sơ tán an toàn.</p>
                </div>
              </div>

              <div className="citizen-guide-item">
                <div className="citizen-guide-icon">
                  <LifeBuoy size={16} />
                </div>
                <div className="citizen-guide-content">
                  <h5>Kỹ năng khi bị cô lập</h5>
                  <p>Dùng vải sáng màu hoặc đèn pin phát tín hiệu cầu cứu SOS. Tuyệt đối không lội qua dòng nước chảy xiết.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced SOS Form Modal */}
      {sosModalOpen && (
        <SosCreationModal
          location={gpsLocation}
          locationSource={locationSource}
          onRequestGps={handleRequestGps}
          onClose={() => setSosModalOpen(false)}
          onSuccess={(id) => {
            setSosModalOpen(false);
            setCreatedSosId({ id, source: locationSource });
          }}
        />
      )}
    </div>
  );
}
