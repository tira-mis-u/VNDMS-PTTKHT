import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";

import { Minus, Plus, Scan } from "lucide-react";
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
  fetchEcmwfGridSamples,
  lookupWeatherFromCache,
  METEOROLOGICAL_STATIONS,
  type StationForecast,
  type ForecastGridSample,
} from "@/infrastructure/weather/ecmwfWeatherService";
import {
  resolveAdministrativeLocation,
} from "@/infrastructure/gis/administrativeResolver";
import { TemperatureShaderLayer } from "@/infrastructure/weather/temperatureShaderLayer";
import {
  fetchLiveLocations,
  BROADCAST_EVENT_NAME,
  type LiveLocationPing,
} from "@/infrastructure/redis/redisClient";

const DEFAULT_CENTER: [number, number] = [106.8, 16.2]; // Trung tâm toàn cảnh Việt Nam & biển đảo
const DEFAULT_ZOOM = 6.5;

function buildWeatherGeoJson(stations: StationForecast[], gridSamples: ForecastGridSample[] = []) {
  const stationList = stations.length > 0 ? stations : (METEOROLOGICAL_STATIONS as any[]);

  // 1. Điểm quan trắc trạm khí tượng
  const stationFeatures = stationList.flatMap((st: any) => {
    const temp = st.current?.temperature ?? (st.id === "DLI" ? 18.5 : 28.0);
    const rain = st.current?.rain ?? 0;
    const windSpeed = st.current?.windSpeed ?? 12;
    const sId = st.stationId || st.id;
    const sName = st.stationName || st.name;
    const lng = st.longitude ?? st.lng;
    const lat = st.latitude ?? st.lat;

    // Trạm đất liền và Phú Quốc đưa vào heatmap; Hoàng Sa & Trường Sa chỉ dùng tra cứu thời tiết, không đưa vào heatmap
    const isLandStation = (sId === "PAR" || sId === "SPR" || (st.region === "Biển & Hải Đảo" && sId !== "PQC")) ? 0 : 1;

    return [{
      type: "Feature" as const,
      id: sId,
      geometry: { type: "Point" as const, coordinates: [lng, lat] as [number, number] },
      properties: {
        id: sId,
        name: sName,
        region: st.region,
        temperature: temp,
        tempFormatted: `${temp.toFixed(1)}°C`,
        rain,
        windSpeed,
        source: "ecmwf_ifs_station",
        isLand: isLandStation,
      },
    }];
  });

  // 2. Điểm lấy mẫu dự báo lưới đều (ECMWF-IFS forecast grid samples)
  const gridFeatures = gridSamples.map((sample) => ({
    type: "Feature" as const,
    id: sample.id,
    geometry: { type: "Point" as const, coordinates: [sample.lng, sample.lat] as [number, number] },
    properties: {
      id: sample.id,
      name: sample.id,
      temperature: sample.temperature,
      tempFormatted: `${sample.temperature.toFixed(1)}°C`,
      rain: sample.rain,
      windSpeed: sample.windSpeed,
      source: "ecmwf_ifs_grid",
      isLand: sample.isLand === true ? 1 : 0, // 1=đất liền, 0=biển
    },
  }));

  return {
    type: "FeatureCollection" as const,
    features: [...stationFeatures, ...gridFeatures],
  };
}

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

/**
 * Tìm layer giao thông hoặc ký hiệu đầu tiên của NDMapVN để chèn heatmap
 * Nằm trên các polygon nền đất/rừng nhưng nằm dưới toàn bộ đường sá, ranh giới và nhãn địa danh.
 */
function findFirstRoadLayerId(map: MapLibreMap): string | undefined {
  const style = map.getStyle();
  if (!style?.layers) return undefined;
  const roadLayer = style.layers.find((l) => /^(tunnel|highway|road|bridge)-/i.test(l.id));
  if (roadLayer) return roadLayer.id;
  const symbolLayer = style.layers.find((l) => l.type === "symbol");
  return symbolLayer?.id;
}


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
  const [gridSamples, setGridSamples] = useState<ForecastGridSample[]>([]);
  const gridSamplesRef = useRef<ForecastGridSample[]>(gridSamples);

  useEffect(() => {
    weatherStationsRef.current = weatherStations;
  }, [weatherStations]);

  useEffect(() => {
    gridSamplesRef.current = gridSamples;
  }, [gridSamples]);


  // Live Location Pings (Realtime fleet & citizens from Redis)
  const [liveLocations, setLiveLocations] = useState<LiveLocationPing[]>([]);
  const liveMarkersRef = useRef<Marker[]>([]);

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // MapLibre references
  const mapRef = useRef<MapLibreMap | null>(null);
  const temperatureShaderRef = useRef<TemperatureShaderLayer | null>(null);

  // Fetch live ECMWF weather (stations + grid samples) - Lưu cache 45 phút, không spam
  useEffect(() => {
    let active = true;
    async function loadWeather() {
      const [stationsData, gridData] = await Promise.all([
        fetchEcmwfWeatherData(),
        fetchEcmwfGridSamples(),
      ]);
      if (active) {
        setWeatherStations(stationsData);
        setGridSamples(gridData);
      }
    }
    loadWeather();
    return () => {
      active = false;
    };
  }, []);

  // Polling & Event listener for Live Locations (Redis)
  useEffect(() => {
    let active = true;
    async function refreshLivePings() {
      const pings = await fetchLiveLocations();
      if (active) setLiveLocations(pings);
    }
    refreshLivePings();

    const timer = window.setInterval(refreshLivePings, 8000);

    const onLivePing = () => {
      refreshLivePings();
    };
    window.addEventListener(BROADCAST_EVENT_NAME, onLivePing);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(BROADCAST_EVENT_NAME, onLivePing);
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
    (window as any)._mapInstance = map;

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current!);

    map.on("load", () => {
      if (!mounted) return;
      map.resize();
      applyVietnameseMapLabels(map);

      // 1. Tìm layer giao thông hoặc ký hiệu đầu tiên của NDMapVN để chèn heatmap bên dưới
      const firstRoadOrSymbolId = findFirstRoadLayerId(map);

      // 2. Thêm Custom WebGL Temperature Shader Layer (Continuous Surface Colorization)
      // Chèn TRƯỚC water-offset / water để biển và sông hồ vẽ đè lên nguyên bản 100% màu nước NDMapVN
      const currentLayers = map.getStyle()?.layers || [];
      const layerIdSet = new Set(currentLayers.map((l) => l.id));
      const waterInsertId = layerIdSet.has("water-offset")
        ? "water-offset"
        : (layerIdSet.has("water") ? "water" : firstRoadOrSymbolId);

      const shaderLayer = new TemperatureShaderLayer(true, 0.55);
      temperatureShaderRef.current = shaderLayer;
      shaderLayer.updateWeatherData(weatherStationsRef.current, gridSamplesRef.current);
      map.addLayer(shaderLayer as any, waterInsertId);

      // 3. Thêm nguồn GeoJSON nhiệt độ ECMWF-IFS (phục vụ tra cứu trạm quan trắc & lưới 79 điểm)
      map.addSource("om-weather", {
        type: "geojson",
        data: buildWeatherGeoJson(weatherStationsRef.current, gridSamplesRef.current),
      });

      // Lớp Heatmap cũ được giữ ẩn layout visibility="none" để tránh vẽ Gaussian blobs
      map.addLayer(
        {
          id: "om-temperature-heatmap",
          type: "heatmap",
          source: "om-weather",
          layout: { visibility: "none" },
          maxzoom: 14,
          // Chỉ render điểm có isLand === 1
          filter: ["==", ["get", "isLand"], 1],
          paint: {
            // Weight theo nhiệt độ thực tế (°C) từ ECMWF-IFS
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "temperature"],
              15, 0.20,
              22, 0.50,
              27, 0.80,
              32, 1.10,
              38, 1.40,
            ],
            // Intensity cân bằng để các điểm đất liền hòa vào nhau tự nhiên
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 0.9,
              5, 1.3,
              7, 1.7,
              10, 2.0,
            ],
            // Dải màu nhiệt độ chuẩn khí tượng:
            // 0 -> 0.08: trong suốt hoàn toàn -> cắt đứt quầng mờ loang ra biển
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,    "rgba(0, 0, 0, 0)",
              0.08, "rgba(0, 0, 0, 0)",          // Cắt rìa: không có quầng mờ loang ra biển
              0.18, "rgba(59, 130, 246, 0.22)",   // Lam mát
              0.38, "rgba(56, 189, 248, 0.35)",   // Xanh lơ nhạt
              0.55, "rgba(16, 185, 129, 0.45)",   // Xanh ngọc dịu
              0.72, "rgba(234, 179, 8, 0.52)",    // Vàng ấm dịu
              0.88, "rgba(249, 115, 22, 0.58)",   // Cam ấm
              1.0,  "rgba(239, 68, 68, 0.65)",    // Đỏ rực
            ],
            // Bán kính giới hạn gọn trong đất liền, không tràn rộng ra biển
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3, 16,
              5, 26,
              7, 40,
              10, 58,
              13, 75,
            ],
            // Opacity tổng thể: zoom 4-7 vừa vặn, zoom >= 10 mờ dần để đường phố rõ nét
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,  0.55,
              7,  0.48,
              10, 0.22,
              13, 0.05,
            ],
          },
        },
        firstRoadOrSymbolId // <-- CHÈN TRƯỚC HỆ THỐNG GIAO THÔNG VÀ SYMBOL CỦA NDMAPVN!
      );

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
          const id = event.features?.[0]?.properties?.id;
          if (!id) return;
          onSelectRef.current({ kind: layer.key, id: String(id) });
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

      // ── Tương tác không gian Native NDMapVN + In-Memory Administrative PIP ──
      // TUYỆT ĐỐI KHÔNG TẠO: lớp tương tác vô hình, invisible polygon hay canvas overlay
      const styleLayerIds = new Set(map.getStyle()?.layers?.map((l) => l.id) ?? []);
      const NDAMAPVN_NATIVE_LAYERS = [
        "landcover-island",
        "landcover-reef",
        "water",
        "water-offset",
        "place-island",
        "place-city-capital",
        "place-city",
        "place-town",
        "place-village",
        "water-name-ocean",
        "water-name-lakeline",
        "waterway-name",
      ];
      const interactiveNativeLayers = NDAMAPVN_NATIVE_LAYERS.filter((id) => styleLayerIds.has(id));

      const weatherPopup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: "ecmwf-hover-popup",
      });

      // Hàm giải quyết danh xưng địa lý theo thứ tự ưu tiên:
      // 1. Native NDMapVN feature (đảo, rạn san hô, vùng nước, nhãn địa danh bản địa)
      // 2. In-Memory Administrative Point-in-Polygon (64 đối tượng GeoJSON 2024 trong RAM)
      function resolveLocationIdentity(point: { x: number; y: number }, lngLat: { lng: number; lat: number }): {
        title: string;
        regionDesc: string;
      } | null {
        // A. Kiểm tra native feature của NDMapVN
        if (interactiveNativeLayers.length > 0) {
          const nativeFeats = map.queryRenderedFeatures([point.x, point.y], { layers: interactiveNativeLayers });
          if (nativeFeats.length > 0) {
            const nf = nativeFeats[0];
            const nName = (nf.properties?.name_vi || nf.properties?.name || nf.properties?.["name:vi"]) as string | undefined;
            if (nName) {
              return { title: nName, regionDesc: "Đối tượng bản địa NDMapVN" };
            }
            if (nf.layer.id === "landcover-island" || nf.layer.id === "landcover-reef") {
              return { title: "Hải đảo / Vùng rạn san hô", regionDesc: "Hải đảo Việt Nam (NDMapVN)" };
            }
          }
        }

        // B. Chạy In-Memory Administrative Resolver (Ray-Casting PIP)
        const adminRes = resolveAdministrativeLocation(lngLat.lng, lngLat.lat);
        if (adminRes.type === "province" && adminRes.province) {
          return { title: adminRes.province, regionDesc: `Tỉnh/Thành phố — Dữ liệu ECMWF-IFS 2026` };
        }
        if (adminRes.type === "boundary" && adminRes.candidates) {
          return {
            title: `Giáp ranh: ${adminRes.candidates[0]} – ${adminRes.candidates[1]}`,
            regionDesc: "Khu vực ranh giới tỉnh (Dung sai độ)",
          };
        }

        return null;
      }

      // ── Sự kiện mousemove với Throttling & requestAnimationFrame (60 FPS) ──
      let rafId: number | null = null;
      let lastMovePoint = { x: -999, y: -999 };

      map.on("mousemove", (e) => {
        if (Math.abs(e.point.x - lastMovePoint.x) < 4 && Math.abs(e.point.y - lastMovePoint.y) < 4) return;
        lastMovePoint = { x: e.point.x, y: e.point.y };

        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          // Bỏ qua nếu chuột đang hover vào thực thể nghiệp vụ VNDMS (sự cố, SOS, tuyến sơ tán)
          const vndmsFeats = map.queryRenderedFeatures(e.point, {
            layers: (map.getStyle()?.layers ?? [])
              .map((l) => l.id)
              .filter((id) => id.startsWith("om-") && id !== "om-temperature-heatmap"),
          });
          if (vndmsFeats.length > 0) {
            weatherPopup.remove();
            return;
          }

          const locationIdentity = resolveLocationIdentity(e.point, e.lngLat);
          if (!locationIdentity) {
            weatherPopup.remove();
            map.getCanvas().style.cursor = "";
            return;
          }

          map.getCanvas().style.cursor = "crosshair";

          // Tra cứu dữ liệu thời tiết ECMWF-IFS HOÀN TOÀN TỪ CACHE (Tuyệt đối không gọi API)
          const st = lookupWeatherFromCache(
            locationIdentity.title,
            [e.lngLat.lng, e.lngLat.lat],
            weatherStationsRef.current,
          );
          if (!st) return;

          const currentRisk = st.dailySummary?.[0]?.floodRiskLevel || "Bình thường";
          const riskColor =
            currentRisk === "Đặc biệt nghiêm trọng" ? "#ef4444" :
            currentRisk === "Nguy cơ cao" ? "#f97316" :
            currentRisk === "Cảnh báo" ? "#eab308" : "#22c55e";

          weatherPopup
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="weather-hover-card">
                <div class="weather-hover-head">
                  <span class="weather-hover-title">${locationIdentity.title}</span>
                  <span class="weather-hover-region">${locationIdentity.regionDesc}</span>
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
            `)
            .addTo(map);
        });
      });

      const onCanvasLeave = () => {
        if (rafId) cancelAnimationFrame(rafId);
        weatherPopup.remove();
        map.getCanvas().style.cursor = "";
      };
      map.getCanvas().addEventListener("mouseleave", onCanvasLeave);

      // Click vào vị trí bất kỳ: chỉ xử lý các entity VNDMS, không mở popup thời tiết
      map.on("click", (e) => {
        const vndmsFeats = map.queryRenderedFeatures(e.point, {
          layers: (map.getStyle()?.layers ?? [])
            .map((l) => l.id)
            .filter((id) => id.startsWith("om-") && id !== "om-temperature-heatmap"),
        });
        if (vndmsFeats.length > 0) return;
        // Không mở popup thời tiết khi click vào bản đồ (đã loại bỏ per yêu cầu)
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

    // Cập nhật dữ liệu trạm khí tượng & lưới dự báo khi fetch hoàn tất
    if (weatherStations.length > 0 || gridSamples.length > 0) {
      const weatherSource = map.getSource("om-weather") as GeoJSONSource | undefined;
      if (weatherSource) {
        weatherSource.setData(buildWeatherGeoJson(weatherStations, gridSamples));
      }
      temperatureShaderRef.current?.updateWeatherData(weatherStations, gridSamples);
    }
  }, [points, routes, ready, weatherStations, gridSamples]);

  // ── Shader nhiệt độ luôn bật (không có toggle) ──
  // temperatureShaderRef.current is initialized visible=true at startup

  // ── Sync Live Location Pings onto Map ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    // Xóa markers cũ
    liveMarkersRef.current.forEach((m) => m.remove());
    liveMarkersRef.current = [];

    // Vẽ markers mới
    liveLocations.forEach((ping) => {
      const el = document.createElement("div");
      el.className = `om-live-marker ${ping.isPanicSOS ? "panic-sos" : "live-beacon"}`;
      el.innerHTML = `
        <div class="om-live-pin-inner">
          <span class="om-live-pulse"></span>
          <div class="om-live-badge">
            <span class="om-live-role-tag">${ping.isPanicSOS ? "SOS KHẨN" : ping.name}</span>
          </div>
        </div>
      `;
      el.title = `${ping.isPanicSOS ? "[BÁO ĐỘNG 1 CHẠM] " : ""}${ping.name} (${ping.role})`;

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(`
        <div style="padding: 6px 10px; font-size: 12px; color: #0f172a; line-height: 1.4;">
          <b style="color: ${ping.isPanicSOS ? '#dc2626' : '#2563eb'}; display: block; font-size: 13px;">
            ${ping.isPanicSOS ? ' CẢNH BÁO 1 CHẠM (SOS)' : ' Tín hiệu định vị Realtime'}
          </b>
          <div><b>Họ tên:</b> ${ping.name}</div>
          <div><b>Vai trò:</b> ${ping.role}</div>
          ${ping.phone ? `<div><b>SĐT:</b> ${ping.phone}</div>` : ''}
          <div><b>Tọa độ:</b> ${ping.coordinates[1].toFixed(5)}, ${ping.coordinates[0].toFixed(5)}</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 4px;">Cập nhật: ${new Date(ping.timestamp).toLocaleTimeString()}</div>
        </div>
      `);

      const marker = new Marker({ element: el })
        .setLngLat(ping.coordinates)
        .setPopup(popup)
        .addTo(map);

      liveMarkersRef.current.push(marker);
    });
  }, [liveLocations, ready]);



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
