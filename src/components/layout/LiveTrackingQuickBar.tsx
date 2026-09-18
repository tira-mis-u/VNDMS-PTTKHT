import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Radio,
  Undo2,
  WifiOff,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  pushLiveLocationPing,
  removeLiveLocationPing,
  type LiveLocationPing,
} from "@/infrastructure/redis/redisClient";
import { BeaconScopeModal, type BeaconCandidate } from "./BeaconScopeModal";
import { loadBeaconAcl, saveBeaconAcl } from "./beaconAcl";
import { roleLabels } from "@/domain/auth/labels";

export function LiveTrackingQuickBar() {
  const { currentUser, createSos, recordSecurityAudit, cancelOwnSos, users } =
    useOperationalState();
  const [isBeaconActive, setIsBeaconActive] = useState(() => {
    return localStorage.getItem("vndms_beacon_active") === "true";
  });
  const [lastCoords, setLastCoords] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosSentSuccess, setSosSentSuccess] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  /**
   * Cửa sổ hoàn tác 5 giây sau phát tín hiệu SOS — phòng bấm nhầm.
   * Lưu kèm trạng thái beacon trước khi gửi + tọa độ đã gửi để khi hoàn tác
   * có thể khôi phục đúng hiện trạng (tắt beacon nếu trước đó đang tắt, xoá
   * hoặc thay thế ping hoảng loạn trên bản đồ).
   */
  const [undoSos, setUndoSos] = useState<{
    id: string;
    secondsLeft: number;
    beaconWasOn: boolean;
    coords: [number, number];
  } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  /** Gương ref của tọa độ mới nhất để heartbeat luôn gửi vị trí tươi (tránh closure cũ). */
  const lastCoordsRef = useRef<[number, number] | null>(null);

  /**
   * Ứng viên được chia sẻ định vị — PHÂN BIỆT THEO VAI TRÒ NGƯỜI PHÁT:
   * - 3 vai tác nghiệp (cứu hộ, cán bộ, quản trị): phát được cho TẤT CẢ mọi
   *   người (kể cả công dân) — tick nhanh cả nhóm vai trò hoặc chọn từng người.
   * - Công dân: chọn được TỪNG NGƯỜI cụ thể (mọi vai, kể cả công dân khác)
   *   hoặc chọn nhanh theo vai trò CHỈ 2 nhóm Cán bộ PCTT / Đơn vị cứu hộ
   *   (KHÔNG có lựa chọn "Tất cả công dân" — tránh loạn bản đồ).
   */
  const candidates: BeaconCandidate[] = useMemo(() => {
    if (!currentUser) return [];
    return users
      .filter((account) => account.active && account.id !== currentUser.id)
      .map((account) => ({
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        detail: account.organization ?? "",
        role: account.role,
        roleLabel: roleLabels[account.role] ?? account.role,
      }));
  }, [users, currentUser]);

  // Hiển thị thông báo tạm — hẹn giờ cũ bị huỷ để không xoá nhầm tin mới hơn.
  const flashMessage = (msg: string) => {
    setStatusMessage(msg);
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

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

  const handleUndoSos = () => {
    if (!undoSos || !currentUser) return;
    try {
      cancelOwnSos(undoSos.id);
      if (undoSos.beaconWasOn) {
        // Beacon đã bật từ trước: phát lại ping thường (xoá cờ hoảng loạn)
        // để vị trí realtime của người dùng không bị mất trên bản đồ.
        void pushLiveLocationPing({
          id: currentUser.id,
          type:
            currentUser.role === "citizen"
              ? "citizen"
              : currentUser.role === "rescue_unit"
                ? "team"
                : "personnel",
          role: currentUser.role,
          name: currentUser.displayName,
          coordinates: undoSos.coords,
          phone: currentUser.phone,
          status: "Đang hoạt động",
          isPanicSOS: false,
          visibleTo: loadBeaconAcl(currentUser.id),
          timestamp: Date.now(),
        });
      } else {
        // Beacon do lần phát SOS này tự bật → tắt lại (effect cleanup sẽ
        // xoá luôn ping hoảng loạn khỏi bản đồ).
        setIsBeaconActive(false);
      }
      setUndoSos(null);
      setSosSentSuccess(false);
      flashMessage(`Đã rút lại tín hiệu SOS ${undoSos.id}.`);
    } catch (err) {
      flashMessage(err instanceof Error ? err.message : "Không thể rút lại tín hiệu này.");
    }
  };

  // 1. Chức năng Phát tín hiệu định vị Realtime (Live Beacon)
  useEffect(() => {
    if (!currentUser) return;

    const sendBeacon = (coords: [number, number], speed?: number, heading?: number) => {
      setLastCoords(coords);
      lastCoordsRef.current = coords;
      const ping: LiveLocationPing = {
        id: currentUser.id,
        type:
          currentUser.role === "citizen"
            ? "citizen"
            : currentUser.role === "rescue_unit"
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
        visibleTo: loadBeaconAcl(currentUser.id),
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
          (err) => {
            // KHÔNG phát tọa độ mặc định: không có GPS thì không có vị trí nào được gửi.
            console.warn("[LiveBeacon] Không lấy được vị trí:", err.message);
            flashMessage("Chưa lấy được vị trí GPS — hãy cấp quyền định vị để phát tín hiệu.");
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
        if (lastCoordsRef.current) {
          sendBeacon(lastCoordsRef.current);
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

  /** Bấm "Phát định vị" → mở modal chọn ai được thấy (không bật/tắt thẳng). */
  const openScopeModal = () => setScopeModalOpen(true);

  const handleScopeSave = (scope: string[] | null) => {
    if (!currentUser) return;
    saveBeaconAcl(currentUser.id, scope);
    setScopeModalOpen(false);
    if (!isBeaconActive) {
      setIsBeaconActive(true);
      flashMessage(
        scope === null
          ? "Đã BẬT phát tín hiệu định vị Realtime. Vị trí của bạn đang được truyền lên hệ thống."
          : `Đã BẬT phát định vị — chỉ ${scope.length} người được chỉ định thấy vị trí của bạn.`,
      );
      recordSecurityAudit(
        "LIVE_BEACON_TOGGLED",
        `Tài khoản ${currentUser.displayName} (@${currentUser.username}) đã BẬT phát định vị Realtime (GPS Beacon)${scope === null ? "" : `, giới hạn ${scope.length} người được thấy`}.`,
        "LiveBeacon",
        currentUser.id,
      );
    } else {
      flashMessage(
        scope === null
          ? "Đã cập nhật: mọi cán bộ được phân quyền đều thấy định vị của bạn."
          : `Đã cập nhật phạm vi chia sẻ: ${scope.length} người được thấy định vị của bạn.`,
      );
    }
  };

  const handleScopeTurnOff = () => {
    setScopeModalOpen(false);
    setIsBeaconActive(false);
    flashMessage("Đã TẮT phát tín hiệu định vị.");
    recordSecurityAudit(
      "LIVE_BEACON_TOGGLED",
      `Tài khoản ${currentUser?.displayName} (@${currentUser?.username}) đã TẮT phát định vị Realtime.`,
      "LiveBeacon",
      currentUser?.id,
    );
  };

  // 2. Chức năng PHÁT TÍN HIỆU SOS (SOS Panic)
  const triggerOneTouchAlert = async () => {
    if (!currentUser || sosBusy) return;
    // Vừa phát xong mà bấm nữa trong cửa sổ hoàn tác → nhắc dùng Hoàn tác
    // thay vì tạo thêm phiếu SOS trùng.
    if (undoSos && undoSos.secondsLeft > 0) {
      flashMessage(
        `Bạn vừa phát tín hiệu SOS ${undoSos.id}. Nếu bấm nhầm, hãy dùng nút Hoàn tác bên dưới.`,
      );
      return;
    }
    // Ghi nhận trạng thái beacon TRƯỚC khi gửi để hoàn tác/thất bại khôi phục đúng.
    const beaconWasOn = isBeaconActive;

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
              : currentUser.role === "rescue_unit"
              ? "team"
              : "personnel",
          role: currentUser.role,
          name: currentUser.displayName,
          coordinates: coords,
          phone: currentUser.phone,
          status: "TÍN HIỆU SOS KHẨN CẤP",
          isPanicSOS: true,
          timestamp: Date.now(),
        };
        await pushLiveLocationPing(ping);

        // Tự động kích hoạt hệ thống cứu nạn SOS chính thức
        const addr = `Tọa độ GPS khẩn cấp: ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)} (${currentUser.geographicScope.name})`;
        const sosId = await createSos(
          {
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
            gpsCaptured: true,
          },
          // Component tự ghi dòng PANIC_ALERT_TRIGGERED bên dưới → store bỏ
          // dòng generic để MỘT lần bấm SOS = MỘT dòng nhật ký + MỘT thông báo.
          { securityAudited: true },
        );

        // Ghi nhật ký bảo mật hệ thống: tài khoản nào đã phát tín hiệu SOS
        recordSecurityAudit(
          "PANIC_ALERT_TRIGGERED",
          `Tài khoản ${currentUser.displayName} (@${currentUser.username}, vai trò: ${currentUser.role}) đã PHÁT TÍN HIỆU SOS (SOS Panic) tại tọa độ [${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}]. Phiếu cứu nạn: ${sosId}.`,
          "EmergencyAlert",
          sosId,
        );

        // Tự động bật luôn chế độ phát live beacon để cứu hộ dễ tìm.
        // Tình huống khẩn cấp nên ping SOS luôn hiển thị với mọi lực lượng
        // được phân quyền (không áp dụng giới hạn chia sẻ của beacon thường).
        setIsBeaconActive(true);
        setSosSentSuccess(true);
        // Gửi ngay (không delay tình huống khẩn cấp) + cửa sổ hoàn tác 5 giây.
        setUndoSos({ id: sosId, secondsLeft: 5, beaconWasOn, coords });
        flashMessage(`Đã tạo SOS ${sosId} với vị trí GPS của thiết bị và bật phát định vị. Yêu cầu đang chờ cán bộ tiếp nhận.`);
        setTimeout(() => setSosSentSuccess(false), 8000);
      } catch (err) {
        // Tạo phiếu thất bại nhưng ping hoảng loạn đã gửi → dọn để bản đồ
        // không còn điểm SOS mồ côi (chỉ dọn khi beacon vốn đang tắt).
        if (!beaconWasOn) void removeLiveLocationPing(currentUser.id, currentUser.role);
        flashMessage("Lỗi khi phát tín hiệu SOS: " + (err instanceof Error ? err.message : "Thất bại"));
      } finally {
        setSosBusy(false);
        setLocating(false);
      }
    };

    // Không bao giờ dùng tọa độ mặc định: SOS 1 chạm chỉ gửi khi có vị trí thật
    // từ thiết bị (hiện tại hoặc vị trí GPS gần nhất đã lấy được trong phiên).
    const noGps = () => {
      if (lastCoords) {
        executeSosPush(lastCoords);
        return;
      }
      setSosBusy(false);
      setLocating(false);
      flashMessage(
        "Không lấy được vị trí GPS nên chưa gửi SOS. Hãy cấp quyền định vị rồi bấm lại, hoặc gửi SOS kèm địa chỉ trong biểu mẫu SOS.",
      );
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          executeSosPush([pos.coords.longitude, pos.coords.latitude]);
        },
        noGps,
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      noGps();
    }
  };

  if (!currentUser) return null;

  return (
    <>
      <div className="live-tracking-quickbar">
        {/* Nút 1: Phát tín hiệu SOS */}
        <button
          id="btn-one-touch-alert"
          type="button"
          className={`quick-action-btn sos-panic-btn ${sosSentSuccess ? "sent-success" : ""}`}
          onClick={triggerOneTouchAlert}
          disabled={sosBusy}
          title="Phát tín hiệu SOS khẩn cấp (SOS Panic) — Phát tín hiệu cứu nạn tức thời tới Trung tâm chỉ huy"
        >
          {sosBusy || locating ? (
            <Loader2 size={16} className="spin-icon" />
          ) : sosSentSuccess ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} className="panic-pulse-icon" />
          )}
          <span className="btn-label">
            {sosBusy ? "Đang phát SOS…" : sosSentSuccess ? "Đã gửi SOS!" : "Phát tín hiệu SOS"}
          </span>
        </button>

        {/* Nút 2: Bật/Tắt phát tín hiệu định vị Realtime */}
        <button
          id="btn-toggle-live-beacon"
          type="button"
          className={`quick-action-btn live-beacon-btn ${isBeaconActive ? "active" : "inactive"}`}
          onClick={openScopeModal}
          title={
            isBeaconActive
              ? "Đang phát định vị — bấm để đổi phạm vi chia sẻ hoặc tắt"
              : "Bật phát định vị — chọn ai được thấy vị trí của bạn"
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
          title="Phân biệt Phát tín hiệu SOS và Phát định vị"
        >
          <HelpCircle size={15} />
        </button>
      </div>

      {/* Thông báo Toast nhanh */}
      {statusMessage && (
        <div className="tracking-toast-msg" role="status">
          <span>{statusMessage}</span>
          {undoSos && undoSos.secondsLeft > 0 && (
            <button
              type="button"
              className="tracking-toast-undo"
              onClick={handleUndoSos}
              title={`Rút lại cảnh báo ${undoSos.id} (còn ${undoSos.secondsLeft} giây)`}
            >
              <Undo2 size={13} />
              Hoàn tác ({undoSos.secondsLeft}s)
            </button>
          )}
          <button type="button" onClick={() => { setStatusMessage(null); setUndoSos(null); }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modal hướng dẫn phân biệt rõ rệt */}
      {scopeModalOpen && currentUser && (
        <BeaconScopeModal
          isActive={isBeaconActive}
          initialScope={loadBeaconAcl(currentUser.id)}
          candidates={candidates}
          quickSelectRoles={
            currentUser.role === "citizen"
              ? ["disaster_officer", "rescue_unit"]
              : undefined
          }
          onSave={handleScopeSave}
          onTurnOff={handleScopeTurnOff}
          onClose={() => setScopeModalOpen(false)}
        />
      )}

      {infoModalOpen && (
        <div className="tracking-modal-backdrop" onClick={() => setInfoModalOpen(false)}>
          <div className="tracking-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="tracking-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Radio size={20} color="#2563eb" />
                <h3>Phân biệt: Phát tín hiệu SOS vs. Phát định vị Realtime</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setInfoModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="tracking-modal-body">
              <div className="mode-explain-card panic">
                <div className="mode-explain-title">
                  <AlertTriangle size={20} color="#dc2626" />
                  <h4>1. Phát tín hiệu SOS (SOS Panic)</h4>
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
                  <li>Chọn ai được thấy: mọi cán bộ được phân quyền, hoặc chỉ những người bạn chỉ định.</li>
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
