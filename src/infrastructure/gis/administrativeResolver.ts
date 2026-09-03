/**
 * Administrative Boundary Resolution Engine (Pure In-Memory Point-in-Polygon)
 *
 * SỬ DỤNG CHO DỮ LIỆU LỊCH SỬ NĂM 2024 (Historical 2024 Administrative Model):
 * - Tương thích với dữ liệu điều hành PCTT thảm họa bão Yagi 2024 (VNDMS seed data).
 * - Nạp GeoJSON 64 đối tượng vào bộ nhớ RAM (In-Memory).
 * - TUYỆT ĐỐI KHÔNG addSource / addLayer lên MapLibre.
 * - KHÔNG dùng Bounding Box để kết luận; BBox chỉ dùng để lọc ứng viên (pre-filter),
 *   sau đó BẮT BUỘC chạy thuật toán Ray-Casting Point-in-Polygon trên từng đỉnh tọa độ.
 * - KHÔNG dùng shapeISO làm unique ID (tránh xung đột mã VN-43 giữa Côn Đảo và Bà Rịa–Vũng Tàu).
 *   Sử dụng shapeID duy nhất của từng Feature.
 * - Dung sai ranh giới (border tolerance) là dung sai xấp xỉ theo tọa độ độ thập phân (degree tolerance).
 */

import geojsonData from "../../data/gis/geoBoundaries-VNM-ADM1_simplified.json" with { type: "json" };

export interface AdministrativeResolution {
  type: "province" | "boundary" | "none";
  province?: string;
  shapeId?: string;
  candidates?: [string, string];
  confidence: "exact" | "boundary" | "none";
}

interface IndexedProvince {
  shapeId: string;
  name: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any[];
  };
}

// Dung sai xấp xỉ theo tọa độ độ thập phân (~0.008° tương đương khoảng cách nhỏ tùy vĩ độ)
export const BORDER_TOLERANCE_DEG = 0.008;

// Ray-casting kiểm tra điểm nằm trong 1 vòng khép kín (linear ring)
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Kiểm tra điểm nằm trong Polygon (vòng ngoài và trừ đi các lỗ hổng bên trong nếu có)
function pointInPolygon(x: number, y: number, coords: number[][][]): boolean {
  if (!pointInRing(x, y, coords[0])) return false;
  for (let h = 1; h < coords.length; h++) {
    if (pointInRing(x, y, coords[h])) return false; // Nằm trong lỗ hổng => bên ngoài
  }
  return true;
}

// Kiểm tra điểm nằm trong MultiPolygon
function pointInMultiPolygon(x: number, y: number, multiCoords: number[][][][]): boolean {
  for (let i = 0; i < multiCoords.length; i++) {
    if (pointInPolygon(x, y, multiCoords[i])) return true;
  }
  return false;
}

// Khoảng cách bình phương nhỏ nhất từ điểm tới đoạn thẳng (theo tọa độ độ)
function distSqToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const qdx = px - qx;
  const qdy = py - qy;
  return qdx * qdx + qdy * qdy;
}

// Khoảng cách nhỏ nhất từ điểm tới đường viền polygon (theo tọa độ độ)
function minDistanceToEdges(px: number, py: number, geometry: IndexedProvince["geometry"]): number {
  let minDistSq = Infinity;

  const checkRing = (ring: number[][]) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d2 = distSqToSegment(px, py, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
      if (d2 < minDistSq) minDistSq = d2;
    }
  };

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(checkRing);
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((poly) => poly.forEach(checkRing));
  }
  return Math.sqrt(minDistSq);
}

// Chuẩn hóa tên địa phương tiếng Việt chuẩn
function normalizeProvinceName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed === "Ho Chi Minh") return "TP. Hồ Chí Minh";
  if (trimmed === "Ha Noi\t" || trimmed === "Ha Noi") return "Hà Nội";
  return trimmed;
}

// Khởi tạo chỉ mục In-Memory từ dữ liệu GeoJSON 2024
const indexedProvinces: IndexedProvince[] = ((geojsonData as any).features || []).map((f: any) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const expand = (coords: any) => {
    if (typeof coords[0] === "number") {
      const x = coords[0];
      const y = coords[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else {
      coords.forEach(expand);
    }
  };

  expand(f.geometry.coordinates);

  return {
    shapeId: f.properties.shapeID, // Dùng shapeID duy nhất, không dùng shapeISO
    name: normalizeProvinceName(f.properties.shapeName),
    bbox: [minX, minY, maxX, maxY],
    geometry: f.geometry,
  };
});

// Cache kết quả tra cứu gần nhất để tối ưu mousemove (< 0.005ms)
let lastLng = NaN;
let lastLat = NaN;
let lastResult: AdministrativeResolution = { type: "none", confidence: "none" };

/**
 * Xác định đơn vị hành chính từ tọa độ [lng, lat] (Point-in-Polygon hoàn toàn trong RAM).
 * Tuyệt đối không query bất kỳ layer bản đồ ngoài nào.
 */
export function resolveAdministrativeLocation(lng: number, lat: number): AdministrativeResolution {
  // 1. Kiểm tra cache nếu chuột di chuyển khoảng cách cực nhỏ (< 0.0002° ~ 20m)
  if (!Number.isNaN(lastLng) && Math.abs(lng - lastLng) < 0.0002 && Math.abs(lat - lastLat) < 0.0002) {
    return lastResult;
  }

  // 2. Lọc ứng viên bằng Bounding Box (BBox chỉ đóng vai trò lọc thô, KHÔNG kết luận)
  const candidates = indexedProvinces.filter(
    (p) =>
      lng >= p.bbox[0] - BORDER_TOLERANCE_DEG &&
      lng <= p.bbox[2] + BORDER_TOLERANCE_DEG &&
      lat >= p.bbox[1] - BORDER_TOLERANCE_DEG &&
      lat <= p.bbox[3] + BORDER_TOLERANCE_DEG,
  );

  if (candidates.length === 0) {
    lastLng = lng;
    lastLat = lat;
    lastResult = { type: "none", confidence: "none" };
    return lastResult;
  }

  // 3. Chạy thuật toán Ray-Casting Point-in-Polygon trên từng ứng viên
  const inside: IndexedProvince[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const isInside =
      cand.geometry.type === "Polygon"
        ? pointInPolygon(lng, lat, cand.geometry.coordinates)
        : pointInMultiPolygon(lng, lat, cand.geometry.coordinates);
    if (isInside) inside.push(cand);
  }

  // 4. Phân tích kết quả và kiểm tra dung sai ranh giới (border tolerance)
  if (inside.length === 1) {
    const p = inside[0];
    const distToEdge = minDistanceToEdges(lng, lat, p.geometry);

    // Nếu điểm nằm gần đường biên hơn mức dung sai, tìm tỉnh láng giềng sát vách
    if (distToEdge < BORDER_TOLERANCE_DEG) {
      const neighbor = candidates.find(
        (c) => c.shapeId !== p.shapeId && minDistanceToEdges(lng, lat, c.geometry) < BORDER_TOLERANCE_DEG,
      );
      if (neighbor) {
        lastLng = lng;
        lastLat = lat;
        lastResult = {
          type: "boundary",
          candidates: [p.name, neighbor.name],
          confidence: "boundary",
        };
        return lastResult;
      }
    }

    lastLng = lng;
    lastLat = lat;
    lastResult = {
      type: "province",
      province: p.name,
      shapeId: p.shapeId,
      confidence: "exact",
    };
    return lastResult;
  }

  // Nếu điểm nằm đúng trên ranh giới chung giữa 2 polygon
  if (inside.length >= 2) {
    lastLng = lng;
    lastLat = lat;
    lastResult = {
      type: "boundary",
      candidates: [inside[0].name, inside[1].name],
      confidence: "boundary",
    };
    return lastResult;
  }

  // Điểm nằm ngoài tất cả polygon nhưng sát đường biên giới giữa 2 tỉnh
  const nearBorder = candidates.filter((c) => minDistanceToEdges(lng, lat, c.geometry) < BORDER_TOLERANCE_DEG);
  if (nearBorder.length >= 2) {
    lastLng = lng;
    lastLat = lat;
    lastResult = {
      type: "boundary",
      candidates: [nearBorder[0].name, nearBorder[1].name],
      confidence: "boundary",
    };
    return lastResult;
  }

  lastLng = lng;
  lastLat = lat;
  lastResult = { type: "none", confidence: "none" };
  return lastResult;
}
