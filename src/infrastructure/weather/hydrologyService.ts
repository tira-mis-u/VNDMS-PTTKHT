/**
 * DỮ LIỆU THUỶ VĂN THỜI GIAN THỰC (mưa + dòng chảy sông)
 * ─────────────────────────────────────────────────────────────────────────
 * Ở Việt Nam phần lớn thiệt hại do thiên tai đến từ mưa lớn, lũ, lũ quét và
 * sạt lở chứ không phải gió. Trước đây VNDMS chỉ có dữ liệu khí tượng
 * (nhiệt độ, gió, khí áp) nên trang Tình hình thiên tai phải hiển thị dòng
 * "chưa có dữ liệu quan trắc". Module này lấp đúng khoảng trống đó bằng hai
 * nguồn mở, không cần khoá API:
 *
 *  1. Mưa — Open-Meteo Forecast API, mô hình ECMWF-IFS: lượng mưa từng giờ,
 *     lấy 1 ngày quá khứ + 3 ngày dự báo cho từng lưu vực.
 *  2. Dòng chảy sông — Open-Meteo Flood API (mô hình GloFAS của Copernicus):
 *     lưu lượng ngày (m³/s) cho 92 ngày quá khứ + 7 ngày dự báo, kèm biên
 *     trên của tổ hợp dự báo (ensemble max) để thể hiện độ bất định.
 *
 * GIỚI HẠN PHẢI NÓI RÕ: GloFAS cho *lưu lượng* (m³/s) chứ không cho *mực
 * nước* (m), nên hệ thống KHÔNG thể suy ra cấp báo động I/II/III theo quy
 * định — cấp báo động là ngưỡng mực nước do cơ quan KTTV công bố cho từng
 * trạm. Vì vậy ở đây chỉ so sánh lưu lượng hiện tại với trung bình nhiều
 * năm cùng kỳ và gọi đúng tên: "so với trung bình nhiều năm". Khi kết nối
 * được số liệu trạm thuỷ văn quốc gia thì thay nguồn tại đúng chỗ này.
 */

/** Điểm lấy dữ liệu: toạ độ đã dò để rơi đúng ô lưới sông của GloFAS. */
export const HYDRO_STATIONS: Array<{
  id: string;
  river: string;
  place: string;
  region: "Bắc Bộ" | "Bắc Trung Bộ" | "Nam Trung Bộ" | "Tây Nguyên" | "Nam Bộ";
  lat: number;
  lng: number;
}> = [
  { id: "HYD-DA-HB", river: "Sông Đà", place: "Hoà Bình", region: "Bắc Bộ", lat: 20.81, lng: 105.33 },
  { id: "HYD-THAO-YB", river: "Sông Thao", place: "Yên Bái", region: "Bắc Bộ", lat: 21.70, lng: 104.87 },
  { id: "HYD-LO-TQ", river: "Sông Lô", place: "Tuyên Quang", region: "Bắc Bộ", lat: 21.62, lng: 105.11 },
  { id: "HYD-HONG-HN", river: "Sông Hồng", place: "Hà Nội – Hưng Yên", region: "Bắc Bộ", lat: 20.84, lng: 105.86 },
  { id: "HYD-CAU-TN", river: "Sông Cầu", place: "Thái Nguyên – Bắc Ninh", region: "Bắc Bộ", lat: 21.40, lng: 105.95 },
  { id: "HYD-MA-TH", river: "Sông Mã", place: "Thanh Hoá", region: "Bắc Trung Bộ", lat: 19.75, lng: 105.85 },
  { id: "HYD-CA-NA", river: "Sông Cả", place: "Nghệ An", region: "Bắc Trung Bộ", lat: 18.70, lng: 105.70 },
  { id: "HYD-GIANH-QB", river: "Sông Gianh", place: "Quảng Bình", region: "Bắc Trung Bộ", lat: 17.70, lng: 106.45 },
  { id: "HYD-HUONG-HUE", river: "Sông Hương", place: "Huế", region: "Bắc Trung Bộ", lat: 16.60, lng: 107.55 },
  { id: "HYD-THUBON-QN", river: "Vu Gia – Thu Bồn", place: "Quảng Nam – Đà Nẵng", region: "Nam Trung Bộ", lat: 15.80, lng: 108.05 },
  { id: "HYD-BA-PY", river: "Sông Ba", place: "Phú Yên – Đắk Lắk", region: "Nam Trung Bộ", lat: 13.00, lng: 109.10 },
  { id: "HYD-DONGNAI-BH", river: "Sông Đồng Nai", place: "Đồng Nai – TP.HCM", region: "Nam Bộ", lat: 10.85, lng: 106.80 },
  { id: "HYD-MEKONG-TC", river: "Sông Tiền (Mekong)", place: "Tân Châu – An Giang", region: "Nam Bộ", lat: 10.80, lng: 105.24 },
];

/** Mức cảnh báo suy ra từ mưa và tỷ lệ lưu lượng so với trung bình nhiều năm. */
export type HydroLevel = "Bình thường" | "Cần theo dõi" | "Trên mức nền" | "Vượt xa mức nền";

export interface HydroStationReading {
  id: string;
  river: string;
  place: string;
  region: string;
  /** Tổng lượng mưa 24 giờ vừa qua (mm). */
  rain24h: number;
  /** Tổng lượng mưa dự báo 24 giờ tới (mm). */
  rainNext24h: number;
  /** Tổng lượng mưa dự báo 72 giờ tới (mm). */
  rainNext72h: number;
  /** Lưu lượng hôm nay (m³/s). */
  discharge: number;
  /** Trung vị lưu lượng 90 ngày gần nhất của chính lưu vực (m³/s). */
  baseline90d: number;
  /** Lưu lượng lớn nhất trong 7 ngày dự báo (m³/s). */
  dischargePeak: number;
  /** Ngày đạt đỉnh dự báo (ISO yyyy-mm-dd). */
  peakDate: string;
  /** Biên trên của tổ hợp dự báo trong 7 ngày (m³/s) — thể hiện độ bất định. */
  peakEnsembleMax: number;
  /** discharge / baseline90d; 1 nghĩa là đúng bằng mức nền 90 ngày. */
  ratio: number;
  /** Xu thế 3 ngày tới so với hôm nay. */
  trend: "Đang lên" | "Đang xuống" | "Ít biến đổi";
  level: HydroLevel;
}

export interface HydrologySnapshot {
  stations: HydroStationReading[];
  fetchedAt: string;
  source: "open-meteo" | "cache" | "unavailable";
  statusText: string;
  /** Cảnh báo ngắn gọn để đưa lên đầu trang, rỗng nếu không có gì bất thường. */
  highlights: string[];
}

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const FLOOD_ENDPOINT = "https://flood-api.open-meteo.com/v1/flood";
const CACHE_KEY = "vndms_hydrology_v1";
const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 14000;

let memoryCache: HydrologySnapshot | null = null;
let inflight: Promise<HydrologySnapshot> | null = null;
let cooldownUntil = 0;
const subscribers = new Set<(snapshot: HydrologySnapshot) => void>();

export function subscribeHydrology(fn: (snapshot: HydrologySnapshot) => void) {
  subscribers.add(fn);
  if (memoryCache) fn(memoryCache);
  return () => subscribers.delete(fn);
}

function publish(snapshot: HydrologySnapshot) {
  memoryCache = snapshot;
  subscribers.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* một subscriber lỗi không được chặn các subscriber còn lại */
    }
  });
}

function readSessionCache(): HydrologySnapshot | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: HydrologySnapshot };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return { ...parsed.data, source: "cache" };
  } catch {
    return null;
  }
}

function writeSessionCache(snapshot: HydrologySnapshot) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: snapshot }));
  } catch {
    /* hết quota thì bỏ qua, cache bộ nhớ vẫn dùng được */
  }
}

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 429) {
      cooldownUntil = Date.now() + 10 * 60 * 1000;
      throw new Error("rate-limited");
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (Number.isFinite(value) ? Number(value) : 0), 0);
}

function classify(rain24h: number, rainNext24h: number, ratio: number, surge: number): HydroLevel {
  // Ngưỡng mưa theo cách phân loại quen dùng trong bản tin KTTV:
  // mưa vừa 16–50mm/24h, mưa to 51–100mm/24h, mưa rất to >100mm/24h.
  // Ngưỡng dòng chảy so với mức nền 90 ngày của chính lưu vực đó.
  const heavyRain = Math.max(rain24h, rainNext24h);
  if (ratio >= 2 || heavyRain > 100 || surge >= 3) return "Vượt xa mức nền";
  if (ratio >= 1.5 || heavyRain > 50 || surge >= 2) return "Trên mức nền";
  if (ratio >= 1.2 || heavyRain > 16 || surge >= 1.5) return "Cần theo dõi";
  return "Bình thường";
}

export const HYDRO_LEVEL_TONE: Record<HydroLevel, string> = {
  "Bình thường": "#12b76a",
  "Cần theo dõi": "#eaaa08",
  "Trên mức nền": "#f79009",
  "Vượt xa mức nền": "#d92d20",
};

function unavailable(reason: string): HydrologySnapshot {
  return {
    stations: [],
    fetchedAt: new Date().toISOString(),
    source: "unavailable",
    statusText: reason,
    highlights: [],
  };
}

/**
 * Lấy dữ liệu mưa + dòng chảy cho toàn bộ lưu vực theo dõi.
 * Hai lời gọi mạng cho toàn bộ 13 điểm (Open-Meteo nhận danh sách toạ độ),
 * kết quả cache 30 phút cho cả phiên làm việc.
 */
export async function fetchHydrologyData(force = false): Promise<HydrologySnapshot> {
  if (!force) {
    if (memoryCache && Date.now() - Date.parse(memoryCache.fetchedAt) < CACHE_TTL_MS) return memoryCache;
    const cached = readSessionCache();
    if (cached) {
      publish(cached);
      return cached;
    }
    if (Date.now() < cooldownUntil) {
      const snapshot = unavailable("Nguồn dữ liệu thuỷ văn tạm thời giới hạn truy cập; sẽ thử lại sau ít phút.");
      publish(snapshot);
      return snapshot;
    }
  }
  if (inflight) return inflight;

  const lat = HYDRO_STATIONS.map((station) => station.lat).join(",");
  const lng = HYDRO_STATIONS.map((station) => station.lng).join(",");

  inflight = (async () => {
    try {
      const [rainRaw, floodRaw] = await Promise.all([
        getJson(
          `${FORECAST_ENDPOINT}?latitude=${lat}&longitude=${lng}` +
            `&hourly=precipitation&models=ecmwf_ifs&past_days=1&forecast_days=4&timezone=Asia%2FBangkok`,
        ),
        getJson(
          `${FLOOD_ENDPOINT}?latitude=${lat}&longitude=${lng}` +
            `&daily=river_discharge,river_discharge_max&past_days=92&forecast_days=7`,
        ),
      ]);

      const rainList = Array.isArray(rainRaw) ? rainRaw : [rainRaw];
      const floodList = Array.isArray(floodRaw) ? floodRaw : [floodRaw];

      const stations: HydroStationReading[] = HYDRO_STATIONS.map((station, index) => {
        const rain = rainList[index]?.hourly;
        const flood = floodList[index]?.daily;

        // Chuỗi giờ bắt đầu từ 00:00 hôm qua (past_days=1) theo giờ Việt Nam.
        const times: string[] = rain?.time ?? [];
        const values: number[] = rain?.precipitation ?? [];
        const nowIndex = (() => {
          const now = Date.now();
          for (let i = 0; i < times.length; i += 1) {
            if (Date.parse(`${times[i]}+07:00`) > now) return i;
          }
          return Math.max(0, times.length - 1);
        })();
        const rain24h = sum(values.slice(Math.max(0, nowIndex - 24), nowIndex));
        const rainNext24h = sum(values.slice(nowIndex, nowIndex + 24));
        const rainNext72h = sum(values.slice(nowIndex, nowIndex + 72));

        const dischargeSeries: number[] = (flood?.river_discharge ?? []).map((value: number | null) =>
          Number.isFinite(value) ? Number(value) : 0,
        );
        const ensembleMaxSeries: number[] = (flood?.river_discharge_max ?? []).map((value: number | null) =>
          Number.isFinite(value) ? Number(value) : 0,
        );
        const days: string[] = flood?.time ?? [];
        // Xác định hôm nay theo đúng chuỗi ngày trả về (chắc chắn hơn là suy
        // ra từ past_days), dự phòng bằng vị trí đầu tiên của khoảng dự báo.
        const todayKey = new Date().toLocaleDateString("en-CA");
        const matched = days.indexOf(todayKey);
        const todayIndex = matched >= 0 ? matched : Math.max(0, days.length - 7);
        const discharge = dischargeSeries[todayIndex] ?? 0;

        // Mốc nền: trung vị 90 ngày gần nhất của chính lưu vực — bền với
        // ngoại lai hơn trung bình cộng khi có đỉnh lũ đơn lẻ.
        const history = dischargeSeries.slice(Math.max(0, todayIndex - 90), todayIndex).filter((value) => value > 0);
        const sorted = [...history].sort((a, b) => a - b);
        const baseline90d = sorted.length ? sorted[Math.floor(sorted.length / 2)] : discharge;

        const forward = dischargeSeries.slice(todayIndex);
        const peak = forward.length ? Math.max(...forward) : discharge;
        const peakDate = days[todayIndex + forward.indexOf(peak)] ?? days[todayIndex] ?? "";
        const forwardEnsembleMax = ensembleMaxSeries.slice(todayIndex);
        const peakEnsembleMax = forwardEnsembleMax.length ? Math.max(...forwardEnsembleMax) : peak;
        const in3days = dischargeSeries[todayIndex + 3] ?? discharge;
        const ratio = baseline90d > 0 ? discharge / baseline90d : 1;
        const change = discharge > 0 ? (in3days - discharge) / discharge : 0;

        return {
          id: station.id,
          river: station.river,
          place: station.place,
          region: station.region,
          rain24h: Math.round(rain24h * 10) / 10,
          rainNext24h: Math.round(rainNext24h * 10) / 10,
          rainNext72h: Math.round(rainNext72h * 10) / 10,
          discharge: Math.round(discharge),
          baseline90d: Math.round(baseline90d),
          dischargePeak: Math.round(peak),
          peakDate,
          peakEnsembleMax: Math.round(peakEnsembleMax),
          ratio: Math.round(ratio * 100) / 100,
          trend: change > 0.15 ? "Đang lên" : change < -0.15 ? "Đang xuống" : "Ít biến đổi",
          // surge = đỉnh dự báo 7 ngày so với mức nền: bắt được trường hợp
          // hiện tại còn thấp nhưng mô hình báo lũ sắp về.
          level: classify(rain24h, rainNext24h, ratio, baseline90d > 0 ? peak / baseline90d : 1),
        };
      });

      const highlights = stations
        .filter((station) => station.level === "Vượt xa mức nền" || station.level === "Trên mức nền")
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3)
        .map(
          (station) =>
            `${station.river} (${station.place}): mưa 24h qua ${station.rain24h} mm, dự báo 72h tới ${station.rainNext72h} mm · ` +
            `lưu lượng ${station.discharge.toLocaleString("vi-VN")} m³/s = ${station.ratio.toFixed(1)}× mức nền 90 ngày · ` +
            `đỉnh dự báo ${station.dischargePeak.toLocaleString("vi-VN")} m³/s (${station.trend.toLowerCase()})`,
        );

      const snapshot: HydrologySnapshot = {
        stations,
        fetchedAt: new Date().toISOString(),
        source: "open-meteo",
        statusText: `Mưa ECMWF-IFS + dòng chảy GloFAS (Copernicus) · ${stations.length} lưu vực · cập nhật ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`,
        highlights,
      };
      writeSessionCache(snapshot);
      publish(snapshot);
      return snapshot;
    } catch (error) {
      const reason =
        error instanceof Error && error.message === "rate-limited"
          ? "Nguồn dữ liệu thuỷ văn đang giới hạn truy cập; hệ thống sẽ thử lại sau ít phút."
          : "Không kết nối được nguồn dữ liệu thuỷ văn. Hệ thống không hiển thị số liệu thay thế.";
      const snapshot = unavailable(reason);
      publish(snapshot);
      return snapshot;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
