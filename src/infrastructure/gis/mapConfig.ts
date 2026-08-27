import { setWorkerUrl, type Map as MapLibreMap } from "maplibre-gl";

// MapLibre Web Worker
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export function isNdaMapActive(): boolean {
  return true;
}

/**
 * Bản đồ số NDAMapVN: Luôn sử dụng style Day-v2 màu sắc tươi sáng,
 * rõ ràng (màu trắng / xanh biển / địa danh tiếng Việt sắc nét).
 */
export function getNdaMapBaseStyle(_theme: "light" | "dark" = "light"): string {
  const apiKey =
    (import.meta.env?.VITE_NDAMAPVN_API_KEY as string | undefined)?.trim() ||
    "fJOxWtyLIHec6Omr3ZXXre2MPpHLcPwn";
  const dayTileUrl =
    (import.meta.env?.VITE_NDAMAPVN_TILE_URL as string | undefined)?.trim() ||
    "https://maptiles.ndamaps.vn/styles/day-v2/style.json";

  return dayTileUrl.includes("?")
    ? `${dayTileUrl}&apikey=${encodeURIComponent(apiKey)}`
    : `${dayTileUrl}?apikey=${encodeURIComponent(apiKey)}`;
}

export const MAP_BASE_STYLE = getNdaMapBaseStyle();
export const MAP_MIN_ZOOM = 5.2;

/**
 * Áp dụng nhãn tiếng Việt & tối ưu hiển thị bản đồ NDAMaps
 */
export function applyVietnameseMapLabels(map: MapLibreMap) {
  let style: ReturnType<MapLibreMap["getStyle"]>;
  try {
    style = map.getStyle();
  } catch {
    return;
  }
  if (!style?.layers) return;

  // Xóa các lớp shield thừa nếu có
  for (const layer of style.layers) {
    if (/shield/i.test(layer.id)) {
      try {
        map.removeLayer(layer.id);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Giữ nguyên interface no-op cho các map components
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function addVietnamSeaLabels(_map: MapLibreMap, _prefix: string) {
  // NDAMaps đã tích hợp sẵn 100% nhãn địa danh Quần đảo Hoàng Sa & Trường Sa
  // trên vector tiles chính thức của bản đồ quốc gia.
}
