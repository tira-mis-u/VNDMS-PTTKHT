import { useEffect, useState } from "react";
import {
  CloudRain,
  Compass,
  Droplets,
  Gauge,
  RefreshCw,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  fetchEcmwfWeatherData,
  subscribeWeatherMetadata,
  type StationForecast,
  type WeatherMetadata,
} from "@/infrastructure/weather/ecmwfWeatherService";
import { Badge, Button } from "@/components/ui";

const REGIONS = [
  "Tất cả",
  "Bắc Bộ",
  "Bắc Trung Bộ",
  "Nam Trung Bộ & Tây Nguyên",
  "Nam Bộ",
  "Biển & Hải Đảo",
] as const;

export function EcmwfWeatherPanel() {
  const [stations, setStations] = useState<StationForecast[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("Tất cả");
  const [selectedStationId, setSelectedStationId] = useState<string>("HAN");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherMeta, setWeatherMeta] = useState<WeatherMetadata | null>(null);

  useEffect(() => {
    const unsub = subscribeWeatherMetadata(setWeatherMeta);
    return unsub;
  }, []);

  const loadData = async (force = false) => {
    try {
      const data = await fetchEcmwfWeatherData(force);
      setStations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const filteredStations =
    selectedRegion === "Tất cả"
      ? stations
      : stations.filter((s) => s.region === selectedRegion);

  const currentStation =
    stations.find((s) => s.stationId === selectedStationId) ||
    filteredStations[0] ||
    stations[0];

  const getRiskTone = (
    level: "Bình thường" | "Cảnh báo" | "Nguy cơ cao" | "Đặc biệt nghiêm trọng",
  ) => {
    switch (level) {
      case "Đặc biệt nghiêm trọng":
        return "red";
      case "Nguy cơ cao":
        return "amber";
      case "Cảnh báo":
        return "amber";
      default:
        return "green";
    }
  };

  return (
    <section className="content-section cc-panel ecmwf-weather-panel">
      <header className="cc-panel-header">
        <div>
          <span>
            <CloudRain size={16} color="#0284c7" />
            Dự báo Khí tượng & Thủy văn ECMWF Toàn quốc (10 Ngày)
          </span>
          <small>
            Mô hình toàn cầu ECMWF-IFS (Open-Meteo) · 20 trạm quan trắc quốc gia & hải đảo · Đồng bộ hiển thị trực tiếp trên Bản đồ số NDAMapVN
          </small>
          {weatherMeta && (
            <div style={{ marginTop: "4px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: weatherMeta.isFallback ? "#fef3c7" : weatherMeta.source === "cache" ? "#f1f5f9" : "#dcfce7",
                  color: weatherMeta.isFallback ? "#92400e" : weatherMeta.source === "cache" ? "#334155" : "#166534",
                  border: `1px solid ${weatherMeta.isFallback ? "#fde68a" : weatherMeta.source === "cache" ? "#cbd5e1" : "#bbf7d0"}`,
                }}
              >
                {weatherMeta.statusText}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          aria-label={refreshing ? "Đang tải dữ liệu khí tượng" : "Làm mới dữ liệu khí tượng"}
          style={{ height: "28px", paddingInline: "8px", fontSize: "12px" }}
        >
          <RefreshCw size={13} className={refreshing ? "spin-once" : ""} />
          <span>{refreshing ? "Đang cập nhật…" : "Làm mới"}</span>
        </Button>
      </header>

      {/* Region Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-muted, #f8fafc)",
        }}
      >
        {REGIONS.map((reg) => (
          <button
            key={reg}
            type="button"
            onClick={() => setSelectedRegion(reg)}
            style={{
              border: 0,
              borderRadius: "5px",
              padding: "4px 9px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              background: selectedRegion === reg ? "#0284c7" : "transparent",
              color: selectedRegion === reg ? "#ffffff" : "#475467",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {reg}
          </button>
        ))}
      </div>

      {/* Station Selector Tabs */}
      <div className="weather-station-tabs" role="tablist" aria-label="Chọn trạm khí tượng">
        {filteredStations.map((st) => {
          const currentRisk = st.dailySummary[0]?.floodRiskLevel || "Bình thường";
          return (
            <button
              key={st.stationId}
              type="button"
              role="tab"
              aria-selected={st.stationId === currentStation?.stationId}
              className={`weather-station-tab ${
                st.stationId === currentStation?.stationId ? "active" : ""
              }`}
              onClick={() => setSelectedStationId(st.stationId)}
            >
              <b>{st.stationName}</b>
              <Badge tone={getRiskTone(currentRisk)}>
                {st.current.temperature.toFixed(0)}°C
              </Badge>
              {st.current.rain > 0.5 && (
                <small style={{ color: "#0284c7", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "2px" }}>
                  <Droplets size={10} color="#0284c7" />
                  {st.current.rain.toFixed(0)}m
                </small>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
          Đang tải dữ liệu mô hình ECMWF-IFS từ Open-Meteo API…
        </div>
      ) : currentStation ? (
        <div className="weather-details-body">
          {/* Current Observation Metric Grid */}
          <div className="weather-metric-grid">
            <div className="weather-metric-card">
              <div className="metric-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                <Thermometer size={16} />
              </div>
              <div>
                <span className="metric-lbl">Nhiệt độ hiện tại</span>
                <b className="metric-val">{currentStation.current.temperature.toFixed(1)}°C</b>
              </div>
            </div>

            <div className="weather-metric-card">
              <div className="metric-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                <CloudRain size={16} />
              </div>
              <div>
                <span className="metric-lbl">Mưa / Giờ ({currentStation.current.weatherDesc})</span>
                <b className="metric-val">{currentStation.current.rain.toFixed(1)} mm</b>
              </div>
            </div>

            <div className="weather-metric-card">
              <div className="metric-icon-wrap" style={{ background: "#f1f5f9", color: "#475467" }}>
                <Wind size={16} />
              </div>
              <div>
                <span className="metric-lbl">Gió & Gió giật</span>
                <b className="metric-val">
                  {currentStation.current.windSpeed.toFixed(0)} ({currentStation.current.windGusts.toFixed(0)}) km/h
                </b>
              </div>
            </div>

            <div className="weather-metric-card">
              <div className="metric-icon-wrap" style={{ background: "#ede9fe", color: "#7c3aed" }}>
                <Gauge size={16} />
              </div>
              <div>
                <span className="metric-lbl">Khí áp mực biển</span>
                <b className="metric-val">{currentStation.current.pressureMsl.toFixed(0)} hPa</b>
              </div>
            </div>

            <div className="weather-metric-card">
              <div className="metric-icon-wrap" style={{ background: "#f0fdf4", color: "#16a34a" }}>
                <Droplets size={16} />
              </div>
              <div>
                <span className="metric-lbl">Độ ẩm tương đối</span>
                <b className="metric-val">{currentStation.current.relativeHumidity}%</b>
              </div>
            </div>

            <div className="weather-metric-card">
              <div className="metric-icon-wrap" style={{ background: "#fef2f2", color: "#dc2626" }}>
                <Compass size={16} />
              </div>
              <div>
                <span className="metric-lbl">Dòng chảy bề mặt</span>
                <b className="metric-val">{currentStation.current.runoff.toFixed(2)} mm</b>
              </div>
            </div>
          </div>

          {/* 10-Day Forecast Timeline */}
          <div className="weather-forecast-timeline">
            <h4 style={{ margin: "10px 0 8px", fontSize: "13px", color: "var(--text-secondary, #475467)" }}>
              Dự báo xu thế 10 ngày tới tại {currentStation.stationName} (Vùng {currentStation.region}):
            </h4>
            <div className="weather-days-scroll">
              {currentStation.dailySummary.map((day) => (
                <div key={day.date} className="weather-day-card">
                  <span className="day-date">{day.date.slice(5)}</span>
                  <div className="day-temps">
                    <b>{day.maxTemp.toFixed(0)}°</b>
                    <small>{day.minTemp.toFixed(0)}°</small>
                  </div>
                  <div className="day-rain" title={`Mưa: ${day.totalRain.toFixed(1)} mm`}>
                    <CloudRain size={12} color="#0284c7" />
                    <span>{day.totalRain.toFixed(1)}mm</span>
                  </div>
                  <Badge tone={getRiskTone(day.floodRiskLevel)}>
                    {day.floodRiskLevel}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
