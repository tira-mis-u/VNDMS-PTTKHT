import { useEffect, useRef, useState, type FormEvent } from "react";
import { Map as MapLibreMap, Marker, Popup, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Compass,
  HelpCircle,
  Info,
  LifeBuoy,
  LocateFixed,
  MapPin,
  Package,
  PhoneCall,
  Radio,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  Waves,
  X,
} from "lucide-react";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge, Button, Input, Textarea, DialogBackdrop } from "@/components/ui";
import { Select as UiSelect } from "@/components/ui/Select";
import {
  getNdaMapBaseStyle,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  fetchEcmwfWeatherData,
  type StationForecast,
} from "@/infrastructure/weather/ecmwfWeatherService";
import type { SosSeverity } from "@/domain/sos/types";

/* ─────────────── Citizen Interactive Map Component (Google Maps + Fallback) ─────────────── */
function CitizenLiveMap({
  userLocation,
  shelters,
  incidents,
  sosList,
  onPickLocation,
}: {
  userLocation: [number, number] | null;
  shelters: Array<{ id: string; name: string; coordinates: [number, number]; capacity: number; currentOccupancy: number }>;
  incidents: Array<{ id: string; title: string; location: { coordinates: [number, number] } }>;
  sosList: Array<{ id: string; description: string; location: { coordinates: [number, number]; address: string }; status: string }>;
  onPickLocation?: (coords: [number, number]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  // References for MapLibre
  const mlMapRef = useRef<MapLibreMap | null>(null);
  const mlMarkersRef = useRef<Marker[]>([]);

  // Initialize MapLibre map — dùng thẳng không qua Google Maps (không có AIzaSy key)
  useEffect(() => {
    if (!containerRef.current || mlMapRef.current) return;
    const initialCenter = userLocation || [105.852, 21.052];

    const map = new MapLibreMap({
      container: containerRef.current,
      style: getNdaMapBaseStyle(
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      ),
      center: initialCenter,
      zoom: 6.5,
      minZoom: 5.2,
      maxZoom: 19,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: true }), "top-right");

    const czWeatherPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: "ecmwf-hover-popup",
    });

    map.on("load", () => {
      // Thêm source/layer GeoJSON rỗng — sẽ được cập nhật khi weatherList load
      map.addSource("cz-weather", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "cz-weather-hitbox",
        type: "circle",
        source: "cz-weather",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 34,
            7, 52,
            10, 75,
          ],
          "circle-color": "#2563eb",
          "circle-opacity": 0.001,
        },
      });

      map.on("mousemove", "cz-weather-hitbox", (e) => {
        const feat = e.features?.[0];
        const stationId = feat?.properties?.stationId;
        if (!stationId) return;

        const st = weatherListRef.current.find((s) => s.stationId === stationId);
        if (!st) return;

        map.getCanvas().style.cursor = "pointer";

        const currentRisk = st.dailySummary?.[0]?.floodRiskLevel || "Bình thường";
        const riskColor =
          currentRisk === "Đặc biệt nghiêm trọng"
            ? "#ef4444"
            : currentRisk === "Nguy cơ cao"
            ? "#f97316"
            : currentRisk === "Cảnh báo"
            ? "#eab308"
            : "#22c55e";

        czWeatherPopup.setLngLat(e.lngLat).setHTML(`
          <div class="weather-hover-card">
            <div class="weather-hover-head">
              <span class="weather-hover-title">${st.stationName}</span>
              <span class="weather-hover-region">Vùng ${st.region}</span>
            </div>
            <div class="weather-hover-grid">
              <div class="weather-hover-cell">
                <span class="weather-hover-cell-lbl">Nhiệt độ</span>
                <span class="weather-hover-cell-val" style="color:#f87171;">${st.current.temperature.toFixed(1)}°C</span>
              </div>
              <div class="weather-hover-cell">
                <span class="weather-hover-cell-lbl">Lượng mưa</span>
                <span class="weather-hover-cell-val" style="color:#38bdf8;">${st.current.rain.toFixed(1)} mm/h</span>
              </div>
              <div class="weather-hover-cell">
                <span class="weather-hover-cell-lbl">Gió & giật</span>
                <span class="weather-hover-cell-val" style="color:#e2e8f0;">${st.current.windSpeed.toFixed(0)} (${st.current.windGusts.toFixed(0)}) km/h</span>
              </div>
              <div class="weather-hover-cell">
                <span class="weather-hover-cell-lbl">Nguy cơ lũ</span>
                <span class="weather-hover-cell-val" style="color:${riskColor};">${currentRisk}</span>
              </div>
            </div>
          </div>
        `).addTo(map);
      });

      map.on("mouseleave", "cz-weather-hitbox", () => {
        map.getCanvas().style.cursor = "";
        czWeatherPopup.remove();
      });

      applyVietnameseMapLabels(map);
      setMapReady(true);
    });


    map.on("error", (e) => {
      console.warn("[CitizenMap] MapLibre error:", e.error?.message);
    });

    map.on("click", (e) => {
      if (onPickLocation) {
        onPickLocation([e.lngLat.lng, e.lngLat.lat]);
      }
    });

    mlMapRef.current = map;

    return () => {
      map.remove();
      mlMapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [weatherList, setWeatherList] = useState<StationForecast[]>([]);
  const weatherListRef = useRef<StationForecast[]>(weatherList);
  weatherListRef.current = weatherList;

  useEffect(() => {
    let active = true;
    async function load() {
      const data = await fetchEcmwfWeatherData();
      if (active) setWeatherList(data);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  // Cập nhật GeoJSON hitbox source khi weatherList thay đổi
  useEffect(() => {
    const map = mlMapRef.current;
    if (!map || !mapReady || !weatherList.length) return;
    const src = map.getSource("cz-weather") as GeoJSONSource | undefined;
    if (!src) return;

    const features = weatherList.flatMap((st) => {
      const base = {
        type: "Feature" as const,
        id: st.stationId,
        geometry: { type: "Point" as const, coordinates: [st.longitude, st.latitude] as [number, number] },
        properties: { stationId: st.stationId, stationName: st.stationName, region: st.region },
      };
      if (st.stationId === "SPR") {
        return [
          base,
          {
            type: "Feature" as const,
            id: "SPR_CZ",
            geometry: { type: "Point" as const, coordinates: [114.5, 10.0] as [number, number] },
            properties: { stationId: st.stationId, stationName: st.stationName, region: st.region },
          },
        ];
      }
      if (st.stationId === "PAR") {
        return [
          base,
          {
            type: "Feature" as const,
            id: "PAR_CZ",
            geometry: { type: "Point" as const, coordinates: [112.0, 16.5] as [number, number] },
            properties: { stationId: st.stationId, stationName: st.stationName, region: st.region },
          },
        ];
      }
      return [base];
    });

    src.setData({ type: "FeatureCollection", features });
  }, [mapReady, weatherList]);

  // Update Markers when data changes
  useEffect(() => {
    if (!mapReady || !mlMapRef.current) return;
    const map = mlMapRef.current;
    mlMarkersRef.current.forEach((m) => m.remove());
    mlMarkersRef.current = [];

    // 1. User / Live GPS Marker
    if (userLocation) {
      const el = document.createElement("div");
      el.className = "citizen-gps-marker";
      el.title = "Vị trí hiện tại của bạn";
      const marker = new Marker({ element: el }).setLngLat(userLocation).addTo(map);
      mlMarkersRef.current.push(marker);
      map.flyTo({ center: userLocation, zoom: 13, speed: 1.2 });
    }

    // 2. Safe Shelters (Green)
    shelters.forEach((shelter) => {
      const el = document.createElement("div");
      el.className = "citizen-shelter-marker";
      el.title = `${shelter.name} (Còn trống ${shelter.capacity - shelter.currentOccupancy} chỗ)`;
      const marker = new Marker({ element: el }).setLngLat(shelter.coordinates).addTo(map);
      mlMarkersRef.current.push(marker);
    });

    // 3. Flood Incidents (Orange/Amber)
    incidents.forEach((inc) => {
      const el = document.createElement("div");
      el.className = "citizen-incident-marker";
      el.title = inc.title;
      const marker = new Marker({ element: el }).setLngLat(inc.location.coordinates).addTo(map);
      mlMarkersRef.current.push(marker);
    });

    // 4. My SOS requests (Red Alert)
    sosList.forEach((sos) => {
      const el = document.createElement("div");
      el.className = "citizen-sos-pin-marker";
      el.title = `SOS ${sos.id}: ${sos.description} (${sos.status})`;
      const marker = new Marker({ element: el }).setLngLat(sos.location.coordinates).addTo(map);
      mlMarkersRef.current.push(marker);
    });

  }, [mapReady, userLocation, shelters, incidents, sosList]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} className="citizen-map-container" />
      {mapReady && (
        <div style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(4px)",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11.5px",
          fontWeight: 650,
          color: "#0f172a",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#16a34a" }} />
            Bản đồ số Quốc gia NDAMapVN
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main Citizen Portal ─────────────── */
export function CitizenPortal() {
  const store = useOperationalState();
  const [gpsLocation, setGpsLocation] = useState<[number, number] | null>([105.852, 21.052]);
  const [locating, setLocating] = useState(false);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [createdSosId, setCreatedSosId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const user = store.currentUser!;
  const userScope = user.geographicScope.name || "Hà Nội";

  // Filter SOS of current citizen
  const mySosList = store.sosRequests.filter(
    (sos) =>
      sos.reporter.name === user.displayName ||
      sos.reporter.contact === user.phone ||
      sos.reporter.name.toLowerCase().includes(user.displayName.toLowerCase()),
  );

  const openShelters = store.shelters.filter((s) => s.status === "Sẵn sàng" || s.status === "Đang tiếp nhận");
  const activeAlerts = store.alerts.slice(0, 4);

  const [weatherList, setWeatherList] = useState<StationForecast[]>([]);
  useEffect(() => {
    fetchEcmwfWeatherData()
      .then((data) => setWeatherList(data))
      .catch(() => {});
  }, []);

  const localWeather =
    weatherList.find((w) => userScope.toLowerCase().includes(w.stationName.split(" ")[0].toLowerCase())) ||
    weatherList[0];

  // Request browser geolocation
  const handleRequestLiveLocation = () => {
    if (!navigator.geolocation) {
      setFeedback("Trình duyệt không hỗ trợ định vị GPS tự động.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setGpsLocation(coords);
        setLocating(false);
        setFeedback(`Đã xác định vị trí GPS thực tế: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setTimeout(() => setFeedback(null), 5000);
      },
      (err) => {
        setLocating(false);
        setFeedback(`Không thể lấy vị trí GPS: ${err.message}. Đang dùng vị trí mặc định tại ${userScope}.`);
        setTimeout(() => setFeedback(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // 1-Click SOS with Realtime GPS Location
  const handleOneClickSos = () => {
    setLocating(true);

    const emitSos = (coords: [number, number], addrDetail: string) => {
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
        });

        setLocating(false);
        setCreatedSosId(id);
        setGpsLocation(coords);
      } catch (err) {
        setLocating(false);
        setFeedback(err instanceof Error ? err.message : "Không thể gửi tín hiệu SOS.");
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          const address = `Vị trí GPS thực tế: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (${userScope})`;
          emitSos(coords, address);
        },
        () => {
          // Fallback location if denied
          const fallbackCoords: [number, number] = gpsLocation || [105.852, 21.052];
          const address = `${userScope} (Tọa độ ước tính: ${fallbackCoords[1]}, ${fallbackCoords[0]})`;
          emitSos(fallbackCoords, address);
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else {
      const fallbackCoords: [number, number] = gpsLocation || [105.852, 21.052];
      emitSos(fallbackCoords, `${userScope} (Tọa độ: ${fallbackCoords[1]}, ${fallbackCoords[0]})`);
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
            <b style={{ fontSize: "14.5px" }}>ĐÃ PHÁT TÍN HIỆU ĐỊNH VỊ SOS THÀNH CÔNG! MÃ SOS: #{createdSosId}</b>
            <p style={{ margin: "3px 0 0", fontSize: "13px", lineHeight: "1.4" }}>
              Ban chỉ huy PCTT và các Đội cứu hộ tại khu vực <b>{userScope}</b> đã nhận được tọa độ GPS thực tế của bạn trên bản đồ tác chiến theo thời gian thực và đang tiến hành điều phối khẩn cấp.
            </p>
          </div>
          <button onClick={() => setCreatedSosId(null)}>
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
            <b>{mySosList.length}</b>
            <span>Yêu cầu SOS của bạn</span>
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
            <b>{store.alerts.length}</b>
            <span>Cảnh báo thời tiết đang phát</span>
          </div>
        </div>

        <div className="citizen-stat-card">
          <div className="citizen-stat-icon blue">
            <Waves size={24} />
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
              background: "#e0f2fe",
              color: "#0284c7",
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

      {/* Interactive Map Section */}
      <section className="citizen-section-card citizen-map-section">
        <div className="citizen-card-header">
          <h2>
            <Compass size={18} color="#175cd3" />
            Bản đồ cứu nạn & Điểm sơ tán thời gian thực
          </h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button
              variant="secondary"
              onClick={handleRequestLiveLocation}
              disabled={locating}
              style={{ fontSize: "12.5px", height: "32px", display: "inline-flex", gap: "5px" }}
            >
              <LocateFixed size={14} />
              {locating ? "Đang dò GPS…" : "Lấy vị trí GPS của tôi"}
            </Button>
            <small style={{ color: "#64748b", display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <MapPin size={13} /> {userScope}
            </small>
          </div>
        </div>

        {/* Map View */}
        <div className="citizen-map-wrapper">
          <CitizenLiveMap
            userLocation={gpsLocation}
            shelters={openShelters.map((s) => ({
              id: s.id,
              name: s.name,
              coordinates: s.coordinates,
              capacity: s.capacity,
              currentOccupancy: s.currentOccupancy,
            }))}
            incidents={store.incidents.map((i) => ({
              id: i.id,
              title: i.title,
              location: { coordinates: i.location.coordinates },
            }))}
            sosList={mySosList.map((sos) => ({
              id: sos.id,
              description: sos.description,
              location: sos.location,
              status: sos.status,
            }))}
          />
          <div className="citizen-map-legend">
            <span><span className="legend-dot red"></span> Vị trí SOS của bạn</span>
            <span><span className="legend-dot green"></span> Điểm sơ tán an toàn</span>
            <span><span className="legend-dot amber"></span> Điểm ngập lụt / sự cố</span>
          </div>
        </div>
      </section>

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
              <small>{activeAlerts.length} thông báo mới</small>
            </div>
            <div className="citizen-alert-list">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.key}
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
                    <p>{alert.message}</p>
                    <small>
                      Khu vực: <b>{alert.geographicScope ?? "Toàn quốc"}</b> · Phát hiện: {alert.detectedAt}
                    </small>
                  </div>
                </div>
              ))}
              {!activeAlerts.length && (
                <p style={{ color: "#64748b", padding: "16px 20px", margin: 0 }}>
                  Hiện tại không có cảnh báo nguy hiểm khẩn cấp nào trên địa bàn.
                </p>
              )}
            </div>
          </div>

          {/* My SOS Requests */}
          <div className="citizen-section-card">
            <div className="citizen-card-header">
              <h2>
                <Radio size={18} color="#dc2626" />
                Yêu cầu cứu hộ SOS của tôi ({mySosList.length})
              </h2>
              <Button
                variant="secondary"
                onClick={() => setSosModalOpen(true)}
                style={{ fontSize: "12.5px", height: "30px" }}
              >
                + Gửi thêm SOS
              </Button>
            </div>
            <div className="citizen-my-sos-list">
              {mySosList.map((sos) => (
                <div key={sos.id} className="citizen-sos-card">
                  <div className="citizen-sos-head">
                    <div>
                      <b>Mã cứu nạn: {sos.id}</b> · <small style={{ color: "#64748b" }}>{sos.receivedAt}</small>
                    </div>
                    <Badge tone={sos.status === "Đã xử lý" || sos.status === "Đã đóng" ? "green" : "red"}>
                      {sos.status}
                    </Badge>
                  </div>
                  <p className="citizen-sos-desc">{sos.description}</p>
                  <div className="citizen-sos-meta">
                    <span>
                      <MapPin size={13} /> {sos.location.address}
                    </span>
                    <span>
                      <Users size={13} /> {sos.peopleAtRisk} người ({sos.elderlyCount} người già, {sos.childrenCount} trẻ nhỏ)
                    </span>
                    {sos.assignedTeamId && (
                      <span style={{ color: "#16a34a", fontWeight: "600" }}>
                        <LifeBuoy size={13} /> Đội cứu hộ: {sos.assignedTeamId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {!mySosList.length && (
                <div style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                  <ShieldCheck size={36} color="#16a34a" style={{ margin: "0 auto 8px" }} />
                  <b style={{ display: "block", color: "#334155" }}>Bạn chưa có yêu cầu cứu hộ nào.</b>
                  <span style={{ fontSize: "13px" }}>
                    Khi xảy ra ngập sâu, cô lập hoặc tình huống nguy hiểm, hãy nhấn nút "GỬI ĐỊNH VỊ SOS 1 CHẠM".
                  </span>
                </div>
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
                      <small style={{ color: "#64748b", marginTop: "4px" }}>
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
          defaultLocation={gpsLocation || [105.852, 21.052]}
          onClose={() => setSosModalOpen(false)}
          onSuccess={(id) => {
            setSosModalOpen(false);
            setCreatedSosId(id);
          }}
        />
      )}
    </div>
  );
}

function SosCreationModal({
  defaultLocation,
  onClose,
  onSuccess,
}: {
  defaultLocation: [number, number];
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const store = useOperationalState();
  const user = store.currentUser!;
  const [name, setName] = useState(user.displayName || "");
  const [phone, setPhone] = useState(
    user.organization?.replace("SĐT: ", "") || "",
  );
  const [address, setAddress] = useState(
    user.geographicScope.name || "",
  );
  const [peopleCount, setPeopleCount] = useState(2);
  const [elderly, setElderly] = useState(0);
  const [children, setChildren] = useState(0);
  const [injured, setInjured] = useState(0);
  const [severity, setSeverity] = useState<SosSeverity>("Đe dọa tính mạng");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim() || !description.trim()) {
      setError("Vui lòng điền đầy đủ các thông tin có dấu *");
      return;
    }
    setError("");
    setBusy(true);

    try {
      const id = store.createSos({
        reporter: {
          name: name.trim(),
          contact: phone.trim(),
          source: "Người dân",
        },
        location: {
          name: address.trim(),
          address: address.trim(),
          administrativeArea: user.geographicScope.name || "Hà Nội",
          coordinates: defaultLocation,
          accessCondition: "Tiếp cận bình thường",
          floodDepth: "Chưa đo",
        },
        description: description.trim(),
        peopleAtRisk: Number(peopleCount) || 1,
        elderlyCount: Number(elderly) || 0,
        childrenCount: Number(children) || 0,
        injuredCount: Number(injured) || 0,
        missingCount: 0,
        disabledCount: 0,
        severity,
        communicationStatus: "Kết nối",
      });
      setBusy(false);
      onSuccess(id);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi gửi yêu cầu SOS.");
    }
  };

  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <div className="citizen-sos-modal" role="dialog" aria-modal="true">
        <header className="citizen-sos-modal-header">
          <h3>
            <Radio size={20} />
            GỬI YÊU CẦU CỨU HỘ KHẨN CẤP (SOS)
          </h3>
          <button onClick={onClose} type="button" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} className="citizen-sos-modal-body">
          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <label className="field">
              <span className="label-text">
                Họ và tên người cần cứu hộ <b className="req">*</b>
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span className="label-text">
                Số điện thoại liên hệ <b className="req">*</b>
              </span>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912 345 678"
                required
              />
            </label>
          </div>

          <label className="field">
            <span className="label-text">
              Địa chỉ / Vị trí chính xác đang gặp nguy hiểm <b className="req">*</b>
            </span>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Số 45 ngõ 124 đường Âu Cơ, Tây Hồ, Hà Nội"
              required
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <label className="field">
              <span className="label-text">Tổng số người</span>
              <Input
                type="number"
                min={1}
                value={peopleCount}
                onChange={(e) => setPeopleCount(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span className="label-text">Người già</span>
              <Input
                type="number"
                min={0}
                value={elderly}
                onChange={(e) => setElderly(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span className="label-text">Trẻ nhỏ</span>
              <Input
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              />
            </label>

            <label className="field">
              <span className="label-text">Bị thương</span>
              <Input
                type="number"
                min={0}
                value={injured}
                onChange={(e) => setInjured(Number(e.target.value))}
              />
            </label>
          </div>

          <label className="field">
            <span className="label-text">Mức độ nguy cấp</span>
            <UiSelect
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SosSeverity)}
            >
              <option value="Đe dọa tính mạng">Khẩn cấp — Đe dọa tính mạng (Nước ngập cao, cô lập, nguy hiểm)</option>
              <option value="Nghiêm trọng">Nghiêm trọng — Cần cứu hộ sớm</option>
              <option value="Đáng chú ý">Đáng chú ý — Cần hỗ trợ di dời hoặc thiếu nhu yếu phẩm</option>
              <option value="Thông thường">Thông thường — Cần hỗ trợ hậu cần</option>
            </UiSelect>
          </label>

          <label className="field">
            <span className="label-text">
              Mô tả tình trạng hiện tại <b className="req">*</b>
            </span>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="VD: Nước lũ đã ngập lên tầng 1 cao hơn 1.5m, mất điện, có 1 người già khó di chuyển và 1 trẻ nhỏ, cần xuồng cứu hộ gấp..."
              required
            />
          </label>

          <div className="citizen-sos-modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={busy || !description.trim()}
              style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
            >
              <Send size={16} />
              {busy ? "Đang phát tín hiệu SOS…" : "Xác nhận gửi SOS cứu nạn"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
