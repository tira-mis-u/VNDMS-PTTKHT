import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Popup, type GeoJSONSource } from "maplibre-gl";

import {
  getNdaMapBaseStyle,
  MAP_MIN_ZOOM,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  CloudRain,
  Compass,
  Droplets,
  ExternalLink,
  Layers3,
  Minus,
  Plus,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { OPERATIONAL_MAP_WORKSPACE_PATH } from "@/app/routes/router";
import type {
  CommandCenterEntityKind,
  CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  fetchEcmwfWeatherData,
  type StationForecast,
} from "@/infrastructure/weather/ecmwfWeatherService";
import { Badge } from "@/components/ui";

const layerConfig: Array<{
  key: CommandCenterEntityKind | "weather";
  label: string;
  color: string;
}> = [
  { key: "sos", label: "SOS khẩn cấp", color: "#d92d20" },
  { key: "incident", label: "Sự cố", color: "#f79009" },
  { key: "team", label: "Đội cứu hộ", color: "#1570ef" },
  { key: "shelter", label: "Điểm sơ tán", color: "#079455" },
  { key: "weather", label: "Khí tượng ECMWF", color: "#0284c7" },
];

function toCollection(
  kind: CommandCenterEntityKind,
  rows: Array<{
    id: string;
    coordinates: [number, number];
    name?: string;
    area?: string;
  }>,
) {
  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: row.coordinates },
      properties: {
        id: row.id,
        kind,
        label: row.id,
        title: row.name ?? row.area ?? row.id,
      },
    })),
  };
}

export function OperationalMap({
  onOpen,
  onNavigate,
}: {
  onOpen: (ref: CommandCenterEntityRef) => void;
  onNavigate: (path: string) => void;
}) {
  const { incidents, teams, shelters, sosRequests } = useOperationalState();
  const incidentsRef = useRef(incidents);
  const teamsRef = useRef(teams);
  const sheltersRef = useRef(shelters);
  const sosRef = useRef(sosRequests);
  const container = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    sos: true,
    incident: true,
    team: true,
    shelter: true,
    weather: true,
  });

  const [weatherStations, setWeatherStations] = useState<StationForecast[]>([]);
  const weatherStationsRef = useRef<StationForecast[]>(weatherStations);
  weatherStationsRef.current = weatherStations;
  const [selectedWeatherStation, setSelectedWeatherStation] = useState<StationForecast | null>(null);

  const mapRef = useRef<MapLibreMap | null>(null);

  incidentsRef.current = incidents;
  teamsRef.current = teams;
  sheltersRef.current = shelters;
  sosRef.current = sosRequests;

  // Load live ECMWF weather data
  useEffect(() => {
    let active = true;
    async function loadWeather() {
      const data = await fetchEcmwfWeatherData();
      if (active) {
        setWeatherStations(data);
      }
    }
    loadWeather();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!container.current) return;
    let mounted = true;

    const styleUrl = getNdaMapBaseStyle();

    const map = new MapLibreMap({
      container: container.current,
      style: styleUrl,
      center: [106.8, 16.2], // Bao quát toàn bộ dải đất và vùng biển Việt Nam
      zoom: 6.5,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      if (!mounted) return;
      setReady(true);
      applyVietnameseMapLabels(map);

      const collections = {
        sos: toCollection(
          "sos",
          sosRef.current.map((item) => ({
            id: item.id,
            name: item.description,
            area: item.location.address,
            coordinates: item.location.coordinates,
          })),
        ),
        incident: toCollection(
          "incident",
          incidentsRef.current.map((item) => ({
            id: item.id,
            name: item.title,
            area: item.location.name,
            coordinates: item.location.coordinates,
          })),
        ),
        team: toCollection("team", teamsRef.current),
        shelter: toCollection("shelter", sheltersRef.current),
      };

      const entityLayers = layerConfig.filter((c) => c.key !== "weather");
      entityLayers.forEach((config) => {
        map.addSource(`cc-${config.key}`, {
          type: "geojson",
          data: collections[config.key as keyof typeof collections],
        });
        map.addLayer({
          id: `cc-${config.key}-points`,
          type: "circle",
          source: `cc-${config.key}`,
          paint: {
            "circle-radius": 7.5,
            "circle-color": config.color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        map.on("click", `cc-${config.key}-points`, (event) => {
          const feature = event.features?.[0];
          if (!feature?.properties) return;
          onOpen({
            kind: config.key as CommandCenterEntityKind,
            id: feature.properties.id,
          });
        });
        map.on("mouseenter", `cc-${config.key}-points`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `cc-${config.key}-points`, () => {
          map.getCanvas().style.cursor = "";
        });
      });
      // Thêm lớp GeoJSON tương tác khí tượng chuẩn xác 100% không phụ thuộc DPI hay zoom
      const weatherGeoJson = {
        type: "FeatureCollection" as const,
        features: weatherStationsRef.current.flatMap((st) => {
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
                id: "SPR_CENTER",
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
                id: "PAR_CENTER",
                geometry: { type: "Point" as const, coordinates: [112.0, 16.5] as [number, number] },
                properties: { stationId: st.stationId, stationName: st.stationName, region: st.region },
              },
            ];
          }
          return [base];
        }),
      };

      map.addSource("cc-weather", {
        type: "geojson",
        data: weatherGeoJson,
      });

      map.addLayer({
        id: "cc-weather-hitbox",
        type: "circle",
        source: "cc-weather",
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

      const hoverPopup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "ecmwf-hover-popup",
      });


      map.on("mousemove", "cc-weather-hitbox", (e) => {
        const feat = e.features?.[0];
        const stationId = feat?.properties?.stationId;
        if (!stationId) return;

        const st = weatherStationsRef.current.find((s) => s.stationId === stationId);
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

        hoverPopup.setLngLat(e.lngLat).setHTML(`
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

      map.on("mouseleave", "cc-weather-hitbox", () => {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
      });

      map.on("click", "cc-weather-hitbox", (e) => {
        const feat = e.features?.[0];
        const stationId = feat?.properties?.stationId;
        if (!stationId) return;

        const st = weatherStationsRef.current.find((s) => s.stationId === stationId);
        if (st) {
          setSelectedWeatherStation(st);
        }
      });
    });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync data whenever store collections change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    const collections = {
      sos: toCollection(
        "sos",
        sosRequests.map((item) => ({
          id: item.id,
          name: item.description,
          area: item.location.address,
          coordinates: item.location.coordinates,
        })),
      ),
      incident: toCollection(
        "incident",
        incidents.map((item) => ({
          id: item.id,
          name: item.title,
          area: item.location.name,
          coordinates: item.location.coordinates,
        })),
      ),
      team: toCollection("team", teams),
      shelter: toCollection("shelter", shelters),
    };

    layerConfig
      .filter((c) => c.key !== "weather")
      .forEach((config) => {
        const source = map.getSource(`cc-${config.key}`) as
          | GeoJSONSource
          | undefined;
        if (source) {
          source.setData(collections[config.key as keyof typeof collections]);
        }
      });

    const weatherSource = map.getSource("cc-weather") as GeoJSONSource | undefined;
    if (weatherSource && weatherStations.length > 0) {
      weatherSource.setData({
        type: "FeatureCollection",
        features: weatherStations.flatMap((st) => {
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
                id: "SPR_CENTER",
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
                id: "PAR_CENTER",
                geometry: { type: "Point" as const, coordinates: [112.0, 16.5] as [number, number] },
                properties: { stationId: st.stationId, stationName: st.stationName, region: st.region },
              },
            ];
          }
          return [base];
        }),
      });
    }
  }, [ready, incidents, teams, shelters, sosRequests, weatherStations]);

  // Toggle visibility of layer
  const toggleLayer = (key: string) => {
    const next = !visible[key];
    setVisible((v) => ({ ...v, [key]: next }));

    if (mapRef.current) {
      const layerId = key === "weather" ? "cc-weather-hitbox" : `cc-${key}-points`;
      if (mapRef.current.getLayer(layerId)) {
        mapRef.current.setLayoutProperty(
          layerId,
          "visibility",
          next ? "visible" : "none",
        );
      }
    }
  };

  const zoom = (delta: number) => {
    if (!mapRef.current) return;
    const current = mapRef.current.getZoom();
    mapRef.current.easeTo({ zoom: current + delta, duration: 250 });
  };

  const getRiskTone = (level: string) => {
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
    <div
      className="cc-map-container"
      style={{
        position: "relative",
        width: "100%",
        height: "620px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1.5px solid #cbd5e1",
        boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.08)",
      }}
    >
      <div ref={container} className="cc-map-canvas" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />

      {/* Map attribution badge */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(6px)",
          padding: "5px 12px",
          borderRadius: "7px",
          fontSize: "12px",
          fontWeight: 650,
          color: "#0f172a",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          border: "1px solid #e2e8f0",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          pointerEvents: "none",
        }}
      >
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
        <span>Bản đồ số Quốc gia NDAMapVN · Vector Tiles</span>
      </div>

      {/* Interactive ECMWF Weather Popup on Map (Đồng bộ theme tối cao cấp, không bị nền trắng chữ trắng) */}
      {selectedWeatherStation && (
        <div
          className="ecmwf-map-popup-card"
          style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            width: "360px",
            maxWidth: "calc(100% - 32px)",
            background: "#0f172a",
            borderRadius: "12px",
            border: "1.5px solid #2563eb",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
            zIndex: 20,
            padding: "16px",
            color: "#f8fafc",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <CloudRain size={17} color="#38bdf8" />
                <b style={{ fontSize: "15px", color: "#ffffff", fontWeight: 700 }}>{selectedWeatherStation.stationName}</b>
              </div>
              <small style={{ color: "#94a3b8", fontSize: "12px" }}>
                Mô hình ECMWF-IFS · Vùng {selectedWeatherStation.region}
              </small>
            </div>
            <button
              type="button"
              onClick={() => setSelectedWeatherStation(null)}
              style={{ border: 0, background: "transparent", color: "#94a3b8", cursor: "pointer", padding: "3px", borderRadius: "4px" }}
              aria-label="Đóng"
            >
              <X size={17} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", margin: "10px 0" }}>
            <div style={{ background: "#1e293b", padding: "9px", borderRadius: "8px", border: "1px solid #334155" }}>
              <span style={{ fontSize: "11.5px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                <Thermometer size={13} color="#f87171" /> Nhiệt độ
              </span>
              <b style={{ fontSize: "16px", color: "#f87171" }}>{selectedWeatherStation.current.temperature.toFixed(1)}°C</b>
            </div>

            <div style={{ background: "#1e293b", padding: "9px", borderRadius: "8px", border: "1px solid #334155" }}>
              <span style={{ fontSize: "11.5px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                <CloudRain size={13} color="#38bdf8" /> Mưa / Giờ
              </span>
              <b style={{ fontSize: "16px", color: "#38bdf8" }}>{selectedWeatherStation.current.rain.toFixed(1)} mm</b>
            </div>

            <div style={{ background: "#1e293b", padding: "9px", borderRadius: "8px", border: "1px solid #334155" }}>
              <span style={{ fontSize: "11.5px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                <Wind size={13} color="#cbd5e1" /> Gió & Giật
              </span>
              <b style={{ fontSize: "14px", color: "#e2e8f0" }}>
                {selectedWeatherStation.current.windSpeed.toFixed(0)} ({selectedWeatherStation.current.windGusts.toFixed(0)}) km/h
              </b>
            </div>

            <div style={{ background: "#1e293b", padding: "9px", borderRadius: "8px", border: "1px solid #334155" }}>
              <span style={{ fontSize: "11.5px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                <Compass size={13} color="#fbbf24" /> Dòng chảy lũ
              </span>
              <b style={{ fontSize: "14px", color: "#fbbf24" }}>{selectedWeatherStation.current.runoff.toFixed(2)} mm</b>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #334155", paddingTop: "10px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Xu thế 3 ngày tới:
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
              {selectedWeatherStation.dailySummary.slice(0, 3).map((day) => (
                <div key={day.date} style={{ textAlign: "center", background: "#1e293b", padding: "7px 5px", borderRadius: "7px", fontSize: "11px", border: "1px solid #334155" }}>
                  <div style={{ color: "#94a3b8", fontWeight: 500 }}>{day.date.slice(5)}</div>
                  <div style={{ fontWeight: 700, color: "#ffffff", margin: "2px 0" }}>{day.maxTemp.toFixed(0)}° / {day.minTemp.toFixed(0)}°</div>
                  <div style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "2px", justifyContent: "center" }}>
                    <Droplets size={11} color="#38bdf8" />
                    {day.totalRain.toFixed(0)}mm
                  </div>
                  <div style={{ marginTop: "3px" }}>
                    <Badge tone={getRiskTone(day.floodRiskLevel)}>
                      {day.floodRiskLevel}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map Zoom & Layer Controls */}
      <div className="cc-map-controls">
        <div className="cc-zoom-group">
          <button title="Phóng to" onClick={() => zoom(1)}>
            <Plus size={16} />
          </button>
          <span />
          <button title="Thu nhỏ" onClick={() => zoom(-1)}>
            <Minus size={16} />
          </button>
        </div>
        {layersOpen && (
          <div className="cc-layer-control">
            <strong>Lớp bản đồ & Dữ liệu</strong>
            {layerConfig.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleLayer(item.key)}
                className={!visible[item.key] ? "disabled" : ""}
              >
                <span
                  className="dot"
                  style={{
                    backgroundColor: visible[item.key]
                      ? item.color
                      : "transparent",
                    borderColor: item.color,
                  }}
                />
                {item.label}
              </button>
            ))}
          </div>
        )}
        <button
          className={`cc-ctrl-btn ${layersOpen ? "active" : ""}`}
          title="Lớp dữ liệu"
          onClick={() => setLayersOpen(!layersOpen)}
        >
          <Layers3 size={18} />
        </button>
        <button
          className="cc-ctrl-btn"
          title="Mở Bản đồ tác nghiệp toàn màn hình"
          onClick={() => onNavigate(OPERATIONAL_MAP_WORKSPACE_PATH)}
        >
          <ExternalLink size={17} />
        </button>
      </div>
    </div>
  );
}
