import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import { TemperatureShaderLayer } from "./temperatureShaderLayer";
import {
  fetchEcmwfGridSamples,
  fetchEcmwfWeatherData,
  type ForecastGridSample,
  type StationForecast,
} from "./ecmwfWeatherService";

/**
 * Nền nhiệt ECMWF dùng chung cho các bản đồ chi tiết (SOS / nhiệm vụ / đội /
 * điểm sơ tán): cùng một lớp shader, cùng một nguồn dữ liệu với Bản đồ tác
 * nghiệp nên màu nhiệt đồng nhất khắp hệ thống.
 *
 * Dữ liệu chỉ tải một lần cho mọi bản đồ (promise dùng chung); service thời
 * tiết tựFallback live → cache → dữ liệu đánh dấu nên không bao giờ treo.
 */
let sharedLoad: Promise<{
  stations: StationForecast[];
  grids: ForecastGridSample[];
}> | null = null;

function loadOnce() {
  if (!sharedLoad) {
    sharedLoad = (async () => {
      const [stations, grids] = await Promise.all([
        fetchEcmwfWeatherData().catch((): StationForecast[] => []),
        fetchEcmwfGridSamples().catch((): ForecastGridSample[] => []),
      ]);
      return { stations, grids };
    })();
  }
  return sharedLoad;
}

/**
 * Gắn nền nhiệt vào một maplibre map có sẵn. Trả về hàm cleanup để gỡ lớp
 * khi component unmount. Lớp được chèn dưới lớp nước/nhãn nền để không che
 * ký hiệu tác nghiệp (marker HTML luôn nằm trên canvas nên không bị ảnh hưởng).
 */
export function attachDetailMapTemperature(
  map: MapLibreMap,
  opacity = 0.5,
): () => void {
  const shader = new TemperatureShaderLayer(true, opacity);
  let cancelled = false;

  const add = () => {
    if (cancelled) return;
    try {
      if (map.getLayer(shader.id)) return;
      const layers = map.getStyle()?.layers ?? [];
      const ids = new Set(layers.map((layer) => layer.id));
      const before = ids.has("water-offset")
        ? "water-offset"
        : ids.has("water")
          ? "water"
          : (layers.find((layer) => layer.type === "symbol")?.id ?? undefined);
      map.addLayer(shader as never, before);
    } catch {
      // Style nền chưa sẵn: bỏ qua, dữ liệu nhiệt sẽ gắn khi map load xong.
      return;
    }
    loadOnce()
      .then(({ stations, grids }) => {
        if (!cancelled) shader.updateWeatherData(stations, grids);
      })
      .catch(() => {
        /* giữ nền nhiệt mặc định của shader */
      });
  };

  try {
    if (map.isStyleLoaded()) add();
    else map.once("load", add);
  } catch {
    /* map đã bị hủy */
  }

  return () => {
    cancelled = true;
    try {
      if (map.getLayer(shader.id)) map.removeLayer(shader.id);
    } catch {
      /* đã gỡ hoặc map đã hủy */
    }
  };
}

export interface DetailWeather {
  stationId: string;
  stationName: string;
  region: string;
  temperature: number;
  rain: number;
  windSpeed: number;
  distanceKm: number;
  isFallback: boolean;
}

function distanceKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const v =
    s1 * s1 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.max(0, v))));
}

/** Trạm ECMWF gần một điểm nhất (dùng chung promise tải với nền nhiệt). */
export async function nearestDetailWeather(
  center: [number, number],
): Promise<DetailWeather | null> {
  const { stations } = await loadOnce();
  let best: StationForecast | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const st of stations) {
    if (
      typeof st.longitude !== "number" ||
      typeof st.latitude !== "number" ||
      typeof st.current?.temperature !== "number" ||
      !Number.isFinite(st.current.temperature)
    )
      continue;
    const d = distanceKm(center[0], center[1], st.longitude, st.latitude);
    if (d < bestDist) {
      bestDist = d;
      best = st;
    }
  }
  if (!best) return null;
  return {
    stationId: best.stationId,
    stationName: best.stationName,
    region: best.region,
    temperature: best.current.temperature,
    rain: best.current.rain ?? 0,
    windSpeed: best.current.windSpeed ?? 0,
    distanceKm: bestDist,
    isFallback: (best as { source?: string }).source === "fallback",
  };
}

/** Màu pill theo nhiệt độ — cùng dải 18–34°C với chú giải Bản đồ tác nghiệp. */
function tempColor(temp: number): string {
  if (temp < 20) return "#2563eb";
  if (temp < 24) return "#0284c7";
  if (temp < 27) return "#059669";
  if (temp < 30) return "#ca8a04";
  if (temp < 32) return "#ea580c";
  return "#dc2626";
}

/**
 * Huy hiệu °C tại tối đa 3 trạm gần tâm bản đồ nhất. Trạm thưa nên ở mức zoom
 * chi tiết pill có thể nằm ngoài khung hình — dòng thời tiết gộp trong badge NDAMapVN (MapEngineBadge)
 * mới là đầu đọc chính; pill phục vụ khi thu nhỏ bản đồ.
 */
export function attachDetailMapStationPills(
  map: MapLibreMap,
  center: [number, number],
  maxPills = 3,
): () => void {
  let cancelled = false;
  const markers: Marker[] = [];
  loadOnce()
    .then(({ stations }) => {
      if (cancelled) return;
      const ranked = stations
        .filter(
          (st) =>
            typeof st.longitude === "number" &&
            typeof st.latitude === "number" &&
            typeof st.current?.temperature === "number" &&
            Number.isFinite(st.current.temperature),
        )
        .map((st) => ({
          st,
          d: distanceKm(center[0], center[1], st.longitude, st.latitude),
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, maxPills);
      for (const { st } of ranked) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "wx-temp-pill";
        el.style.setProperty("--wx-bg", tempColor(st.current.temperature));
        el.textContent = `${st.current.temperature.toFixed(0)}°`;
        el.title = `${st.stationName} — ${st.current.temperature.toFixed(1)}°C · Mưa ${st.current.rain.toFixed(1)} mm/h`;
        el.setAttribute("aria-label", el.title);
        const popup = new Popup({ offset: 14, closeButton: true }).setHTML(
          `<div style="padding:6px 10px;font-size:12px;color:#0f172a;line-height:1.5;min-width:170px">` +
            `<b style="font-size:13px">${st.stationName}</b><br/>` +
            `<span>Nhiệt độ: <b>${st.current.temperature.toFixed(1)}°C</b></span><br/>` +
            `<span>Mưa: <b>${st.current.rain.toFixed(1)} mm/h</b> · Gió: <b>${st.current.windSpeed.toFixed(0)} km/h</b></span><br/>` +
            `<span style="color:#64748b;font-size:11px">ECMWF-IFS · ${st.region}</span></div>`,
        );
        markers.push(
          new Marker({ element: el, anchor: "center" })
            .setLngLat([st.longitude, st.latitude])
            .setPopup(popup)
            .addTo(map),
        );
      }
    })
    .catch(() => {
      /* không có dữ liệu trạm: chỉ giữ nền nhiệt */
    });
  return () => {
    cancelled = true;
    markers.forEach((marker) => marker.remove());
  };
}
