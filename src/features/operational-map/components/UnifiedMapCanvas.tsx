import { useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";

import { Maximize2, Minimize2, Minus, Plus, Scan } from "lucide-react";
import { ForecastTimeline } from "./ForecastTimeline";
import {
  getNdaMapBaseStyle,
  MAP_MIN_ZOOM,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  UNIFIED_MAP_LAYER_CONFIG,
  type UnifiedMapKind,
  type UnifiedMapPoint,
} from "@/application/map/unifiedMapQueries";
import {
  fetchEcmwfWeatherData,
  fetchEcmwfGridSamples,
  fetchEcmwfStormField,
  METEOROLOGICAL_STATIONS,
  type StationForecast,
  type ForecastGridSample,
  type StormFieldSnapshot,
} from "@/infrastructure/weather/ecmwfWeatherService";
import {
  stormColor,
  beaufortLevel,
  type StormTrack,
  type StormTrackPoint,
} from "@/infrastructure/weather/stormDetection";
import {
  WindParticleLayer,
  type WindSamplePoint,
} from "@/infrastructure/weather/windParticleLayer";
import { TemperatureShaderLayer } from "@/infrastructure/weather/temperatureShaderLayer";
import {
  fetchLiveLocations,
  BROADCAST_EVENT_NAME,
  type LiveLocationPing,
} from "@/infrastructure/redis/redisClient";

const DEFAULT_CENTER: [number, number] = [106.8, 16.2]; // Trung tâm toàn cảnh Việt Nam & biển đảo
const DEFAULT_ZOOM = 6.5;

/** Từ mức zoom này trở lên mới hiện tên cạnh icon marker realtime. */
const LIVE_LABEL_ZOOM = 11.5;

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;"
      : char === "<" ? "&lt;"
        : char === ">" ? "&gt;"
          : char === '"' ? "&quot;"
            : "&#39;",
  );
}

/** Phân loại marker realtime để chọn màu và biểu tượng. */
function liveMarkerVariant(ping: LiveLocationPing) {
  if (ping.isPanicSOS) return "panic-sos";
  if (ping.role === "rescue_unit") return "rescue-team";
  if (ping.role === "citizen") return "citizen";
  return "officer";
}

/**
 * Biểu tượng nhỏ (16px) vẽ bằng SVG nội tuyến — cảnh báo 1 chạm, đội cứu hộ,
 * công dân hoặc cán bộ chỉ huy. Kích thước giữ nhỏ để không che nhãn địa danh.
 */
function liveMarkerIcon(ping: LiveLocationPing) {
  const variant = liveMarkerVariant(ping);
  const open = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`;
  if (variant === "panic-sos")
    return `${open}<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
  if (variant === "rescue-team")
    return `${open}<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9"/><path d="m14.5 14.5 3.9 3.9"/><path d="m18.4 5.6-3.9 3.9"/><path d="m9.5 14.5-3.9 3.9"/></svg>`;
  if (variant === "citizen")
    return `${open}<path d="M19 21v-2a5 5 0 0 0-5-5h-4a5 5 0 0 0-5 5v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  return `${open}<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z"/></svg>`;
}

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

/* ──────────────────────────────────────────────────────────────
 * BÃO & ÁP THẤP NHIỆT ĐỚI (ECMWF-IFS)
 * Đường đi được vẽ như bản đồ thời tiết thật: đoạn đã qua nét liền, đoạn dự
 * báo nét đứt, các mốc 6 giờ là chấm tròn theo cấp gió, tâm bão là ký hiệu
 * xoáy tự quay.
 *
 * THANH MỐC DỰ BÁO (dưới bản đồ): kéo để xem trường gió và vị trí tâm bão tại
 * từng mốc 6 giờ trong 6 ngày tới. Đây là dữ liệu ECMWF-IFS thật ở đúng mốc
 * đó, không phải nội suy hoạt hình: mỗi nấc là một trường gió riêng do mô hình
 * dự báo. Nút chạy sẽ tự tua qua các mốc để thấy xu thế di chuyển.
 * ────────────────────────────────────────────────────────────── */

/** Nhãn giờ Việt Nam cho một mốc dự báo ISO của Open-Meteo (giờ UTC). */
function stormTimeLabel(isoUtc: string) {
  const parsed = new Date(`${isoUtc}Z`);
  if (Number.isNaN(parsed.getTime())) return isoUtc;
  return parsed.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Vị trí/cường độ của một cơn tại thời điểm bất kỳ.
 * Trùng mốc thì lấy nguyên; giữa hai mốc thì nội suy tuyến tính (tâm bão di
 * chuyển gần như đều giữa hai mốc 6 giờ nên sai số không đáng kể).
 * Ngoài khoảng tồn tại của cơn thì trả về null — không bịa vị trí.
 */
function stormPointAt(storm: StormTrack, targetIso: string) {
  const target = Date.parse(`${targetIso}Z`);
  const points = storm.points;
  if (!points.length || Number.isNaN(target)) return null;
  const first = Date.parse(`${points[0].time}Z`);
  const last = Date.parse(`${points[points.length - 1].time}Z`);
  if (target < first || target > last) return null;
  for (let i = 0; i < points.length; i += 1) {
    const t = Date.parse(`${points[i].time}Z`);
    if (t === target) return points[i];
    if (t > target && i > 0) {
      const prev = points[i - 1];
      const prevT = Date.parse(`${prev.time}Z`);
      const ratio = (target - prevT) / (t - prevT || 1);
      return {
        ...prev,
        lat: prev.lat + (points[i].lat - prev.lat) * ratio,
        lng: prev.lng + (points[i].lng - prev.lng) * ratio,
        pressure: Math.round((prev.pressure + (points[i].pressure - prev.pressure) * ratio) * 10) / 10,
        windSpeed: Math.round(prev.windSpeed + (points[i].windSpeed - prev.windSpeed) * ratio),
        windGusts: Math.round(prev.windGusts + (points[i].windGusts - prev.windGusts) * ratio),
        radiusKm: Math.round(prev.radiusKm + (points[i].radiusKm - prev.radiusKm) * ratio),
        time: targetIso,
      } as typeof prev;
    }
  }
  return points[points.length - 1];
}

function stormTrackLines(storms: StormTrack[], cutoffIso?: string) {
  const cutoff = cutoffIso ? Date.parse(`${cutoffIso}Z`) : null;
  const isPast = (point: { time: string; forecast: boolean }) =>
    cutoff === null ? !point.forecast : Date.parse(`${point.time}Z`) <= cutoff;
  const features = storms.flatMap((storm) => {
    const observed = storm.points.filter(isPast);
    const forecast = storm.points.filter((point) => !isPast(point));
    // Nối liền mạch: đoạn dự báo bắt đầu từ mốc quan trắc cuối cùng
    const forecastLine = observed.length
      ? [observed[observed.length - 1], ...forecast]
      : forecast;
    const colour = stormColor(storm.category);
    const lines: any[] = [];
    if (observed.length > 1)
      lines.push({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: observed.map((point) => [point.lng, point.lat]),
        },
        properties: { id: storm.id, phase: "observed", color: colour },
      });
    if (forecastLine.length > 1)
      lines.push({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: forecastLine.map((point) => [point.lng, point.lat]),
        },
        properties: { id: storm.id, phase: "forecast", color: colour },
      });
    return lines;
  });
  return { type: "FeatureCollection" as const, features };
}

function stormTrackPoints(storms: StormTrack[]) {
  return {
    type: "FeatureCollection" as const,
    features: storms.flatMap((storm) =>
      storm.points.map((point) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
        properties: {
          stormId: storm.id,
          stormName: storm.name,
          time: point.time,
          timeLabel: stormTimeLabel(point.time),
          pressure: point.pressure,
          windSpeed: point.windSpeed,
          windGusts: point.windGusts,
          category: point.category,
          beaufort: beaufortLevel(point.windSpeed),
          forecast: point.forecast ? 1 : 0,
          color: stormColor(point.category),
          radiusKm: point.radiusKm,
        },
      })),
    ),
  };
}


/**
 * Hai mốc quan trọng nhất của một cơn bão đối với người trực: **đổ bộ** và
 * **tan**. Trước đây quỹ đạo chỉ là một dãy chấm giống nhau nên người xem
 * không biết đâu là lúc bão vào bờ, đâu là lúc bão hết. Hai mốc này được vẽ
 * thành ký hiệu riêng kèm chữ.
 */
function stormMilestones(storms: StormTrack[]) {
  const features = storms.flatMap((storm) => {
    const items: Array<{
      point: StormTrackPoint;
      kind: "landfall" | "dissipation";
      label: string;
    }> = [];
    if (storm.landfall) {
      items.push({
        point: storm.landfall,
        kind: "landfall",
        label: `ĐỔ BỘ ${stormTimeLabel(storm.landfall.time)} · ${storm.landfall.pressure} hPa · gió ${storm.landfall.windSpeed} km/h`,
      });
    }
    const end = storm.dissipation.point;
    // Chỉ đánh dấu "tan" khi bão thật sự suy yếu/vào đất liền. Nếu chuỗi dự
    // báo hết trong khi bão còn mạnh thì nói đúng là "hết hạn dự báo".
    items.push({
      point: end,
      kind: "dissipation",
      label:
        storm.dissipation.reason === "đất liền"
          ? `TAN DẦN TRONG ĐẤT LIỀN ${stormTimeLabel(end.time)} · ${end.pressure} hPa`
          : `HẾT CHUỖI DỰ BÁO ${stormTimeLabel(end.time)} · ${end.pressure} hPa`,
    });
    return items.map((item) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [item.point.lng, item.point.lat],
      },
      properties: {
        stormId: storm.id,
        kind: item.kind,
        label: item.label,
        time: item.point.time,
        color: item.kind === "landfall" ? "#b91c1c" : "#475569",
      },
    }));
  });
  return { type: "FeatureCollection" as const, features };
}

/** Vòng tròn bán kính gió mạnh quanh tâm hiện tại (đa giác 64 đỉnh). */
function stormWindRadius(storms: StormTrack[], atIso?: string) {
  const features = storms.flatMap((storm) => {
    const point = atIso ? stormPointAt(storm, atIso) : storm.current;
    if (!point) return [];
    const { lng, lat, radiusKm } = point;
    const ring: Array<[number, number]> = [];
    for (let i = 0; i <= 64; i += 1) {
      const angle = (i / 64) * Math.PI * 2;
      const dLat = (radiusKm / 111) * Math.sin(angle);
      const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.cos(angle);
      ring.push([lng + dLng, lat + dLat]);
    }
    return [
      {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [ring] },
        properties: { id: storm.id, color: stormColor(storm.category) },
      },
    ];
  });
  return { type: "FeatureCollection" as const, features };
}

/** Ký hiệu xoáy thuận tự quay đặt tại tâm bão hiện tại. */
function stormCentreElement(storm: StormTrack, point = storm.current) {
  const colour = stormColor(point.category);
  const element = document.createElement("div");
  element.className = "om-storm-centre";
  element.style.setProperty("--storm-color", colour);
  element.title = `${storm.name} · ${stormTimeLabel(point.time)} · ${point.pressure} hPa · gió ${point.windSpeed} km/h (giật ${point.windGusts} km/h)${point.motionKmh ? ` · di chuyển ${point.motionKmh} km/h` : ""}`;
  element.innerHTML = `
    <span class="om-storm-halo" aria-hidden="true"></span>
    <svg class="om-storm-swirl" viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
      <path d="M24 24c0-8 6-13 14-13-3 4-3 8-6 11-2 2-5 2-8 2Z" fill="${colour}" opacity="0.92"/>
      <path d="M24 24c0 8-6 13-14 13 3-4 3-8 6-11 2-2 5-2 8-2Z" fill="${colour}" opacity="0.92"/>
      <circle cx="24" cy="24" r="3.4" fill="#ffffff"/>
    </svg>
  `;
  return element;
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
  focusKey,
  onSelect,
  focusTarget,
  compact = false,
  stormOverride = null,
  stormFocusKey = 0,
}: {
  points: UnifiedMapPoint[];
  /** Chế độ gọn (nhúng trong Trung tâm điều hành): ẩn thanh mốc dự báo. */
  compact?: boolean;
  /**
   * Trường bão thay thế trường dự báo đang chạy — dùng cho chế độ *xem lại bão
   * lịch sử* (tái phân tích ERA5). `null` = dùng dữ liệu dự báo trực tiếp.
   */
  stormOverride?: StormFieldSnapshot | null;
  /** Tăng key để yêu cầu bản đồ bay tới entity focus (deep-link/search). */
  focusKey: number;
  focusTarget: UnifiedMapPoint | null;
  onSelect: (ref: { kind: UnifiedMapKind; id: string }) => void;
  /** Tăng lên 1 để yêu cầu bản đồ bay tới cơn bão đang theo dõi. */
  stormFocusKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [weatherStations, setWeatherStations] = useState<StationForecast[]>([]);
  const weatherStationsRef = useRef<StationForecast[]>(weatherStations);
  const [gridSamples, setGridSamples] = useState<ForecastGridSample[]>([]);
  const gridSamplesRef = useRef<ForecastGridSample[]>(gridSamples);
  const [liveStormField, setLiveStormField] = useState<StormFieldSnapshot | null>(null);
  const stormField = stormOverride ?? liveStormField;
  const stormFieldRef = useRef<StormFieldSnapshot | null>(null);
  const stormMarkersRef = useRef<Marker[]>([]);
  const windLayerRef = useRef<WindParticleLayer | null>(null);
  /**
   * Thời điểm đang xem, tính bằng mốc thời gian tuyệt đối (ms UTC), `null` =
   * bám thời điểm hiện tại. Trước đây biến này là *chỉ số mốc mô hình* nên
   * người dùng chỉ nhảy được theo nấc 6 giờ; nay chọn được giờ bất kỳ và
   * trường gió/vị trí bão được nội suy giữa hai mốc mô hình gần nhất.
   */
  const [activeMs, setActiveMs] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  /**
   * Chế độ mở rộng: bản đồ chiếm trọn cửa sổ. Trong khung mặc định, phần đầu
   * trang + bộ lọc đã ăn mất ~300 px chiều cao; với màn hình laptop 13" thì
   * bản đồ còn quá ngắn để nhìn cả Biển Đông lẫn đồng bằng Bắc Bộ.
   */
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    stormFieldRef.current = stormField;
    setActiveMs(null); // dữ liệu mới về thì quay lại thời điểm hiện tại
  }, [stormField]);

  const frames = stormField?.frames ?? null;
  const currentFrame = stormField?.currentFrame ?? 0;
  const frameMsList = useMemo(
    () => (frames ? frames.times.map((time) => Date.parse(`${time}Z`)) : []),
    [frames],
  );
  const nowMs = frameMsList[currentFrame] ?? null;
  const activeInstantMs = activeMs ?? nowMs;
  const activeTime =
    activeInstantMs != null
      ? new Date(activeInstantMs).toISOString().slice(0, 16)
      : null;
  const isLiveFrame = activeMs === null || activeMs === nowMs;

  /**
   * Vị trí của thời điểm đang xem trong chuỗi mốc mô hình: hai mốc kẹp hai bên
   * và tỉ lệ nội suy. Dùng chung cho trường gió (nội suy vector u/v) — vị trí
   * tâm bão đã có hàm nội suy riêng theo thời gian thực.
   */
  const frameBracket = useMemo(() => {
    if (!frameMsList.length || activeInstantMs == null) return null;
    if (activeInstantMs <= frameMsList[0]) return { a: 0, b: 0, ratio: 0 };
    const last = frameMsList.length - 1;
    if (activeInstantMs >= frameMsList[last]) return { a: last, b: last, ratio: 0 };
    let index = 1;
    while (index < last && frameMsList[index] < activeInstantMs) index += 1;
    const prev = frameMsList[index - 1];
    const next = frameMsList[index];
    return {
      a: index - 1,
      b: index,
      ratio: next === prev ? 0 : (activeInstantMs - prev) / (next - prev),
    };
  }, [activeInstantMs, frameMsList]);

  // Chạy thời gian: mỗi nhịp tiến 1 giờ (mượt như Windy), hết dải thì quay về
  // thời điểm hiện tại.
  useEffect(() => {
    if (!playing || !frameMsList.length || nowMs == null) return;
    const first = frameMsList[0];
    const last = frameMsList[frameMsList.length - 1];
    const timer = window.setInterval(() => {
      setActiveMs((value) => {
        const next = (value ?? nowMs) + 3_600_000;
        return next > last ? Math.max(first, nowMs) : next;
      });
    }, 260);
    return () => window.clearInterval(timer);
  }, [playing, frameMsList, nowMs]);

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

  // Trường khí áp/gió Biển Đông: dò bão, áp thấp và cấp dữ liệu cho lớp hạt gió
  useEffect(() => {
    let active = true;
    fetchEcmwfStormField()
      .then((snapshot) => {
        if (active) setLiveStormField(snapshot);
      })
      .catch(() => undefined);
    // ECMWF-IFS chạy 2 lần/ngày; làm tươi mỗi 30 phút là đủ và vẫn dùng cache.
    const timer = window.setInterval(() => {
      fetchEcmwfStormField()
        .then((snapshot) => {
          if (active) setLiveStormField(snapshot);
        })
        .catch(() => undefined);
    }, 30 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Bật chế độ xem lại: bay tới khung chứa toàn bộ đường đi bão, nếu không
  // người dùng vẫn đang nhìn đất liền và tưởng là "không vẽ gì".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !stormOverride?.storms.length) return;
    const coords = stormOverride.storms.flatMap((storm) =>
      storm.points.map((point) => [point.lng, point.lat] as [number, number]),
    );
    if (coords.length < 2) return;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 90, maxZoom: 6.4, duration: 900 },
    );
  }, [ready, stormOverride]);

  // Đổi nguồn (dự báo trực tiếp ↔ xem lại ERA5): mốc đang chọn thuộc dải thời
  // gian cũ nên phải trả về mốc gốc, tránh trục thời gian báo "ngoài phạm vi".
  useEffect(() => {
    setActiveMs(null);
    setPlaying(false);
  }, [stormOverride]);

  // Mở rộng/thu gọn: MapLibre phải được báo kích thước đổi, và Esc phải thoát.
  useEffect(() => {
    const map = mapRef.current;
    const timer = window.setTimeout(() => map?.resize(), 220);
    if (!expanded) return () => window.clearTimeout(timer);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

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

      // ── Bão & áp thấp nhiệt đới ECMWF-IFS ──
      // Thứ tự chèn: vùng gió mạnh → đường đi → mốc 6 giờ → nhãn giờ.
      map.addSource("om-storm-radius", { type: "geojson", data: stormWindRadius([]) });
      map.addLayer({
        id: "om-storm-radius-fill",
        type: "fill",
        source: "om-storm-radius",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.1,
        },
      });
      map.addLayer({
        id: "om-storm-radius-line",
        type: "line",
        source: "om-storm-radius",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1,
          "line-opacity": 0.45,
          "line-dasharray": [3, 2],
        },
      });

      map.addSource("om-storm-track", { type: "geojson", data: stormTrackLines([]) });
      map.addLayer({
        id: "om-storm-track-observed",
        type: "line",
        source: "om-storm-track",
        filter: ["==", ["get", "phase"], "observed"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "om-storm-track-forecast",
        type: "line",
        source: "om-storm-track",
        filter: ["==", ["get", "phase"], "forecast"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.4,
          "line-opacity": 0.85,
          "line-dasharray": [1.6, 1.4],
        },
      });

      map.addSource("om-storm-milestones", {
        type: "geojson",
        data: stormMilestones([]),
      });
      map.addLayer({
        id: "om-storm-milestone-halo",
        type: "circle",
        source: "om-storm-milestones",
        paint: {
          "circle-radius": 11,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.16,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 1.4,
          "circle-stroke-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "om-storm-milestone-mark",
        type: "symbol",
        source: "om-storm-milestones",
        layout: {
          "text-field": ["case", ["==", ["get", "kind"], "landfall"], "▲", "✕"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.6,
        },
      });
      map.addLayer({
        id: "om-storm-milestone-label",
        type: "symbol",
        source: "om-storm-milestones",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10.5,
          "text-offset": [0, 1.7],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-optional": true,
          "text-max-width": 14,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      map.addSource("om-storm-points", { type: "geojson", data: stormTrackPoints([]) });
      map.addLayer({
        id: "om-storm-points-circle",
        type: "circle",
        source: "om-storm-points",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["get", "windSpeed"],
            20, 3.4,
            60, 4.6,
            120, 6.4,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
          "circle-opacity": ["case", ["==", ["get", "forecast"], 1], 0.9, 0.65],
        },
      });
      map.addLayer({
        id: "om-storm-points-label",
        type: "symbol",
        source: "om-storm-points",
        minzoom: 5.4,
        layout: {
          "text-field": ["get", "timeLabel"],
          "text-size": 10,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-optional": true,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#334155",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      // Lớp hạt gió động (Windy-like) nằm dưới toàn bộ ký hiệu tác nghiệp
      windLayerRef.current = new WindParticleLayer(map);

      setReady(true);
    });

    return () => {
      mounted = false;
      resizeObserver.disconnect();
      windLayerRef.current?.destroy();
      windLayerRef.current = null;
      stormMarkersRef.current.forEach((marker) => marker.remove());
      stormMarkersRef.current = [];
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

    // Cập nhật dữ liệu trạm khí tượng & lưới dự báo khi fetch hoàn tất
    if (weatherStations.length > 0 || gridSamples.length > 0) {
      const weatherSource = map.getSource("om-weather") as GeoJSONSource | undefined;
      if (weatherSource) {
        weatherSource.setData(buildWeatherGeoJson(weatherStations, gridSamples));
      }
      temperatureShaderRef.current?.updateWeatherData(weatherStations, gridSamples);
    }
  }, [points, ready, weatherStations, gridSamples]);

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
      el.className = `om-live-marker ${liveMarkerVariant(ping)}`;
      // Mặc định chỉ hiện icon nhỏ để không che nhãn tỉnh/thành phố hay quần
      // đảo; tên chỉ bung ra khi người dùng phóng to (xem LIVE_LABEL_ZOOM).
      el.innerHTML = `
        <span class="om-live-pulse" aria-hidden="true"></span>
        <span class="om-live-icon" aria-hidden="true">${liveMarkerIcon(ping)}</span>
        <span class="om-live-name">${escapeHtml(ping.isPanicSOS ? `SOS · ${ping.name}` : ping.name)}</span>
      `;
      el.title = `${ping.isPanicSOS ? "[BÁO ĐỘNG 1 CHẠM] " : ""}${ping.name} (${ping.role})`;

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(`
        <div style="padding: 6px 10px; font-size: 12px; color: #0f172a; line-height: 1.4;">
          <b style="color: ${ping.isPanicSOS ? '#dc2626' : '#2563eb'}; display: block; font-size: 13px;">
            ${ping.isPanicSOS ? ' CẢNH BÁO 1 CHẠM (SOS)' : ' Tín hiệu định vị Realtime'}
          </b>
          <div><b>Họ tên:</b> ${escapeHtml(ping.name)}</div>
          <div><b>Vai trò:</b> ${escapeHtml(ping.role)}</div>
          ${ping.phone ? `<div><b>SĐT:</b> ${escapeHtml(ping.phone)}</div>` : ''}
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

  // Ở chế độ gọn khung bản đồ thấp hơn nhiều so với trang đầy đủ, nên khung
  // nhìn mặc định (toàn quốc) rơi vào vùng không có đối tượng nào. Khi nhúng,
  // tự khớp khung nhìn vào đúng các đối tượng đang hiển thị.
  const compactFitted = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!compact || !ready || !map || compactFitted.current) return;
    if (points.length === 0) return;
    compactFitted.current = true;
    if (points.length === 1) {
      map.jumpTo({ center: points[0].coordinates, zoom: 9.5 });
      return;
    }
    const lngs = points.map((point) => point.coordinates[0]);
    const lats = points.map((point) => point.coordinates[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 40, maxZoom: 9.5, duration: 0 },
    );
  }, [compact, ready, points]);

  // ── Đồng bộ bão, đường đi và trường gió động ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const storms = stormField?.storms ?? [];
    // Vị trí từng cơn tại mốc đang xem (null nếu cơn chưa hình thành / đã tan)
    const stormsAtFrame = storms
      .map((storm) => ({ storm, point: activeTime ? stormPointAt(storm, activeTime) : storm.current }))
      .filter((entry): entry is { storm: StormTrack; point: NonNullable<typeof entry.point> } =>
        Boolean(entry.point),
      );

    (map.getSource("om-storm-track") as GeoJSONSource | undefined)?.setData(
      stormTrackLines(storms, activeTime ?? undefined),
    );
    (map.getSource("om-storm-points") as GeoJSONSource | undefined)?.setData(
      stormTrackPoints(storms),
    );
    (map.getSource("om-storm-radius") as GeoJSONSource | undefined)?.setData(
      stormWindRadius(storms, activeTime ?? undefined),
    );
    (map.getSource("om-storm-milestones") as GeoJSONSource | undefined)?.setData(
      stormMilestones(storms),
    );

    // Marker tâm bão (ký hiệu xoáy tự quay) tại mốc đang xem
    stormMarkersRef.current.forEach((marker) => marker.remove());
    stormMarkersRef.current = stormsAtFrame.map(({ storm, point }) =>
      new Marker({ element: stormCentreElement(storm, point) })
        .setLngLat([point.lng, point.lat])
        .addTo(map),
    );

    // Trường gió cho lớp hạt.
    // • Ở mốc hiện tại: trạm khí tượng + lưới đất liền + lưới biển (chi tiết nhất).
    // • Ở mốc tương lai: CHỈ dùng trường dự báo tại đúng mốc đó — không trộn số
    //   liệu quan trắc hiện tại vào, vì như thế là bịa một trường gió không có
    //   thật ở thời điểm tương lai.
    const frameSamples: WindSamplePoint[] = frames
      ? frames.points.map((point, i) => {
          const a = frameBracket?.a ?? 0;
          const b = frameBracket?.b ?? 0;
          const ratio = frameBracket?.ratio ?? 0;
          const speedA = frames.speed[a]?.[i] ?? 0;
          const dirA = frames.direction[a]?.[i] ?? 0;
          if (a === b || ratio === 0)
            return { lat: point.lat, lng: point.lng, windSpeed: speedA, windDirection: dirA };
          const speedB = frames.speed[b]?.[i] ?? 0;
          const dirB = frames.direction[b]?.[i] ?? 0;
          // Nội suy theo vector u/v: nội suy thẳng trên góc sẽ sai nặng khi
          // hướng gió vượt qua mốc 360° (ví dụ 350° và 10°).
          const rad = Math.PI / 180;
          const uA = -speedA * Math.sin(dirA * rad);
          const vA = -speedA * Math.cos(dirA * rad);
          const uB = -speedB * Math.sin(dirB * rad);
          const vB = -speedB * Math.cos(dirB * rad);
          const u = uA + (uB - uA) * ratio;
          const v = vA + (vB - vA) * ratio;
          return {
            lat: point.lat,
            lng: point.lng,
            windSpeed: Math.hypot(u, v),
            windDirection: (Math.atan2(-u, -v) / rad + 360) % 360,
          };
        })
      : (stormField?.marineWind ?? []).map((sample) => ({
          lat: sample.lat,
          lng: sample.lng,
          windSpeed: sample.windSpeed,
          windDirection: sample.windDirection,
        }));

    const samples: WindSamplePoint[] = isLiveFrame
      ? [
          ...weatherStations
            .filter((station) => Number.isFinite(station.current?.windDirection))
            .map((station) => ({
              lat: station.latitude,
              lng: station.longitude,
              windSpeed: station.current.windSpeed,
              windDirection: station.current.windDirection,
            })),
          ...gridSamples
            .filter((sample) => Number.isFinite(sample.windDirection))
            .map((sample) => ({
              lat: sample.lat,
              lng: sample.lng,
              windSpeed: sample.windSpeed,
              windDirection: sample.windDirection as number,
            })),
          ...frameSamples,
        ]
      : frameSamples;

    const stormsForField = stormsAtFrame.map(({ storm, point }) => ({ ...storm, current: point }));
    if (samples.length > 0) windLayerRef.current?.setField(samples, stormsForField);
  }, [
    ready,
    stormField,
    weatherStations,
    gridSamples,
    frames,
    frameBracket,
    activeTime,
    isLiveFrame,
  ]);

  // ── Tên đội cứu hộ / công dân chỉ hiện khi phóng to đủ gần ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const container = map.getContainer();
    const syncLabelVisibility = () => {
      container.classList.toggle(
        "om-live-labels-visible",
        map.getZoom() >= LIVE_LABEL_ZOOM,
      );
    };
    syncLabelVisibility();
    map.on("zoom", syncLabelVisibility);
    return () => {
      map.off("zoom", syncLabelVisibility);
    };
  }, [ready]);



  // Deep-link focus
  useEffect(() => {
    if (focusKey <= 0 || !focusTarget || !ready || !mapRef.current) return;
    mapRef.current.flyTo({
      center: focusTarget.coordinates,
      zoom: Math.max(mapRef.current.getZoom(), 12.2),
      duration: 700,
    });
  }, [focusKey, focusTarget, ready]);

  // Bay tới cơn bão khi người dùng bấm "Xem trên bản đồ" ở dải cảnh báo.
  useEffect(() => {
    const map = mapRef.current;
    if (stormFocusKey <= 0 || !ready || !map) return;
    const storms = stormFieldRef.current?.storms ?? [];
    if (!storms.length) return;
    const coords = storms.flatMap((storm) =>
      storm.points.map((point) => [point.lng, point.lat] as [number, number]),
    );
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, maxZoom: 6, duration: 900 },
    );
  }, [ready, stormFocusKey]);

  // Nhãn tóm tắt cơn bão tại mốc đang xem (nếu có)
  const activeStormLabel = (() => {
    const storms = stormField?.storms ?? [];
    if (!storms.length || !activeTime) return null;
    const parts = storms
      .map((storm) => {
        const point = stormPointAt(storm, activeTime);
        if (!point) return null;
        return `${storm.name}: ${point.lat.toFixed(1)}°N ${point.lng.toFixed(1)}°E · ${point.pressure} hPa · gió ${point.windSpeed} km/h`;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
    // Không có tâm bão tại mốc này: nói rõ là chưa hình thành hay đã tan,
    // thay vì một câu chung chung dễ gây hiểu nhầm.
    const firstTime = storms.reduce(
      (min, storm) => (storm.points[0] && storm.points[0].time < min ? storm.points[0].time : min),
      "9999",
    );
    const lastTime = storms.reduce((max, storm) => {
      const last = storm.points[storm.points.length - 1];
      return last && last.time > max ? last.time : max;
    }, "0000");
    if (activeTime < firstTime) return "Chưa hình thành tại mốc này";
    if (activeTime > lastTime) return "Đã tan / ngoài chuỗi dữ liệu tại mốc này";
    return "Không có tâm bão tại mốc này";
  })();

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

  const showTimeline =
    !compact && frames !== null && frameMsList.length > 1 && nowMs != null;

  return (
    <div
      className={`om-canvas-shell${showTimeline ? " has-timeline" : ""}${expanded ? " is-expanded" : ""}`}
    >
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
        {!compact && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Thu bản đồ về khung trang" : "Mở rộng bản đồ toàn cửa sổ"}
            title={expanded ? "Thu về khung trang (Esc)" : "Mở rộng toàn cửa sổ"}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        )}
      </div>
      </div>

      {/* Trục thời gian dự báo: NẰM DƯỚI bản đồ, không che địa hình */}
      {showTimeline && (
        <ForecastTimeline
          startMs={frameMsList[0]}
          endMs={frameMsList[frameMsList.length - 1]}
          nowMs={nowMs}
          valueMs={activeInstantMs ?? nowMs}
          modelTimesMs={frameMsList}
          playing={playing}
          onChange={(ms) => {
            setPlaying(false);
            setActiveMs(ms);
          }}
          onTogglePlay={() => setPlaying((value) => !value)}
          onReset={() => {
            setPlaying(false);
            setActiveMs(null);
          }}
          statusLabel={activeStormLabel}
          historical={stormOverride != null}
        />
      )}
    </div>
  );
}
