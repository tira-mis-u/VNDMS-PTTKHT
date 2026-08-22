import type { Map as MapLibreMap } from "maplibre-gl";

export const MAP_BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const MAP_MIN_ZOOM = 3.2;

export const VIETNAM_SEA_LABELS = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [112.05, 16.45],
      },
      properties: { name: "Quần Đảo Hoàng Sa", kind: "island" },
    },
    {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [113.55, 8.75],
      },
      properties: { name: "Quần Đảo Trường Sa", kind: "island" },
    },
  ],
};

/**
 * Vùng khái quát hóa phạm vi hai quần đảo. Basemap nguồn mở (OpenFreeMap /
 * OpenStreetMap) lược bỏ các đảo nhỏ nên khi phóng to nhãn trông như "trôi
 * giữa biển"; vùng nét đứt này cho thấy khu vực quần đảo một cách hiển nhiên
 * là khái quát ở mọi mức zoom, thay vì chỉ có nhãn chữ trên mặt biển trống.
 */
const ellipseRing = (
  center: [number, number],
  radiusX: number,
  radiusY: number,
  steps = 72,
): [number, number][] => {
  const ring: [number, number][] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    ring.push([
      center[0] + Math.cos(angle) * radiusX,
      center[1] + Math.sin(angle) * radiusY,
    ]);
  }
  return ring;
};

export const VIETNAM_ISLAND_ZONES = {
  type: "FeatureCollection" as const,
  features: [
    // Hoàng Sa: phạm vi văn liệu ~15.000 km², kinh tuyến 111°Đ–113°Đ,
    // vĩ tuyến 15°45'B–17°05'B (hành chính VN/Wikipedia Paracel). Ellipse:
    // tâm 112°Đ/16°25'B, bán kính 1,0° kinh × 0,67° vĩ.
    {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [ellipseRing([112.0, 16.417], 1.0, 0.667)],
      },
      properties: { name: "Quần Đảo Hoàng Sa", kind: "island-zone" },
    },
    // Trường Sa: phạm vi văn liệu ~160.000–180.000 km², kinh tuyến 112°Đ–115°Đ,
    // vĩ tuyến 6°02'B–11°28'B. Ellipse: tâm 113°30'Đ/8°45'B, bán kính
    // 1,5° kinh × 2,72° vĩ.
    {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [ellipseRing([113.5, 8.75], 1.5, 2.72)],
      },
      properties: { name: "Quần Đảo Trường Sa", kind: "island-zone" },
    },
  ],
};

export const VIETNAMESE_LABEL_EXPRESSION = [
  "case",
  ["has", "name:vi"],
  ["get", "name:vi"],
  ["has", "name:en"],
  ["get", "name:en"],
  ["has", "name"],
  ["get", "name"],
  "",
] as never;

export function applyVietnameseMapLabels(map: MapLibreMap) {
  const pattern =
    /(place|country|state|city|town|village|water|ocean|sea|marine|label)/i;
  map.getStyle().layers.forEach((layer) => {
    if (
      layer.type !== "symbol" ||
      (!pattern.test(layer.id) && !JSON.stringify(layer).includes("name"))
    )
      return;
    try {
      map.setLayoutProperty(
        layer.id,
        "text-field",
        VIETNAMESE_LABEL_EXPRESSION,
      );
    } catch {
      // Symbol layer has no geographic name field.
    }
  });
}

/**
 * Cài đặt thống nhất cho mọi bản đồ tác nghiệp: vùng quần đảo khái quát
 * (nền cát + viền nét đứt), điểm neo và nhãn "Quần Đảo Hoàng Sa" /
 * "Quần Đảo Trường Sa". Gọi sau `applyVietnameseMapLabels` trong sự kiện
 * "load"; `prefix` giữ cho id source/layer không xung đột giữa các bản đồ.
 */
export function addVietnamSeaLabels(map: MapLibreMap, prefix: string) {
  const zonesSource = `${prefix}-vn-island-zones`;
  const labelsSource = `${prefix}-vn-sea-labels`;
  if (map.getSource(zonesSource) || map.getSource(labelsSource)) return;
  const firstSymbol = map
    .getStyle()
    .layers.find((layer) => layer.type === "symbol")?.id;
  map.addSource(zonesSource, { type: "geojson", data: VIETNAM_ISLAND_ZONES });
  map.addSource(labelsSource, { type: "geojson", data: VIETNAM_SEA_LABELS });
  map.addLayer(
    {
      id: `${zonesSource}-fill`,
      type: "fill",
      source: zonesSource,
      paint: {
        "fill-color": "#eae3ce",
        "fill-opacity": 0.3,
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: `${zonesSource}-outline`,
      type: "line",
      source: zonesSource,
      paint: {
        "line-color": "#a3966f",
        "line-width": 1.4,
        "line-dasharray": [2.6, 2],
      },
    },
    firstSymbol,
  );
  map.addLayer({
    id: `${labelsSource}-points`,
    type: "circle",
    source: labelsSource,
    paint: {
      "circle-radius": 3.2,
      "circle-color": "#a3966f",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.4,
    },
  });
  map.addLayer({
    id: labelsSource,
    type: "symbol",
    source: labelsSource,
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#1e3a5f",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.8,
    },
  });
}
