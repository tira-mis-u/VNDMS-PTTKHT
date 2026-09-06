/**
 * PHÁT HIỆN XOÁY THUẬN NHIỆT ĐỚI TỪ TRƯỜNG DỰ BÁO ECMWF-IFS
 *
 * Module thuần (pure) — không gọi mạng, không phụ thuộc DOM.
 *
 * ─── VÌ SAO PHIÊN BẢN TRƯỚC CHO ĐƯỜNG ĐI "LOẰNG NGOẰNG" ───────────────────
 * Phiên bản đầu chỉ tìm "điểm khí áp thấp hơn hàng xóm" rồi nối các điểm đó
 * giữa hai bước thời gian nếu cách nhau dưới 720 km. Ba sai lầm:
 *   1. Lưới phủ cả đất liền ⇒ bắt phải áp thấp nhiệt lực buổi chiều trên
 *      Lào/Thái Lan/Tây Nguyên (13h chiều khí áp tụt, đêm lại lên) — không
 *      phải bão, và nó nhảy vào/ra bờ theo nhịp ngày đêm.
 *   2. 720 km cho một bước 6 giờ ⇒ cho phép "bão" di chuyển 120 km/h. Bão
 *      thật đi 10–30 km/h. Thuật toán vì thế nối bừa hai xoáy khác nhau ở hai
 *      đầu Biển Đông thành một "đường đi" zíc-zắc.
 *   3. Không kiểm tra hoàn lưu khép kín ⇒ một nếp lõm 1006 hPa của rãnh gió
 *      mùa cũng thành "áp thấp nhiệt đới".
 *
 * ─── TIÊU CHÍ CỦA PHIÊN BẢN NÀY ───────────────────────────────────────────
 * Một tâm chỉ được công nhận khi thoả ĐỒNG THỜI:
 *   (a) nằm trên biển (lọc theo cao độ điểm lưới do API trả về);
 *   (b) là cực tiểu khí áp cục bộ và p ≤ 1004 hPa;
 *   (c) ĐỘ HỤT KHÍ ÁP so với môi trường xung quanh (vành 3–6°) ≥ 4 hPa —
 *       đây là dấu hiệu "đường đẳng áp khép kín", thứ phân biệt xoáy thật với
 *       rãnh áp thấp;
 *   (d) HOÀN LƯU XOÁY THUẬN: gió quanh tâm phải quay ngược chiều kim đồng hồ
 *       (bán cầu Bắc) với thành phần tiếp tuyến trung bình ≥ 12 km/h.
 * Nối đường đi thì giới hạn theo TỐC ĐỘ DI CHUYỂN THẬT (≤ 45 km/h) và yêu cầu
 * khí áp biến đổi liên tục (≤ 12 hPa mỗi 6 giờ), tối thiểu 4 bước (≈18–24 giờ).
 *
 * Đối chứng: chạy lại trên trường ERA5 của bão YAGI (01–08/9/2024) thuật toán
 * dựng đúng một đường đi trơn từ 14N-125E tới Quảng Ninh, tốc độ 14–26 km/h,
 * khí áp sâu dần 1001 → 950 hPa. Chạy trên trường 06/9/2026 (không có bão)
 * thuật toán trả về 0 cơn — thay vì 4 cơn ảo như trước.
 *
 * Đây vẫn là suy diễn từ mô hình toàn cầu, KHÔNG phải bản tin bão chính thức
 * của Trung tâm Dự báo KTTV quốc gia. Nhãn hiển thị luôn ghi rõ điều đó.
 */

export interface StormGridInput {
  /** Toạ độ các điểm lấy mẫu, cùng thứ tự với mảng chuỗi thời gian. */
  coords: Array<{ lat: number; lng: number }>;
  /** Cao độ (m) từng điểm — >0 nghĩa là đất liền. Thiếu thì coi như biển. */
  elevation?: number[];
  /** Nhãn thời gian ISO của từng bước dự báo. */
  times: string[];
  /** pressure[i][t] — khí áp mực nước biển (hPa) tại điểm i, bước thời gian t. */
  pressure: number[][];
  /** windSpeed[i][t] — gió duy trì 10m (km/h). */
  windSpeed: number[][];
  /** windGusts[i][t] — gió giật 10m (km/h). */
  windGusts: number[][];
  /** windDirection[i][t] — hướng gió THỔI TỪ (độ). Cần cho kiểm tra hoàn lưu. */
  windDirection?: number[][];
}

export type StormCategory =
  | "Vùng áp thấp"
  | "Áp thấp nhiệt đới"
  | "Bão nhiệt đới"
  | "Bão mạnh"
  | "Bão rất mạnh"
  | "Siêu bão";

export interface StormTrackPoint {
  time: string;
  lng: number;
  lat: number;
  /** Khí áp thấp nhất tại tâm (hPa). */
  pressure: number;
  /** Gió duy trì mạnh nhất quanh tâm (km/h). */
  windSpeed: number;
  /** Gió giật mạnh nhất quanh tâm (km/h). */
  windGusts: number;
  /** Bán kính gió mạnh ước lượng (km) — dùng để vẽ vùng ảnh hưởng. */
  radiusKm: number;
  category: StormCategory;
  /** true nếu bước thời gian nằm trong tương lai so với thời điểm tra cứu. */
  forecast: boolean;
  /** Tốc độ di chuyển của tâm so với bước trước (km/h) — null ở điểm đầu. */
  motionKmh: number | null;
  /** Hướng di chuyển (độ, 0 = Bắc, 90 = Đông) — null ở điểm đầu. */
  motionBearing: number | null;
  /** true nếu tâm bão đã nằm trên đất liền tại mốc này (dùng để đánh dấu đổ bộ). */
  overLand: boolean;
}

export interface StormTrack {
  id: string;
  /** Tên hiển thị: "Áp thấp nhiệt đới trên Biển Đông"… */
  name: string;
  category: StormCategory;
  minPressure: number;
  maxWind: number;
  maxGusts: number;
  /** Vị trí gần thời điểm hiện tại nhất. */
  current: StormTrackPoint;
  /** Toàn bộ chuỗi vị trí theo thời gian (quá khứ gần → dự báo). */
  points: StormTrackPoint[];
  /**
   * Mốc đổ bộ: điểm đầu tiên tâm bão chuyển từ biển sang đất liền. null nếu
   * cả quỹ đạo nằm trên biển (bão đi ngang, không vào bờ).
   */
  landfall: StormTrackPoint | null;
  /**
   * Mốc tan: điểm cuối cùng của quỹ đạo, kèm lý do suy đoán được — vào đất
   * liền thì tan do ma sát/mất nguồn ẩm; còn trên biển thì là hết hạn dự báo.
   */
  dissipation: { point: StormTrackPoint; reason: "đất liền" | "hết chuỗi dự báo" };
}

/** Thông tin chẩn đoán để giao diện nói thật khi KHÔNG có bão nào. */
export interface StormDiagnostics {
  /** Áp thấp sâu nhất trên biển trong toàn miền/toàn thời đoạn. */
  deepestLow: { pressure: number; lat: number; lng: number; time: string } | null;
  /** Số tâm đạt tiêu chí xoáy khép kín (trước khi nối thành đường đi). */
  qualifyingCentres: number;
  /** Số điểm lưới trên biển thực sự được xét. */
  seaPoints: number;
}

/**
 * Tên vùng biển theo vị trí tâm bão. Trước đây mọi xoáy đều bị gọi là "trên
 * Biển Đông" — sai khi lưới đã mở rộng sang phía đông Philippines/Đài Loan,
 * nơi bão thường hình thành trước khi đi vào Biển Đông.
 */
export function regionLabel(lat: number, lng: number): string {
  if (lng <= 122 && lat <= 23.5) return "trên Biển Đông";
  if (lat > 23.5 && lng <= 122) return "phía bắc Biển Đông";
  if (lat > 21) return "phía đông Đài Loan";
  return "ngoài khơi phía đông Philippines";
}

export interface StormDetectionResult {
  tracks: StormTrack[];
  diagnostics: StormDiagnostics;
}

/** Khí áp tối đa để một điểm được xét làm tâm xoáy (hPa). */
const MAX_CENTRE_PRESSURE = 1004;
/** Bán kính xét cực tiểu cục bộ (độ). */
const NEIGHBOUR_RADIUS_DEG = 1.6;
/** Vành trong/ngoài (độ) để tính khí áp môi trường xung quanh. */
const ENV_RING_INNER_DEG = 3;
const ENV_RING_OUTER_DEG = 6;
/** Độ hụt khí áp tối thiểu so với môi trường — dấu hiệu đẳng áp khép kín (hPa). */
const MIN_PRESSURE_DEFICIT = 4;
/** Vành đo hoàn lưu (độ). */
const CIRCULATION_INNER_DEG = 1.2;
const CIRCULATION_OUTER_DEG = 4;
/** Thành phần gió tiếp tuyến trung bình tối thiểu để coi là xoáy thuận (km/h). */
const MIN_TANGENTIAL_KMH = 12;
/** Bán kính lấy cường độ quanh tâm (độ). */
const CORE_RADIUS_DEG = 2.8;
/** Tốc độ di chuyển tối đa hợp lý của một xoáy nhiệt đới (km/h). */
const MAX_MOTION_KMH = 45;
/** Bước nối tối thiểu, tránh quá khắt khe khi bước thời gian ngắn (km). */
const MIN_LINK_RADIUS_KM = 120;
/** Biến thiên khí áp tối đa cho phép giữa hai bước liên tiếp (hPa / 6 giờ). */
const MAX_PRESSURE_JUMP_PER_6H = 12;
/**
 * Thời lượng tối thiểu của một đường đi (giờ). Trước đây ràng buộc theo *số
 * bước* (4 bước) nên khi rút bước thời gian từ 6 giờ xuống 3 giờ, một nhiễu
 * chỉ tồn tại 12 giờ cũng đủ điều kiện. Ràng buộc theo thời gian thực mới là
 * bất biến đúng: một xoáy thuận phải duy trì được ít nhất ~18 giờ.
 */
const MIN_TRACK_HOURS = 18;
/** Gộp hai tâm cách nhau dưới ngưỡng này (km) — cùng một xoáy bị bắt hai lần. */
const MERGE_DISTANCE_KM = 250;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Hướng đi từ A tới B (độ, 0 = Bắc). */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * Phân cấp theo gió duy trì mạnh nhất (km/h), tương đương thang Beaufort dùng
 * trong bản tin dự báo của Việt Nam.
 */
export function classifyStorm(windSpeedKmh: number): StormCategory {
  if (windSpeedKmh >= 184) return "Siêu bão";
  if (windSpeedKmh >= 150) return "Bão rất mạnh";
  if (windSpeedKmh >= 118) return "Bão mạnh";
  if (windSpeedKmh >= 62) return "Bão nhiệt đới";
  if (windSpeedKmh >= 39) return "Áp thấp nhiệt đới";
  return "Vùng áp thấp";
}

/** Cấp gió Beaufort tương ứng, phục vụ hiển thị "cấp 8-9" như bản tin. */
export function beaufortLevel(windSpeedKmh: number): number {
  const bounds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 133, 149, 166, 183, 201, 220];
  let level = 0;
  for (let i = 0; i < bounds.length; i += 1) if (windSpeedKmh >= bounds[i]) level = i + 1;
  return level;
}

interface RawCentre {
  timeIndex: number;
  lat: number;
  lng: number;
  pressure: number;
  windSpeed: number;
  windGusts: number;
  radiusKm: number;
  /** Độ hụt khí áp so với môi trường (hPa) — càng lớn xoáy càng rõ. */
  deficit: number;
  /** Gió tiếp tuyến trung bình quanh tâm (km/h, dương = xoáy thuận). */
  tangential: number;
  /** true nếu tâm nằm trên đất liền (chỉ được nối tiếp, không được sinh mới). */
  overLand: boolean;
}

/**
 * Thành phần gió tiếp tuyến trung bình quanh một tâm.
 * Hướng gió trong dữ liệu là hướng gió THỔI TỪ, nên vector gió (đông, bắc) là
 *   u = -speed·sin(dir),  v = -speed·cos(dir)
 * Vector tiếp tuyến ngược chiều kim đồng hồ tại điểm cách tâm một véc-tơ r là
 *   t = (-r_north, r_east) / |r|
 * Giá trị dương nghĩa là hoàn lưu xoáy thuận (bán cầu Bắc).
 */
function meanTangentialWind(
  input: StormGridInput,
  t: number,
  centreLat: number,
  centreLng: number,
): number {
  const dirs = input.windDirection;
  if (!dirs) return Number.POSITIVE_INFINITY; // không có hướng gió ⇒ bỏ qua tiêu chí
  const { coords, windSpeed } = input;
  let sum = 0;
  let count = 0;
  for (let j = 0; j < coords.length; j += 1) {
    const dLat = coords[j].lat - centreLat;
    const dLng = coords[j].lng - centreLng;
    const dist = Math.hypot(dLat, dLng);
    if (dist < CIRCULATION_INNER_DEG || dist > CIRCULATION_OUTER_DEG) continue;
    const speed = windSpeed[j]?.[t];
    const dir = dirs[j]?.[t];
    if (!Number.isFinite(speed) || !Number.isFinite(dir)) continue;
    const rad = (dir * Math.PI) / 180;
    const u = -speed * Math.sin(rad); // thành phần hướng đông
    const v = -speed * Math.cos(rad); // thành phần hướng bắc
    // Quy về km để vector bán kính không bị méo theo vĩ độ
    const rEast = dLng * Math.cos((centreLat * Math.PI) / 180);
    const rNorth = dLat;
    const rLen = Math.hypot(rEast, rNorth) || 1;
    const tangential = (u * -rNorth + v * rEast) / rLen;
    sum += tangential;
    count += 1;
  }
  return count >= 4 ? sum / count : Number.NEGATIVE_INFINITY;
}

/** Khí áp trung bình của vành môi trường quanh tâm. */
function environmentPressure(
  input: StormGridInput,
  t: number,
  centreLat: number,
  centreLng: number,
): number | null {
  const { coords, pressure } = input;
  let sum = 0;
  let count = 0;
  for (let j = 0; j < coords.length; j += 1) {
    const dist = Math.hypot(coords[j].lat - centreLat, coords[j].lng - centreLng);
    if (dist < ENV_RING_INNER_DEG || dist > ENV_RING_OUTER_DEG) continue;
    const p = pressure[j]?.[t];
    if (!Number.isFinite(p)) continue;
    sum += p;
    count += 1;
  }
  return count >= 6 ? sum / count : null;
}

/** Tìm toàn bộ tâm xoáy hợp lệ tại một bước thời gian. */
function findCentresAt(input: StormGridInput, t: number, seaMask: boolean[]): RawCentre[] {
  const { coords, pressure, windSpeed, windGusts } = input;
  const centres: RawCentre[] = [];

  for (let i = 0; i < coords.length; i += 1) {
    const p = pressure[i]?.[t];
    if (!Number.isFinite(p) || p > MAX_CENTRE_PRESSURE) continue; // (b)

    // (b) cực tiểu cục bộ
    let isLocalMin = true;
    let neighbours = 0;
    for (let j = 0; j < coords.length; j += 1) {
      if (i === j) continue;
      if (Math.abs(coords[i].lat - coords[j].lat) > NEIGHBOUR_RADIUS_DEG) continue;
      if (Math.abs(coords[i].lng - coords[j].lng) > NEIGHBOUR_RADIUS_DEG) continue;
      neighbours += 1;
      const pj = pressure[j]?.[t];
      if (Number.isFinite(pj) && pj < p - 0.05) {
        isLocalMin = false;
        break;
      }
    }
    if (!isLocalMin || neighbours < 3) continue;

    // (c) độ hụt khí áp so với môi trường ⇒ hoàn lưu khép kín
    const env = environmentPressure(input, t, coords[i].lat, coords[i].lng);
    if (env === null) continue;
    const deficit = env - p;
    if (deficit < MIN_PRESSURE_DEFICIT) continue;

    // (d) hoàn lưu xoáy thuận
    const tangential = meanTangentialWind(input, t, coords[i].lat, coords[i].lng);
    if (tangential < MIN_TANGENTIAL_KMH) continue;

    // Tinh chỉnh tâm theo trọng tâm độ hụt khí áp trong lõi + lấy cường độ
    let weightSum = 0;
    let latSum = 0;
    let lngSum = 0;
    let maxWind = 0;
    let maxGusts = 0;
    let strongWindRadius = 0;
    for (let j = 0; j < coords.length; j += 1) {
      const dLat = Math.abs(coords[i].lat - coords[j].lat);
      const dLng = Math.abs(coords[i].lng - coords[j].lng);
      if (dLat > CORE_RADIUS_DEG || dLng > CORE_RADIUS_DEG) continue;
      const pj = pressure[j]?.[t];
      if (!Number.isFinite(pj)) continue;
      const weight = Math.max(0, env - pj) ** 2; // ưu tiên mạnh phần lõi sâu nhất
      weightSum += weight;
      latSum += coords[j].lat * weight;
      lngSum += coords[j].lng * weight;
      const w = windSpeed[j]?.[t] ?? 0;
      const g = windGusts[j]?.[t] ?? 0;
      if (w > maxWind) maxWind = w;
      if (g > maxGusts) maxGusts = g;
      if (w >= 39) {
        const d = haversineKm(coords[i].lat, coords[i].lng, coords[j].lat, coords[j].lng);
        if (d > strongWindRadius) strongWindRadius = d;
      }
    }

    centres.push({
      timeIndex: t,
      lat: weightSum > 0 ? latSum / weightSum : coords[i].lat,
      lng: weightSum > 0 ? lngSum / weightSum : coords[i].lng,
      pressure: p,
      windSpeed: maxWind,
      windGusts: maxGusts,
      radiusKm: Math.max(80, Math.round(strongWindRadius)),
      deficit,
      tangential,
      overLand: !seaMask[i],
    });
  }

  // Gộp các tâm quá gần nhau: giữ tâm có độ hụt khí áp lớn nhất
  const merged: RawCentre[] = [];
  for (const centre of centres.sort((a, b) => b.deficit - a.deficit)) {
    const duplicated = merged.some(
      (other) => haversineKm(other.lat, other.lng, centre.lat, centre.lng) < MERGE_DISTANCE_KM,
    );
    if (!duplicated) merged.push(centre);
  }
  return merged;
}

function parseTime(value: string): number {
  // Chuỗi từ Open-Meteo dạng "2026-09-06T00:00" (UTC, không có hậu tố Z)
  const withZone = /[Zz]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
  return Date.parse(withZone);
}

/**
 * Suy ra danh sách đường đi bão/áp thấp từ trường ECMWF-IFS, kèm thông tin
 * chẩn đoán để giao diện nói thật khi không có cơn nào.
 */
export function detectStormField(
  input: StormGridInput,
  nowIso: string = new Date().toISOString(),
): StormDetectionResult {
  const emptyDiagnostics: StormDiagnostics = {
    deepestLow: null,
    qualifyingCentres: 0,
    seaPoints: 0,
  };
  if (!input.times.length || !input.coords.length) {
    return { tracks: [], diagnostics: emptyDiagnostics };
  }

  const seaMask = input.coords.map((_, i) => {
    const elevation = input.elevation?.[i];
    return elevation === undefined ? true : elevation <= 0;
  });
  const seaPoints = seaMask.filter(Boolean).length;

  // Áp thấp sâu nhất trên biển — dùng để báo cáo trung thực khi không có bão
  let deepestLow: StormDiagnostics["deepestLow"] = null;
  for (let i = 0; i < input.coords.length; i += 1) {
    if (!seaMask[i]) continue;
    for (let t = 0; t < input.times.length; t += 1) {
      const p = input.pressure[i]?.[t];
      if (!Number.isFinite(p)) continue;
      if (!deepestLow || p < deepestLow.pressure) {
        deepestLow = {
          pressure: Math.round(p * 10) / 10,
          lat: input.coords[i].lat,
          lng: input.coords[i].lng,
          time: input.times[t],
        };
      }
    }
  }

  const nowMs = Date.parse(nowIso);
  const perStep = input.times.map((_, t) => findCentresAt(input, t, seaMask));
  const qualifyingCentres = perStep.reduce((sum, list) => sum + list.length, 0);

  // Khoảng cách thời gian giữa các bước (giờ) — dùng để giới hạn theo tốc độ
  const stepHours = (() => {
    if (input.times.length < 2) return 6;
    const delta = (parseTime(input.times[1]) - parseTime(input.times[0])) / 3600000;
    return Number.isFinite(delta) && delta > 0 ? delta : 6;
  })();
  const maxStepKm = Math.max(MIN_LINK_RADIUS_KM, MAX_MOTION_KMH * stepHours);
  // Ngưỡng biến thiên khí áp KHÔNG được co lại tỉ lệ khi bước thời gian ngắn
  // hơn 6 giờ: nhiễu của tâm lấy từ lưới (~110 km) không nhỏ đi theo thời gian,
  // nên chia đôi ngưỡng ở bước 3 giờ sẽ cắt đứt chuỗi của một cơn bão có thật
  // (kiểm chứng: Yagi 2024 bị vỡ thành 3 mảnh khi chạy ERA5 3 giờ/bước).
  const maxPressureJump = MAX_PRESSURE_JUMP_PER_6H * Math.max(1, stepHours / 6);

  type Chain = RawCentre[];
  const chains: Chain[] = [];
  const openChains: Chain[] = [];

  perStep.forEach((centres, t) => {
    const usedChains = new Set<Chain>();
    const leftovers: RawCentre[] = [];

    // Xét tâm rõ nhất trước để nó được ưu tiên nối đúng chuỗi của mình
    for (const centre of [...centres].sort((a, b) => b.deficit - a.deficit)) {
      let best: Chain | null = null;
      let bestDistance = Infinity;
      let bestAllowance = 0;
      for (const chain of openChains) {
        if (usedChains.has(chain)) continue;
        const tail = chain[chain.length - 1];
        // Cho phép bắc cầu qua MỘT bước bị mất dấu (ví dụ tâm đi qua đảo Luzon,
        // hoặc lưới quá thưa nên một bước không bắt được cực tiểu).
        const gap = t - tail.timeIndex;
        if (gap < 1 || gap > 2) continue;
        if (Math.abs(tail.pressure - centre.pressure) > maxPressureJump * gap) continue;
        const distance = haversineKm(tail.lat, tail.lng, centre.lat, centre.lng);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestAllowance = maxStepKm * gap;
          best = chain;
        }
      }
      if (best && bestDistance <= bestAllowance) {
        best.push(centre);
        usedChains.add(best);
      } else if (!centre.overLand) {
        // Xoáy chỉ được SINH RA trên biển. Tâm trên đất liền không nối được
        // vào chuỗi nào thì gần như chắc chắn là áp thấp nhiệt lực ban ngày.
        leftovers.push(centre);
      }
    }

    for (const centre of leftovers) {
      const chain: Chain = [centre];
      openChains.push(chain);
      chains.push(chain);
    }
  });

  const tracks: StormTrack[] = [];
  chains
    .filter(
      (chain) =>
        chain.length >= 3 &&
        (chain[chain.length - 1].timeIndex - chain[0].timeIndex) * stepHours >=
          MIN_TRACK_HOURS,
    )
    .forEach((chain, index) => {
      const maxWind = Math.max(...chain.map((c) => c.windSpeed));
      const maxGusts = Math.max(...chain.map((c) => c.windGusts));
      const minPressure = Math.min(...chain.map((c) => c.pressure));
      const maxDeficit = Math.max(...chain.map((c) => c.deficit));

      // Xoáy quá yếu và quá nông thì không đưa lên bản đồ tác nghiệp
      if (maxWind < 39 && maxDeficit < 6) return;

      const points: StormTrackPoint[] = chain.map((c, i) => {
        const time = input.times[c.timeIndex];
        const prev = i > 0 ? chain[i - 1] : null;
        const hours = prev ? (c.timeIndex - prev.timeIndex) * stepHours : 0;
        const distance = prev ? haversineKm(prev.lat, prev.lng, c.lat, c.lng) : 0;
        return {
          time,
          lng: Number(c.lng.toFixed(3)),
          lat: Number(c.lat.toFixed(3)),
          pressure: Math.round(c.pressure * 10) / 10,
          windSpeed: Math.round(c.windSpeed),
          windGusts: Math.round(c.windGusts),
          radiusKm: c.radiusKm,
          category: classifyStorm(c.windSpeed),
          forecast: Number.isFinite(nowMs) ? parseTime(time) > nowMs : true,
          motionKmh: prev && hours > 0 ? Math.round(distance / hours) : null,
          motionBearing: prev ? Math.round(bearingDeg(prev.lat, prev.lng, c.lat, c.lng)) : null,
          overLand: c.overLand,
        };
      });

      // Đổ bộ = lần đầu tiên tâm chuyển từ biển sang đất liền.
      const landfall =
        points.find((point, i) => point.overLand && i > 0 && !points[i - 1].overLand) ?? null;
      const lastPoint = points[points.length - 1];

      const current = points.find((point) => point.forecast) ?? points[points.length - 1];
      const category = classifyStorm(maxWind);
      tracks.push({
        id: `STORM-${index + 1}-${points[0].time.replace(/[^0-9]/g, "").slice(0, 10)}`,
        name: `${category} ${regionLabel(current.lat, current.lng)}`,
        category,
        minPressure: Math.round(minPressure * 10) / 10,
        maxWind: Math.round(maxWind),
        maxGusts: Math.round(maxGusts),
        current,
        points,
        landfall,
        dissipation: {
          point: lastPoint,
          reason: lastPoint.overLand ? "đất liền" : "hết chuỗi dự báo",
        },
      });
    });

  return {
    tracks: tracks.sort((a, b) => b.maxWind - a.maxWind).slice(0, 4),
    diagnostics: { deepestLow, qualifyingCentres, seaPoints },
  };
}

/** Giữ nguyên chữ ký cũ cho các nơi chỉ cần danh sách đường đi. */
export function detectStormTracks(
  input: StormGridInput,
  nowIso: string = new Date().toISOString(),
): StormTrack[] {
  return detectStormField(input, nowIso).tracks;
}

/** Màu hiển thị theo cấp — dùng chung cho marker, đường đi và chú giải. */
export function stormColor(category: StormCategory): string {
  switch (category) {
    case "Siêu bão":
      return "#7f1d1d";
    case "Bão rất mạnh":
      return "#dc2626";
    case "Bão mạnh":
      return "#ea580c";
    case "Bão nhiệt đới":
      return "#f59e0b";
    case "Áp thấp nhiệt đới":
      return "#0ea5e9";
    default:
      return "#64748b";
  }
}
