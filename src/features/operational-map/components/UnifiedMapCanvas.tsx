import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Popup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";

import { CloudRain, Compass, Minus, Plus, Scan, Thermometer, Wind, X } from "lucide-react";
import {
  getNdaMapBaseStyle,
  MAP_MIN_ZOOM,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  UNIFIED_MAP_LAYER_CONFIG,
  type UnifiedMapKind,
  type UnifiedMapPoint,
  type UnifiedMapRouteLine,
} from "@/application/map/unifiedMapQueries";
import {
  fetchEcmwfWeatherData,
  type StationForecast,
} from "@/infrastructure/weather/ecmwfWeatherService";

const DEFAULT_CENTER: [number, number] = [106.8, 16.2]; // Trung tâm toàn cảnh Việt Nam & biển đảo
const DEFAULT_ZOOM = 6.5;

function pointCollection(points: UnifiedMapPoint[], kind: UnifiedMapKind) {
  return {
    type: "FeatureCollection" as const,
    features: points
      .filter((point) => point.kind === kind)
      .map((point) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: point.coordinates },
        properties: {
          id: point.id,
          kind: point.kind,
          code: point.code,
          title: point.title,
          area: point.area,
        },
      })),
  };
}

function lineCollection(
  routes: UnifiedMapRouteLine[],
  blocked: boolean,
) {
  return {
    type: "FeatureCollection" as const,
    features: routes
      .filter((route) => route.blocked === blocked)
      .map((route) => ({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: route.points },
        properties: {
          id: route.id,
          operationId: route.operationId,
          name: route.name,
          status: route.status,
        },
      })),
  };
}

const RADIUS: Partial<Record<UnifiedMapKind, number>> = {
  sos: 8,
  incident: 7.5,
  task: 6.5,
};

export function UnifiedMapCanvas({
  points,
  routes,
  focusKey,
  onSelect,
  focusTarget,
}: {
  points: UnifiedMapPoint[];
  routes: UnifiedMapRouteLine[];
  /** Tăng key để yêu cầu bản đồ bay tới entity focus (deep-link/search). */
  focusKey: number;
  focusTarget: UnifiedMapPoint | null;
  onSelect: (ref: { kind: UnifiedMapKind; id: string }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [weatherStations, setWeatherStations] = useState<StationForecast[]>([]);
  const weatherStationsRef = useRef<StationForecast[]>(weatherStations);
  weatherStationsRef.current = weatherStations;
  const [selectedWeatherStation, setSelectedWeatherStation] = useState<StationForecast | null>(null);


  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // MapLibre references
  const mapRef = useRef<MapLibreMap | null>(null);

  // Fetch live ECMWF weather
  useEffect(() => {
    let active = true;
    async function loadWeather() {
      const data = await fetchEcmwfWeatherData();
      if (active) setWeatherStations(data);
    }
    loadWeather();
    return () => {
      active = false;
    };
  }, []);

  // Khởi tạo bản đồ một lần; mọi cập nhật dữ liệu đi qua setData.
  useEffect(() => {
    if (!container.current) return;
    let mounted = true;

    const map = new MapLibreMap({
      container: container.current,
      style: getNdaMapBaseStyle(),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current!);

    map.on("load", () => {
      if (!mounted) return;
      map.resize();
      applyVietnameseMapLabels(map);

      for (const layer of UNIFIED_MAP_LAYER_CONFIG) {
        map.addSource(`om-${layer.key}`, {
          type: "geojson",
          data: pointCollection([], layer.key),
        });
        map.addLayer({
          id: `om-${layer.key}-points`,
          type: "circle",
          source: `om-${layer.key}`,
          paint: {
            "circle-radius": RADIUS[layer.key] ?? 6,
            "circle-color": layer.color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.96,
          },
        });
        map.addLayer({
          id: `om-${layer.key}-labels`,
          type: "symbol",
          source: `om-${layer.key}`,
          minzoom: 11.2,
          layout: {
            "text-field": ["get", "code"],
            "text-size": 10.5,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-optional": true,
          },
          paint: {
            "text-color": "#2c3a4d",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.6,
          },
        });
        map.on("click", `om-${layer.key}-points`, (event: MapLayerMouseEvent) => {
          const props = event.features?.[0]?.properties;
          if (!props) return;
          onSelectRef.current({
            kind: props.kind as UnifiedMapKind,
            id: props.id,
          });
        });
        map.on("mouseenter", `om-${layer.key}-points`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `om-${layer.key}-points`, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Tuyến sơ tán
      map.addSource("om-routes-ok", { type: "geojson", data: lineCollection([], false) });
      map.addSource("om-routes-blocked", { type: "geojson", data: lineCollection([], true) });
      map.addLayer({
        id: "om-routes-ok-line",
        type: "line",
        source: "om-routes-ok",
        paint: { "line-color": "#0e7490", "line-width": 3, "line-opacity": 0.75 },
      });
      map.addLayer({
        id: "om-routes-blocked-line",
        type: "line",
        source: "om-routes-blocked",
        paint: {
          "line-color": "#d92d20",
          "line-width": 3,
          "line-opacity": 0.85,
          "line-dasharray": [2, 1.6],
        },
      });
      for (const id of ["om-routes-ok-line", "om-routes-blocked-line"]) {
        map.on("click", id, (event: MapLayerMouseEvent) => {
          const props = event.features?.[0]?.properties;
          if (!props?.operationId) return;
          onSelectRef.current({ kind: "evacuation", id: props.operationId });
        });
        map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
      }

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

      map.addSource("om-weather", {
        type: "geojson",
        data: weatherGeoJson,
      });

      map.addLayer({
        id: "om-weather-hitbox",
        type: "circle",
        source: "om-weather",
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

      const weatherPopup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "ecmwf-hover-popup",
      });


      map.on("mousemove", "om-weather-hitbox", (e) => {
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

        weatherPopup.setLngLat(e.lngLat).setHTML(`
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

      map.on("mouseleave", "om-weather-hitbox", () => {
        map.getCanvas().style.cursor = "";
        weatherPopup.remove();
      });

      map.on("click", "om-weather-hitbox", (e) => {
        const feat = e.features?.[0];
        const stationId = feat?.properties?.stationId;
        if (!stationId) return;

        const st = weatherStationsRef.current.find((s) => s.stationId === stationId);
        if (st) {
          setSelectedWeatherStation(st);
        }
      });

      setReady(true);
    });

    return () => {
      mounted = false;
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setReady(false);
    };
  }, []);

  // ── Sync data ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of UNIFIED_MAP_LAYER_CONFIG) {
      const source = map.getSource(`om-${layer.key}`) as GeoJSONSource | undefined;
      source?.setData(pointCollection(points, layer.key));
    }
    const ok = map.getSource("om-routes-ok") as GeoJSONSource | undefined;
    ok?.setData(lineCollection(routes, false));
    const blocked = map.getSource("om-routes-blocked") as GeoJSONSource | undefined;
    blocked?.setData(lineCollection(routes, true));

    // Cập nhật dữ liệu trạm khí tượng ngay khi fetch hoàn tất
    if (weatherStations.length > 0) {
      const weatherSource = map.getSource("om-weather") as GeoJSONSource | undefined;
      if (weatherSource) {
        const features = weatherStations.flatMap((st) => {
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
        });
        weatherSource.setData({ type: "FeatureCollection", features });
      }
    }
  }, [points, routes, ready, weatherStations]);



  // Deep-link focus
  useEffect(() => {
    if (focusKey <= 0 || !focusTarget || !ready || !mapRef.current) return;
    mapRef.current.flyTo({
      center: focusTarget.coordinates,
      zoom: Math.max(mapRef.current.getZoom(), 12.2),
      duration: 700,
    });
  }, [focusKey, focusTarget, ready]);

  const zoomBy = (amount: number) => {
    if (mapRef.current) {
      mapRef.current.zoomTo(
        (mapRef.current.getZoom() ?? DEFAULT_ZOOM) + amount,
        { duration: 200 },
      );
    }
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    if (points.length === 0) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 500 });
      return;
    }
    if (points.length === 1) {
      map.flyTo({ center: points[0].coordinates, zoom: 12, duration: 500 });
      return;
    }
    const lngs = points.map((p) => p.coordinates[0]);
    const lats = points.map((p) => p.coordinates[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, maxZoom: 12.4, duration: 500 },
    );
  };

  return (
    <div className="om-canvas-wrap">
      <div
        ref={container}
        className="om-canvas map-canvas"
        aria-label="Bản đồ tác nghiệp thống nhất"
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(4px)",
          padding: "4px 10px",
          borderRadius: "6px",
          fontSize: "11.5px",
          fontWeight: 650,
          color: "#0f172a",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          zIndex: 10,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#16a34a" }} />
        Bản đồ số Quốc gia NDAMapVN
      </div>

      {/* On-Map Weather Popup */}
      {selectedWeatherStation && (
        <div
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
        </div>
      )}

      <div className="map-toolbar om-toolbar" aria-label="Điều khiển bản đồ">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Phóng to">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Thu nhỏ">
          <Minus size={16} />
        </button>
        <button type="button" onClick={resetView} aria-label="Vừa khung dữ liệu">
          <Scan size={15} />
        </button>
      </div>
    </div>
  );
}
