import { setWorkerUrl, type Map as MapLibreMap } from "maplibre-gl";

// Vite dev không luôn phân giải đúng worker sibling mặc định của MapLibre.
// Bundle worker thành asset module dùng chung để mọi source thực sự tải ở dev,
// production build và browser automation.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const MAP_BASE_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const MAP_MIN_ZOOM = 3.2;

export const VIETNAM_SEA_LABEL_PROVENANCE = {
  accessedAt: "2026-08-23",
  displayCrs: "EPSG:4326",
  geometryPolicy:
    "Chỉ dùng điểm neo địa danh; không suy diễn polygon, đường biên hoặc phạm vi chủ quyền.",
  officialMapCatalog: {
    title: "Dữ liệu bản đồ đảo khu vực Hoàng Sa – Trường Sa tỷ lệ 1/50.000",
    publisher:
      "Trung tâm Thông tin dữ liệu biển và hải đảo quốc gia, Bộ Tài nguyên và Môi trường",
    url: "https://opendata.monre.gov.vn/dataset/hoang-sa-tru-ng-sa-50-000",
    sourceCrs: "VN-2000",
    note: "Danh mục chính thức dùng để đối chiếu nguồn; ứng dụng không tự trích xuất polygon từ ảnh hoặc bảng chắp.",
  },
} as const;

/**
 * Điểm neo chỉ phục vụ đặt nhãn địa danh. Tọa độ lấy từ tọa độ DMS của đảo
 * cùng tên do cổng thông tin cơ quan nhà nước công bố, rồi đổi sang độ thập
 * phân bằng công thức độ + phút/60 + giây/3600. Không dùng các điểm này làm
 * tâm vùng, đường biên, extent hay geometry quần đảo.
 */
export const VIETNAM_SEA_LABELS = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        // Đảo Hoàng Sa: 16°32′00″B, 111°36′07″Đ.
        coordinates: [111.601944, 16.533333],
      },
      properties: {
        name: "Quần đảo Hoàng Sa",
        kind: "place-label",
        anchorFeature: "Đảo Hoàng Sa",
        sourceTitle: "UBND huyện Hoàng Sa",
        sourcePublisher: "Cổng thông tin điện tử thành phố Đà Nẵng",
        sourceUrl: "https://danang.gov.vn/vi/w/ubnd-huyen-hoang-sa-i",
        sourceCoordinate: "16°32′00″B, 111°36′07″Đ",
        sourceCrs: "Không nêu trên trang nguồn",
        displayCrs: "EPSG:4326",
        conversion: "DMS sang độ thập phân",
        accessedAt: "2026-08-23",
      },
    },
    {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        // Đảo Trường Sa: 8°38′30″B, 111°55′55″Đ.
        coordinates: [111.931944, 8.641667],
      },
      properties: {
        name: "Quần đảo Trường Sa",
        kind: "place-label",
        anchorFeature: "Đảo Trường Sa",
        sourceTitle: "Danh sách các đảo do Việt Nam kiểm soát ở quần đảo Trường Sa",
        sourcePublisher: "Cổng thông tin điện tử Công an tỉnh Hà Tĩnh",
        sourceUrl:
          "https://catphatinh.gov.vn/bai-viet/danh-sach-cac-dao-do-viet-nam-kiem-soat-o-quan-dao-truong-sa.catp",
        sourceCoordinate: "8°38′30″B, 111°55′55″Đ",
        sourceCrs: "Không nêu trên trang nguồn",
        displayCrs: "EPSG:4326",
        conversion: "DMS sang độ thập phân",
        accessedAt: "2026-08-23",
      },
    },
  ],
};

export const BASE_MAP_ISLAND_LABEL_ALIASES = [
  "Quần đảo Hoàng Sa",
  "Hoàng Sa",
  "Paracel Islands",
  "Paracel island",
  "Paracels",
  "Quần đảo Trường Sa",
  "Trường Sa",
  "Spratly Islands",
  "Spratly island",
  "Spratlys",
] as const;

const preferredGeographicName = [
  "case",
  ["has", "name:vi"],
  ["get", "name:vi"],
  // Không fallback sang name:en/name:latin/name:local: map vận hành phải giữ
  // contract tiếng Việt thay vì trộn English hoặc nhiều hệ chữ trong canvas.
  "",
];

/**
 * Ẩn nhãn nền trùng/khác anchor cho riêng hai quần đảo. Nhãn duy nhất được
 * phép hiển thị là lớp Point có provenance do `addVietnamSeaLabels` quản lý.
 * Việc này không thay đổi hoặc tạo geometry.
 */
export const VIETNAMESE_LABEL_EXPRESSION = [
  "case",
  [
    "in",
    preferredGeographicName,
    ["literal", BASE_MAP_ISLAND_LABEL_ALIASES],
  ],
  "",
  preferredGeographicName,
] as never;

/**
 * Màu chữ + halo chia sẻ cho mọi symbol layer của basemap. Lý do: openfreemap
 * positron để `text-color` mặc định rất nhạt (#000, #333, #666) với halo yếu
 * hoặc thiếu — kết quả các nhãn country/state/highway-shield hiển thị thành
 * "ô trắng" trên nền sáng ở mọi zoom (đặc biệt zoom cao). Đây là root cause
 * của white boxes chứ không phải lỗi glyph.
 */
const SHARED_TEXT_COLOR_LIGHT = "#1e3a5f";
const SHARED_TEXT_COLOR_DARK = "#e6ebf2";
const SHARED_HALO_COLOR_LIGHT = "#ffffff";
const SHARED_HALO_COLOR_DARK = "#17212d";
const SHARED_HALO_WIDTH = 1.6;

/**
 * Áp nhãn tiếng Việt cho mọi symbol layer có text-field của basemap và set lại
 * màu chữ + halo để text hiển thị rõ trên nền sáng và tối. Các nhãn archipelago
 * Việt Nam bị ẩn hoàn toàn để chỉ hiển thị text tại Point có nguồn do
 * `addVietnamSeaLabels` quản lý.
 *
 * Pattern được mở rộng để bao trùm mọi symbol layer có text-field (gồm cả
 * `highway-name-*`, `road_shield_*`, `airport`, `label_*`). Việc này sửa root
 * cause của "ô trắng" trên basemap openfreemap.
 */
export function applyVietnameseMapLabels(map: MapLibreMap) {
  const pattern =
    /(place|country|state|city|town|village|water|ocean|sea|marine|label|highway|shield|road|airport)/i;
  // Detect theme từ document để chọn palette text phù hợp với nền bản đồ.
  // Basemap positron đang dùng là light palette; basemap dark riêng (nếu có)
  // sẽ đảo ngược palette.
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const theme = root?.dataset?.theme === "dark" ? "dark" : "light";
  const textColor =
    theme === "dark" ? SHARED_TEXT_COLOR_DARK : SHARED_TEXT_COLOR_LIGHT;
  const haloColor =
    theme === "dark" ? SHARED_HALO_COLOR_DARK : SHARED_HALO_COLOR_LIGHT;
  for (const layer of map.getStyle().layers) {
    if (
      layer.type !== "symbol" ||
      (!pattern.test(layer.id) && !JSON.stringify(layer).includes("name"))
    )
      continue;
    // 1. Chuyển sang text-field tiếng Việt (không fallback English/Latin) và ẩn
    //    alias archipelago Việt Nam.
    try {
      map.setLayoutProperty(layer.id, "text-field", VIETNAMESE_LABEL_EXPRESSION);
    } catch {
      // Symbol layer có thể không có geographic name field.
    }
    // 2. Set màu chữ + halo đủ tương phản — đây là root cause fix cho "ô trắng"
    //    khi basemap để text-color mặc định rất nhạt trên nền sáng.
    try {
      map.setPaintProperty(layer.id, "text-color", textColor);
    } catch {
      // Layer có thể dùng case expression không chấp nhận paint override.
    }
    try {
      map.setPaintProperty(layer.id, "text-halo-color", haloColor);
    } catch {
      // Tương tự.
    }
    try {
      map.setPaintProperty(layer.id, "text-halo-width", SHARED_HALO_WIDTH);
    } catch {
      // Tương tự.
    }
  }
}

/**
 * Cài đặt thống nhất cho mọi bản đồ tác nghiệp: chỉ thêm nhãn địa danh
 * “Quần đảo Hoàng Sa” / “Quần đảo Trường Sa”. Không vẽ điểm neo, marker phụ,
 * ellipse, extent hay bất kỳ geometry ước lượng nào vì những ký hiệu đó có
 * thể bị hiểu nhầm là tâm hình học, đường biên hành chính hoặc phạm vi chủ
 * quyền. Gọi sau `applyVietnameseMapLabels` trong sự kiện "load"; `prefix` giữ
 * cho id source/layer không xung đột giữa các bản đồ.
 *
 * Placement theo nghĩa "text bám Point":
 *   - `text-anchor: "top"` cố định vị trí text phía trên Point.
 *   - Không dùng `text-radial-offset` / `text-offset` zoom-dependent: thuật
 *     toán collision của MapLibre xoay text quanh Point theo hướng trống và
 *     có thể đẩy chữ rời cụm (đặc biệt Trường Sa – trải dài Bắc–Nam – va
 *     chạm với Philippines ở nhiều zoom).
 *   - `text-ignore-placement: true` để text giữ vị trí tính theo Point kể
 *     cả khi có nhãn nền khác cùng toạ độ.
 *   - `text-optional: false` để nhãn địa danh luôn được render.
 */
export function addVietnamSeaLabels(map: MapLibreMap, prefix: string) {
  const labelsSource = `${prefix}-vn-sea-labels`;
  if (map.getSource(labelsSource)) return;
  map.addSource(labelsSource, { type: "geojson", data: VIETNAM_SEA_LABELS });
  map.addLayer({
    id: labelsSource,
    type: "symbol",
    source: labelsSource,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 12.5, 8, 13.5, 12, 14],
      "text-anchor": "top",
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-optional": false,
    },
    paint: {
      "text-color": "#1e3a5f",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.8,
    },
  });
}
