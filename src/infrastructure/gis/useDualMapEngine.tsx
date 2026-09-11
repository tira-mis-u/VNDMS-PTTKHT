/**
 * useDualMapEngine — Hook khởi tạo và quản lý bản đồ số NDAMapVN qua MapLibre.
 * Tái sử dụng thống nhất ở tất cả các component bản đồ nghiệp vụ.
 */
import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import {
  getNdaMapBaseStyle,
  MAP_MIN_ZOOM,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  nearestDetailWeather,
  type DetailWeather,
} from "@/infrastructure/weather/detailMapTemperature";

export type MapEngine = "google" | "maplibre";

interface DualMapOptions {
  /** Tọa độ trung tâm khởi tạo [lng, lat] */
  center: [number, number];
  zoom?: number;
  /** Prefix dùng cho map identifiers (legacy prop) */
  seaLabelPrefix?: string;
  /** Callback được gọi sau khi MapLibre load xong (onload) */
  onMapLibreLoad?: (map: MapLibreMap) => void;
  /** Callback legacy (no-op) */
  onGoogleMapsReady?: (map: any) => void;
}

export function useDualMapEngine(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: DualMapOptions,
) {
  const {
    center,
    zoom = 12,
    onMapLibreLoad,
  } = options;

  const [engine] = useState<MapEngine>("maplibre");
  const [ready, setReady] = useState(false);
  const mlMapRef = useRef<MapLibreMap | null>(null);
  const gmapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    const container = containerRef.current;

    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const map = new MapLibreMap({
      container,
      style: getNdaMapBaseStyle(theme),
      center,
      zoom,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mlMapRef.current = map;

    map.on("load", () => {
      if (!mounted) return;
      applyVietnameseMapLabels(map);
      setReady(true);
      onMapLibreLoad?.(map);
    });

    return () => {
      mounted = false;
      if (mlMapRef.current) {
        mlMapRef.current.remove();
        mlMapRef.current = null;
      }
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = (delta: number) => {
    if (mlMapRef.current) {
      mlMapRef.current.zoomTo((mlMapRef.current.getZoom() ?? zoom) + delta, { duration: 200 });
    }
  };

  const flyTo = (coords: [number, number], targetZoom?: number) => {
    if (mlMapRef.current) {
      mlMapRef.current.flyTo({ center: coords, zoom: targetZoom ?? zoom });
    }
  };

  return { engine, ready, mlMapRef, gmapRef, zoomBy, flyTo };
}

/**
 * Badge góc bản đồ: nguồn bản đồ + (nếu có tâm điểm) thời tiết trạm ECMWF
 * gần nhất, TẤT CẢ GỘP TRÊN CÙNG 1 DÒNG, cùng kiểu pill trắng — không dùng
 * huy hiệu neon rời che bản đồ.
 */
export function MapEngineBadge({
  weatherCenter,
}: {
  engine?: "google" | "maplibre" | null;
  /** Tâm điểm cần đọc thời tiết (bản đồ chi tiết SOS/Nhiệm vụ/Đội/Shelter). */
  weatherCenter?: [number, number];
}) {
  const [wx, setWx] = useState<DetailWeather | null>(null);
  const key = weatherCenter ? `${weatherCenter[0].toFixed(4)},${weatherCenter[1].toFixed(4)}` : "";

  useEffect(() => {
    if (!weatherCenter) {
      setWx(null);
      return;
    }
    let live = true;
    nearestDetailWeather(weatherCenter)
      .then((result) => {
        if (live) setWx(result);
      })
      .catch(() => {
        if (live) setWx(null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div style={{
      position: "absolute",
      top: "10px",
      left: "10px",
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(4px)",
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 600,
      color: "#334155",
      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      zIndex: 10,
      pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      Bản đồ số NDAMapVN
      {wx && (
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          {" "}· {wx.temperature.toFixed(1)}°C · {wx.rain.toFixed(1)} mm/h ·{" "}
          {wx.windSpeed.toFixed(0)} km/h · {wx.stationName}
        </span>
      )}
    </div>
  );
}
