import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Radio,
  WifiOff,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  pushLiveLocationPing,
  removeLiveLocationPing,
  type LiveLocationPing,
} from "@/infrastructure/redis/redisClient";

export function LiveTrackingQuickBar() {
  const { currentUser, createSos, recordSecurityAudit } = useOperationalState();
  const [isBeaconActive, setIsBeaconActive] = useState(() => {
    return localStorage.getItem("vndms_beacon_active") === "true";
  });
  const [lastCoords, setLastCoords] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosSentSuccess, setSosSentSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  // Hiển thị thông báo tạm
  const flashMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // 1. Chức năng Phát tín hiệu định vị Realtime (Live Beacon)
  useEffect(() => {
    if (!currentUser) return;

    const sendBeacon = (coords: [number, number], speed?: number, heading?: number) => {
      setLastCoords(coords);
      const ping: LiveLocationPing = {
        id: currentUser.id,
        type:
          currentUser.role === "citizen"
            ? "citizen"
            : currentUser.teamId
            ? "team"
            : "personnel",
        role: currentUser.role,
        name: currentUser.displayName,
        coordinates: coords,
        phone: currentUser.phone,
        status: "Đang hoạt động",
        speed,
        heading,
        isPanicSOS: false,
        timestamp: Date.now(),
      };
      pushLiveLocationPing(ping);
    };

    if (isBeaconActive) {
      localStorage.setItem("vndms_beacon_active", "true");

      if ("geolocation" in navigator) {
        // Lấy vị trí ngay lập tức
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            sendBeacon(
              [pos.coords.longitude, pos.coords.latitude],
              pos.coords.speed || undefined,
              pos.coords.heading || undefined
            );
          },
          () => {
            // Fallback vị trí mặc định nếu chưa bật quyền
            const fallback: [number, number] = [105.852, 21.052];
            sendBeacon(fallback);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );

        // Theo dõi di chuyển realtime
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            sendBeacon(
              [pos.coords.longitude, pos.coords.latitude],
              pos.coords.speed || undefined,
              pos.coords.heading || undefined
            );
          },
          (err) => {
            console.warn("[LiveBeacon] WatchPosition error:", err.message);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }

      // Heartbeat định kỳ gửi mỗi 15 giây để duy trì trạng thái online
      intervalIdRef.current = window.setInterval(() => {
        if (lastCoords) {
          sendBeacon(lastCoords);
        } else if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
            sendBeacon([pos.coords.longitude, pos.coords.latitude]);
          });
        }
      }, 15000);
    } else {
      localStorage.setItem("vndms_beacon_active", "false");
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      removeLiveLocationPing(currentUser.id, currentUser.role);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current);
      }
    };
  }, [isBeaconActive, currentUser]);

  const toggleBeacon = () => {
    const next = !isBeaconActive;
    setIsBeaconActive(next);
    if (next) {
      flashMessage("Đã BẬT phát tín hiệu định vị Realtime. Vị trí của bạn đang được truyền lên hệ thống.");
      recordSecurityAudit(
        "LIVE_BEACON_TOGGLED",
        `Tài khoản ${currentUser?.displayName} (@${currentUser?.username}) đã BẬT phát định vị Realtime (GPS Beacon).`,
        "LiveBeacon",
        currentUser?.id,
      );
    } else {
      flashMessage("Đã TẮT phát tín hiệu định vị.");
      recordSecurityAudit(
        "LIVE_BEACON_TOGGLED",
        `Tài khoản ${currentUser?.displayName} (@${currentUser?.username}) đã TẮT phát định vị Realtime.`,
        "LiveBeacon",
        currentUser?.id,
      );
    }
  };

  // 2. Chức năng CẢNH BÁO 1 CHẠM (SOS Panic)
  const triggerOneTouchAlert = async () => {
    if (!currentUser || sosBusy) return;

    setSosBusy(true);
    setLocating(true);

    const executeSosPush = async (coords: [number, number]) => {
      try {
        // Gửi ping SOS khẩn cấp vào Redis
        const ping: LiveLocationPing = {
          id: currentUser.id,
          type:
            currentUser.role === "citizen"
              ? "citizen"
              : currentUser.teamId
              ? "team"
              : "personnel",
          role: currentUser.role,
          name: currentUser.displayName,
          coordinates: coords,
          phone: currentUser.phone,
          status: "CẢNH BÁO KHẨN CẤP (1-CHẠM)",
          isPanicSOS: true,
          timestamp: Date.now(),
        };
        await pushLiveLocationPing(ping);

        // Tự động kích hoạt hệ thống cứu nạn SOS chính thức
        const addr = `Tọa độ GPS khẩn cấp: ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)} (${currentUser.geographicScope.name})`;
        const sosId = await createSos({
          reporter: {
            name: currentUser.displayName,
            contact: currentUser.phone || "Liên hệ qua hệ sinh thái VNDMS",
            source: currentUser.role === "citizen" ? "Người dân" : "Thiết bị cảnh báo",
          },
          location: {
            name: `Vị trí khẩn cấp của ${currentUser.displayName}`,
            address: addr,
            administrativeArea: currentUser.geographicScope.name,
            coordinates: coords,
            accessCondition: "Tiếp cận bình thường",
            floodDepth: "Chưa đo",
          },
          description: `[BÁO ĐỘNG 1 CHẠM] ${currentUser.displayName} (${currentUser.phone || "Không có SĐT"}) kích hoạt tín hiệu khẩn cấp tại tọa độ [${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}].`,
          peopleAtRisk: 1,
          injuredCount: 0,
          missingCount: 0,
          childrenCount: 0,
          elderlyCount: 0,
          disabledCount: 0,
          severity: "Đe dọa tính mạng",
          communicationStatus: "Kết nối",
        });

        // Ghi nhật ký bảo mật hệ thống: tài khoản nào đã bật cảnh báo 1 chạm
        recordSecurityAudit(
          "PANIC_ALERT_TRIGGERED",
          `Tài khoản ${currentUser.displayName} (@${currentUser.username}, vai trò: ${currentUser.role}) đã KÍCH HOẠT CẢNH BÁO 1 CHẠM (SOS Panic) tại tọa độ [${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}]. Phiếu cứu nạn: ${sosId}.`,
          "EmergencyAlert",
          sosId,
        );

        // Tự động bật luôn chế độ phát live beacon để cứu hộ dễ tìm
        setIsBeaconActive(true);
        setSosSentSuccess(true);
        flashMessage(" ĐÃ PHÁT TÍN HIỆU CẢNH BÁO 1 CHẠM! Đội cứu hộ và Trung tâm chỉ huy đã nhận vị trí.");
        setTimeout(() => setSosSentSuccess(false), 8000);
      } catch (err) {
        flashMessage("Lỗi khi gửi cảnh báo 1 chạm: " + (err instanceof Error ? err.message : "Thất bại"));
      } finally {
        setSosBusy(false);
        setLocating(false);
      }
    };

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          executeSosPush([pos.coords.longitude, pos.coords.latitude]);
        },
        () => {
          // Nếu không lấy được GPS ngay lập tức, dùng vị trí trước đó hoặc mặc định
          const fallback = lastCoords || [105.852, 21.052];
          executeSosPush(fallback as [number, number]);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const fallback = lastCoords || [105.852, 21.052];
      executeSosPush(fallback as [number, number]);
    }
  };

  if (!currentUser) return null;

  return (
    <>
      <div className="live-tracking-quickbar">
        {/* Nút 1: Báo động 1 chạm */}
        <button
          id="btn-one-touch-alert"
          type="button"
          className={`quick-action-btn sos-panic-btn ${sosSentSuccess ? "sent-success" : ""}`}
          onClick={triggerOneTouchAlert}
          disabled={sosBusy}
          title="Báo động khẩn cấp 1 chạm (SOS Panic) — Phát tín hiệu cứu nạn tức thời tới Trung tâm chỉ huy"
        >
          {sosBusy || locating ? (
            <Loader2 size={16} className="spin-icon" />
          ) : sosSentSuccess ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} className="panic-pulse-icon" />
          )}
          <span className="btn-label">
            {sosBusy ? "Đang phát SOS…" : sosSentSuccess ? "Đã gửi SOS!" : "Cảnh báo 1 chạm"}
          </span>
        </button>

        {/* Nút 2: Bật/Tắt phát tín hiệu định vị Realtime */}
        <button
          id="btn-toggle-live-beacon"
          type="button"
          className={`quick-action-btn live-beacon-btn ${isBeaconActive ? "active" : "inactive"}`}
          onClick={toggleBeacon}
          title={
            isBeaconActive
              ? "Đang phát tín hiệu định vị Realtime (Bấm để tắt)"
              : "Bật phát tín hiệu định vị Realtime (Truyền vị trí liên tục lên bản đồ tác chiến)"
          }
        >
          {isBeaconActive ? (
            <>
              <span className="beacon-radar-ping" />
              <Radio size={16} className="beacon-active-icon" />
              <span className="btn-label">Đang phát GPS</span>
            </>
          ) : (
            <>
              <WifiOff size={16} />
              <span className="btn-label">Phát định vị</span>
            </>
          )}
        </button>

        {/* Nút trợ giúp phân biệt */}
        <button
          type="button"
          className="quick-action-btn helper-btn"
          onClick={() => setInfoModalOpen(true)}
          title="Phân biệt Cảnh báo 1 chạm và Phát tín hiệu định vị"
        >
          <HelpCircle size={15} />
        </button>
      </div>

      {/* Thông báo Toast nhanh */}
      {statusMessage && (
        <div className="tracking-toast-msg" role="status">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modal hướng dẫn phân biệt rõ rệt */}
      {infoModalOpen && (
        <div className="tracking-modal-backdrop" onClick={() => setInfoModalOpen(false)}>
          <div className="tracking-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="tracking-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Radio size={20} color="#2563eb" />
                <h3>Phân biệt: Báo động 1 chạm vs. Phát tín hiệu Realtime</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setInfoModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="tracking-modal-body">
              <div className="mode-explain-card panic">
                <div className="mode-explain-title">
                  <AlertTriangle size={20} color="#dc2626" />
                  <h4>1. Cảnh báo 1 chạm (SOS Panic)</h4>
                </div>
                <p>
                  Dành cho tình huống <b>nguy cấp, cần cứu nạn khẩn</b> (mắc kẹt do lũ quét, sự cố sạt lở đe dọa tính mạng).
                </p>
                <ul>
                  <li>Nhấn 1 chạm duy nhất: hệ thống tự động chốt tọa độ GPS hiện tại.</li>
                  <li>Tạo phiếu cứu nạn SOS ưu tiên cao nhất trên hệ thống toàn quốc.</li>
                  <li>Gửi cảnh báo chuông reo tới Trung tâm chỉ huy và Đội cứu hộ gần nhất.</li>
                </ul>
              </div>

              <div className="mode-explain-card beacon">
                <div className="mode-explain-title">
                  <Radio size={20} color="#16a34a" />
                  <h4>2. Phát tín hiệu định vị Realtime (Live GPS Beacon)</h4>
                </div>
                <p>
                  Dành cho chế độ <b>giám sát hành trình, phối hợp tác chiến liên tục</b>.
                </p>
                <ul>
                  <li>Bật nút gạt: vị trí GPS được truyền liên tục theo thời gian thực vào Redis.</li>
                  <li>Hiển thị biểu tượng di chuyển trực tiếp trên Bản đồ tác nghiệp thống nhất.</li>
                  <li>Thích hợp cho Chỉ huy điều phối, Đội viên cơ động thực địa và Công dân đang di chuyển sơ tán.</li>
                </ul>
              </div>
            </div>

            <footer className="tracking-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setInfoModalOpen(false)}
                style={{ padding: "8px 20px" }}
              >
                Đã hiểu
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
