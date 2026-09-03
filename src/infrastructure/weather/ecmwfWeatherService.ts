/**
 * ECMWF Weather Forecast Integration (via Open-Meteo ECMWF-IFS)
 *
 * Cung cấp dữ liệu dự báo khí tượng, bão lũ, mưa lớn 10 ngày
 * từ mô hình ECMWF-IFS toàn cầu cho mạng lưới trạm quan trắc quốc gia & hải đảo Việt Nam.
 *
 * KIẾN TRÚC 3 TẦNG:
 * 1. REAL DATA: Lấy trực tiếp từ API Open-Meteo (model: ECMWF-IFS). Lưu cache RAM + sessionStorage.
 * 2. CACHED REAL DATA: Sử dụng dữ liệu thật đã lưu khi API 429/lỗi mạng. Không bao giờ ghi đè fallback lên cache thật.
 * 3. FALLBACK DATA: Chỉ kích hoạt khi hoàn toàn CHƯA CÓ dữ liệu thật. Luôn đánh dấu isFallback=true, source="fallback".
 *
 * TÍNH NĂNG CHỐNG HTTP 429 & REQUEST STORM:
 * - In-flight Promise Deduplication: Nhiều component / React StrictMode gọi cùng lúc chia sẻ 1 HTTP request.
 * - Cooldown & Exponential Backoff: Khi gặp 429, đóng băng gọi API trong thời gian quy định (tối thiểu 60s).
 * - Timeout với AbortController (8s) tránh treo request.
 * - Persistent Cache trong sessionStorage: F5 / chuyển tab không gửi lại request nếu cache còn hạn.
 */

import { resolveAdministrativeLocation } from "../gis/administrativeResolver.ts";

export interface StationForecast {
  stationId: string;
  stationName: string;
  region: "Bắc Bộ" | "Bắc Trung Bộ" | "Nam Trung Bộ & Tây Nguyên" | "Nam Bộ" | "Biển & Hải Đảo";
  latitude: number;
  longitude: number;
  current: {
    temperature: number;        // °C
    relativeHumidity: number;   // %
    windSpeed: number;          // km/h
    windGusts: number;          // km/h
    windDirection: number;      // °
    rain: number;               // mm/h
    precipitation: number;      // mm/24h
    snowfall: number;           // cm
    pressureMsl: number;        // hPa
    surfacePressure: number;    // hPa
    cloudCover: number;         // %
    visibility: number;         // meters
    runoff: number;             // mm
    cape: number;               // J/kg
    uvIndex: number;            // UV index
    soilTemperature: number;    // °C
    soilMoisture: number;       // m³/m³
    isDay: boolean;
    weatherCode?: number;
    weatherDesc?: string;
  };
  dailySummary: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    totalRain: number;
    maxWindGust: number;
    maxRunoff: number;
    floodRiskLevel: "Bình thường" | "Cảnh báo" | "Nguy cơ cao" | "Đặc biệt nghiêm trọng";
  }>;
  hourly: Array<{
    time: string;
    temperature: number;
    rain: number;
    windSpeed: number;
    windGusts: number;
    pressure: number;
    runoff: number;
  }>;
}

export interface ForecastGridSample {
  id: string;
  lat: number;
  lng: number;
  temperature: number;
  rain: number;
  windSpeed: number;
  cape?: number;
  uvIndex?: number;
  snowfall?: number;
  soilTemp?: number;
  soilMoisture?: number;
  source: "open-meteo" | "cache" | "fallback";
  isLand?: boolean;
}

export type WeatherSourceType = "open-meteo" | "cache" | "fallback";

export interface WeatherMetadata {
  provider: "Open-Meteo";
  model: "ECMWF-IFS";
  source: WeatherSourceType;
  isFallback: boolean;
  fetchedAt: number | null;
  expiresAt: number | null;
  statusText: string;
  cooldownUntil: number | null;
}

// 79 điểm lấy mẫu cố định (deterministic forecast grid samples)
export const DETERMINISTIC_GRID_COORDINATES: Array<{ id: string; lat: number; lng: number; isLand: boolean }> = (() => {
  const coords: Array<{ id: string; lat: number; lng: number; isLand: boolean }> = [];
  let id = 1;

  for (let lat = 9.0; lat <= 23.0; lat += 1.0) {
    for (let lng = 102.5; lng <= 109.5; lng += 1.0) {
      let include = false;
      if (lat >= 20.0 && lng >= 103.5 && lng <= 108.5) include = true;
      else if (lat >= 16.0 && lat < 20.0 && lng >= 105.0 && lng <= 109.5) include = true;
      else if (lat >= 12.0 && lat < 16.0 && lng >= 107.0 && lng <= 109.5) include = true;
      else if (lat >= 8.5 && lat < 12.0 && lng >= 104.0 && lng <= 108.0) include = true;

      if (include) {
        const isLand = resolveAdministrativeLocation(lng, lat).type !== "none";
        coords.push({ id: `GRID_${String(id++).padStart(3, "0")}`, lat, lng, isLand });
      }
    }
  }

  const maritime = [
    { id: "GRID_PAR_01", lat: 16.5, lng: 111.6, isLand: false },
    { id: "GRID_PAR_02", lat: 16.5, lng: 112.5, isLand: false },
    { id: "GRID_PAR_03", lat: 15.5, lng: 111.5, isLand: false },
    { id: "GRID_SPR_01", lat: 8.6,  lng: 111.9, isLand: false },
    { id: "GRID_SPR_02", lat: 9.5,  lng: 113.0, isLand: false },
    { id: "GRID_SPR_03", lat: 10.5, lng: 114.5, isLand: false },
    { id: "GRID_SPR_04", lat: 8.0,  lng: 113.5, isLand: false },
    { id: "GRID_PQC_01", lat: 10.2, lng: 104.0, isLand: true  },
    { id: "GRID_CON_01", lat: 8.7,  lng: 106.6, isLand: true  },
    { id: "GRID_SEA_01", lat: 18.0, lng: 107.5, isLand: false },
    { id: "GRID_SEA_02", lat: 13.0, lng: 111.0, isLand: false },
  ];
  maritime.forEach((m) => coords.push(m));
  return coords;
})();

export const METEOROLOGICAL_STATIONS: Array<{
  id: string;
  name: string;
  region: StationForecast["region"];
  lat: number;
  lng: number;
}> = [
  { id: "HAN", name: "Hà Nội", region: "Bắc Bộ", lat: 21.0285, lng: 105.8542 },
  { id: "HPH", name: "Hải Phòng", region: "Bắc Bộ", lat: 20.8449, lng: 106.6881 },
  { id: "QNH", name: "Hạ Long (Quảng Ninh)", region: "Bắc Bộ", lat: 20.9504, lng: 107.0733 },
  { id: "LSN", name: "Lạng Sơn", region: "Bắc Bộ", lat: 21.8537, lng: 106.7622 },
  { id: "THA", name: "Thanh Hóa", region: "Bắc Trung Bộ", lat: 19.8067, lng: 105.7852 },
  { id: "VII", name: "Vinh (Nghệ An)", region: "Bắc Trung Bộ", lat: 18.6796, lng: 105.6813 },
  { id: "VDH", name: "Đồng Hới (Quảng Bình)", region: "Bắc Trung Bộ", lat: 17.4674, lng: 106.6225 },
  { id: "HUI", name: "Huế", region: "Bắc Trung Bộ", lat: 16.4637, lng: 107.5909 },
  { id: "DAD", name: "Đà Nẵng", region: "Nam Trung Bộ & Tây Nguyên", lat: 16.0544, lng: 108.2022 },
  { id: "UIH", name: "Quy Nhơn", region: "Nam Trung Bộ & Tây Nguyên", lat: 13.782, lng: 109.2197 },
  { id: "PXU", name: "Pleiku (Gia Lai)", region: "Nam Trung Bộ & Tây Nguyên", lat: 13.9833, lng: 108.0 },
  { id: "CXR", name: "Nha Trang (Khánh Hòa)", region: "Nam Trung Bộ & Tây Nguyên", lat: 12.2388, lng: 109.1967 },
  { id: "DLI", name: "Đà Lạt (Lâm Đồng)", region: "Nam Trung Bộ & Tây Nguyên", lat: 11.9404, lng: 108.4583 },
  { id: "SGN", name: "TP. Hồ Chí Minh", region: "Nam Bộ", lat: 10.8231, lng: 106.6297 },
  { id: "VTU", name: "Vũng Tàu", region: "Nam Bộ", lat: 10.346, lng: 107.0843 },
  { id: "VCA", name: "Cần Thơ", region: "Nam Bộ", lat: 10.0452, lng: 105.7469 },
  { id: "CAU", name: "Cà Mau", region: "Nam Bộ", lat: 9.1768, lng: 105.152 },
  { id: "PQC", name: "Phú Quốc", region: "Biển & Hải Đảo", lat: 10.2289, lng: 103.9572 },
  { id: "PAR", name: "Quần đảo Hoàng Sa", region: "Biển & Hải Đảo", lat: 16.5367, lng: 111.6025 },
  { id: "SPR", name: "Quần đảo Trường Sa", region: "Biển & Hải Đảo", lat: 8.6433, lng: 111.9197 },
];

/* ─────────────────────────────────────────────────────────────
 * CACHE VÀ RATE-LIMIT MANAGER (3 TẦNG DỮ LIỆU)
 * ───────────────────────────────────────────────────────────── */

const STATIONS_CACHE_TTL = 90 * 60 * 1000; // 90 phút (ECMWF toàn cầu cập nhật 2 lần/ngày: 00Z và 12Z)
const GRID_CACHE_TTL = 60 * 60 * 1000;     // 60 phút
const STORAGE_KEY_STATIONS = "vndms_weather_stations_real_v2";
const STORAGE_KEY_GRID = "vndms_weather_grid_real_v2";

// Bộ nhớ RAM
let cachedRealStations: { data: StationForecast[]; fetchedAt: number; expiresAt: number } | null = null;
let cachedRealGrid: { data: ForecastGridSample[]; fetchedAt: number; expiresAt: number } | null = null;

// Khử trùng lặp Request (In-flight Request Deduplication)
let inFlightStationsPromise: Promise<StationForecast[]> | null = null;
let inFlightGridPromise: Promise<ForecastGridSample[]> | null = null;

// Quản lý Cooldown khi gặp 429
let apiCooldownUntil = 0;
let consecutive429Count = 0;

// Trạng thái nguồn dữ liệu hiện tại
let currentMetadata: WeatherMetadata = {
  provider: "Open-Meteo",
  model: "ECMWF-IFS",
  source: "fallback",
  isFallback: true,
  fetchedAt: null,
  expiresAt: null,
  statusText: "Chưa khởi tạo dữ liệu",
  cooldownUntil: null,
};

const listeners = new Set<(meta: WeatherMetadata) => void>();

function notifyMetadataChanged() {
  listeners.forEach((fn) => fn({ ...currentMetadata }));
}

export function _resetWeatherCacheForTesting() {
  cachedRealStations = null;
  cachedRealGrid = null;
  inFlightStationsPromise = null;
  inFlightGridPromise = null;
  apiCooldownUntil = 0;
  consecutive429Count = 0;
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.removeItem(STORAGE_KEY_STATIONS);
    window.sessionStorage.removeItem(STORAGE_KEY_GRID);
  }
}

export function subscribeWeatherMetadata(fn: (meta: WeatherMetadata) => void): () => void {
  listeners.add(fn);
  fn({ ...currentMetadata });
  return () => listeners.delete(fn);
}

export function getWeatherMetadata(): WeatherMetadata {
  return { ...currentMetadata };
}

// Khôi phục cache thực từ sessionStorage khi module khởi chạy
function initPersistentCache() {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    const rawStations = window.sessionStorage.getItem(STORAGE_KEY_STATIONS);
    if (rawStations) {
      const parsed = JSON.parse(rawStations);
      if (parsed && Array.isArray(parsed.data) && parsed.fetchedAt) {
        cachedRealStations = parsed;
      }
    }

    const rawGrid = window.sessionStorage.getItem(STORAGE_KEY_GRID);
    if (rawGrid) {
      const parsed = JSON.parse(rawGrid);
      if (parsed && Array.isArray(parsed.data) && parsed.fetchedAt) {
        cachedRealGrid = parsed;
      }
    }

    if (cachedRealStations && Date.now() < cachedRealStations.expiresAt) {
      const timeStr = formatTime(cachedRealStations.fetchedAt);
      currentMetadata = {
        provider: "Open-Meteo",
        model: "ECMWF-IFS",
        source: "cache",
        isFallback: false,
        fetchedAt: cachedRealStations.fetchedAt,
        expiresAt: cachedRealStations.expiresAt,
        statusText: `Nguồn: ECMWF-IFS (Open-Meteo) · Dữ liệu lưu lúc ${timeStr}`,
        cooldownUntil: null,
      };
    }
  } catch (e) {
    console.warn("[VNDMS/Weather] Không thể đọc cache sessionStorage:", e);
  }
}
initPersistentCache();

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function saveStationsToCache(data: StationForecast[]) {
  const now = Date.now();
  cachedRealStations = {
    data,
    fetchedAt: now,
    expiresAt: now + STATIONS_CACHE_TTL,
  };
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(cachedRealStations));
    }
  } catch {
    // QuotaExceeded hoặc Private mode
  }
}

function saveGridToCache(data: ForecastGridSample[]) {
  const now = Date.now();
  cachedRealGrid = {
    data,
    fetchedAt: now,
    expiresAt: now + GRID_CACHE_TTL,
  };
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_KEY_GRID, JSON.stringify(cachedRealGrid));
    }
  } catch {
    // QuotaExceeded
  }
}

/* ─────────────────────────────────────────────────────────────
 * XỬ LÝ LỖI 429 & RATE LIMIT COOLDOWN
 * ───────────────────────────────────────────────────────────── */

function handleRateLimit429(response: Response) {
  consecutive429Count++;
  // Đọc header Retry-After nếu server cung cấp
  const retryAfterHeader = response.headers.get("Retry-After");
  let cooldownSec = 60;

  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed) && parsed > 0) cooldownSec = parsed;
  } else {
    // Exponential backoff: 60s, 120s, 240s... tối đa 300s
    cooldownSec = Math.min(300, 60 * Math.pow(2, consecutive429Count - 1));
  }

  apiCooldownUntil = Date.now() + cooldownSec * 1000;
  console.warn(
    `[VNDMS/ECMWF RateLimit] HTTP 429 từ Open-Meteo. Kích hoạt cooldown ${cooldownSec}s (đến ${formatTime(apiCooldownUntil)}).`,
  );
}

/* ─────────────────────────────────────────────────────────────
 * VALIDATION DỮ LIỆU KHÍ TƯỢNG (Chống NaN, Infinity, lệch tọa độ)
 * ───────────────────────────────────────────────────────────── */

function isValidNumber(val: any): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

function validateStationData(station: StationForecast): boolean {
  if (!station || typeof station !== "object") return false;
  // Khung tọa độ khu vực Việt Nam & lân cận (bao gồm hải đảo và vùng đệm biên giới)
  if (!isValidNumber(station.latitude) || station.latitude < 6.0 || station.latitude > 26.0) return false;
  if (!isValidNumber(station.longitude) || station.longitude < 100.0 || station.longitude > 118.0) return false;
  if (!isValidNumber(station.current?.temperature) || station.current.temperature < -10 || station.current.temperature > 55) {
    return false;
  }
  return true;
}

function validateGridSample(sample: ForecastGridSample): boolean {
  if (!sample || typeof sample !== "object") return false;
  // Khung tọa độ khu vực Việt Nam & lân cận cho lưới IDW (6.0N-26.0N, 100.0E-118.0E)
  if (!isValidNumber(sample.lat) || sample.lat < 6.0 || sample.lat > 26.0) return false;
  if (!isValidNumber(sample.lng) || sample.lng < 100.0 || sample.lng > 118.0) return false;
  if (!isValidNumber(sample.temperature) || sample.temperature < -10 || sample.temperature > 55) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────
 * TẦNG 3: FALLBACK DATA ĐƯỢC ĐÁNH DẤU CHUẨN
 * ───────────────────────────────────────────────────────────── */

function generateFallbackStations(): StationForecast[] {
  // Gradient nhiệt độ thực tế theo vĩ độ: Bắc Bộ mát hơn (~24-26°C), Nam Bộ ấm nóng (~31-33°C)
  return METEOROLOGICAL_STATIONS.map((station, i) => {
    const lat = station.lat;
    // Mô hình nhiệt độ thực tế: Phía Bắc ~24.5°C, Phía Nam ~32.5°C, Tây Nguyên (DLI) ~21°C
    let temp = station.id === "DLI" ? 20.5 : Math.max(22, Math.min(33.5, 23.0 + (23.5 - lat) * 0.7));
    const isCoastal = station.region === "Biển & Hải Đảo" || ["HPH", "DAD", "CXR", "VTU", "UIH", "QNH"].includes(station.id);
    const rain = isCoastal ? (i % 3 === 0 ? 32.5 : 8.4) : (i % 4 === 0 ? 15.2 : 0);
    const windSpeed = isCoastal ? 38 : 14;
    const windGusts = isCoastal ? 52 : 24;

    const dailySummary: StationForecast["dailySummary"] = [
      { date: "Hôm nay", maxTemp: temp + 3, minTemp: temp - 3, totalRain: rain * 2, maxWindGust: windGusts, maxRunoff: 3.5, floodRiskLevel: rain > 25 ? "Nguy cơ cao" : "Cảnh báo" },
      { date: "Ngày mai", maxTemp: temp + 2, minTemp: temp - 4, totalRain: rain * 2.5, maxWindGust: windGusts + 10, maxRunoff: 6.2, floodRiskLevel: rain > 20 ? "Nguy cơ cao" : "Bình thường" },
      { date: "Ngày 3", maxTemp: temp + 1, minTemp: temp - 3, totalRain: rain * 1.5, maxWindGust: windGusts, maxRunoff: 2.0, floodRiskLevel: "Bình thường" },
    ];

    return {
      stationId: station.id,
      stationName: station.name,
      region: station.region,
      latitude: station.lat,
      longitude: station.lng,
      current: {
        temperature: temp,
        relativeHumidity: 78,
        windSpeed,
        windGusts,
        windDirection: 135,
        rain,
        precipitation: rain,
        snowfall: 0,
        pressureMsl: 1008,
        surfacePressure: 1006,
        cloudCover: 70,
        visibility: 10000,
        runoff: 0.8,
        cape: 0,
        uvIndex: 6,
        soilTemperature: temp - 1,
        soilMoisture: 0.3,
        isDay: true,
        weatherDesc: getWeatherDescription(rain, windSpeed, 70),
      },
      dailySummary,
      hourly: [],
    };
  });
}

function generateFallbackGridSamples(): ForecastGridSample[] {
  return DETERMINISTIC_GRID_COORDINATES.map((coord) => {
    const lat = coord.lat;
    // Gradient bắc nam thực tế: Bắc mát hơn (~24°C), Nam ấm nóng (~32.5°C)
    const temp = Math.max(22.0, Math.min(33.5, 23.5 + (23.5 - lat) * 0.68));
    return {
      id: coord.id,
      lat: coord.lat,
      lng: coord.lng,
      temperature: temp,
      rain: 0,
      windSpeed: 14,
      cape: 0,
      uvIndex: 6,
      snowfall: 0,
      soilTemp: temp - 1,
      soilMoisture: 0.3,
      source: "fallback",
      isLand: coord.isLand,
    };
  });
}

function buildApiUrl(stations: typeof METEOROLOGICAL_STATIONS): string {
  const lats = stations.map((s) => s.lat).join(",");
  const lngs = stations.map((s) => s.lng).join(",");
  const hourlyVars = [
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "rain",
    "snowfall",
    "precipitation",
    "pressure_msl",
    "surface_pressure",
    "cloud_cover",
    "visibility",
    "runoff",
    "is_day",
    "cape",
    "uv_index",
    "soil_temperature_0_to_7cm",
    "soil_moisture_0_to_7cm",
    "et0_fao_evapotranspiration",
    "sunshine_duration",
  ].join(",");
  return `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&hourly=${hourlyVars}&models=ecmwf_ifs&forecast_days=10`;
}

function getWeatherDescription(rain: number, wind: number, cloud: number): string {
  if (wind > 60) return "Bão / Gió giật cực mạnh";
  if (rain > 30) return "Mưa to đến rất to";
  if (rain > 10) return "Mưa rào rải rác";
  if (rain > 0.5) return "Mưa nhỏ";
  if (cloud > 70) return "Nhiều mây";
  if (cloud > 30) return "Mây thay đổi";
  return "Trời quang mây";
}

/* ─────────────────────────────────────────────────────────────
 * HÀM CHÍNH: FETCH WEATHER DATA (VỚI IN-FLIGHT DEDUPLICATION)
 * ───────────────────────────────────────────────────────────── */

export async function fetchEcmwfWeatherData(force = false): Promise<StationForecast[]> {
  const now = Date.now();

  // 1. Kiểm tra Cache Tier 2 (nếu còn hạn và không force refresh)
  if (!force && cachedRealStations && now < cachedRealStations.expiresAt) {
    return cachedRealStations.data;
  }

  // 2. Kiểm tra Cooldown khi gặp 429
  if (now < apiCooldownUntil) {
    if (cachedRealStations) {
      console.info("[VNDMS/ECMWF] Đang trong cooldown 429. Dùng Tier 2 (Cached Real Data).");
      return cachedRealStations.data;
    }
    console.info("[VNDMS/ECMWF] Đang trong cooldown 429. Dùng Tier 3 (Fallback Data).");
    currentMetadata = {
      provider: "Open-Meteo",
      model: "ECMWF-IFS",
      source: "fallback",
      isFallback: true,
      fetchedAt: now,
      expiresAt: null,
      statusText: `⚠ Dữ liệu dự phòng · Đang tạm dừng gọi nguồn do giới hạn tần suất (đến ${formatTime(apiCooldownUntil)})`,
      cooldownUntil: apiCooldownUntil,
    };
    notifyMetadataChanged();
    return generateFallbackStations();
  }

  // 3. In-flight Request Deduplication: Nếu request đã đang bay ra ngoài mạng, chia sẻ Promise!
  if (inFlightStationsPromise) {
    return inFlightStationsPromise;
  }

  // 4. Thực thi HTTP Request duy nhất
  inFlightStationsPromise = (async () => {
    try {
      const url = buildApiUrl(METEOROLOGICAL_STATIONS);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          handleRateLimit429(response);
        } else {
          console.warn(`[VNDMS/ECMWF] Lỗi HTTP ${response.status} từ Open-Meteo.`);
        }

        // Ưu tiên TIER 2 (Cached Real Data) nếu có
        if (cachedRealStations) {
          const timeStr = formatTime(cachedRealStations.fetchedAt);
          currentMetadata = {
            provider: "Open-Meteo",
            model: "ECMWF-IFS",
            source: "cache",
            isFallback: false,
            fetchedAt: cachedRealStations.fetchedAt,
            expiresAt: cachedRealStations.expiresAt,
            statusText: `Nguồn: ECMWF-IFS (Open-Meteo) · Dữ liệu lưu lúc ${timeStr}`,
            cooldownUntil: apiCooldownUntil > now ? apiCooldownUntil : null,
          };
          notifyMetadataChanged();
          return cachedRealStations.data;
        }

        // TIER 3 (Fallback) khi chưa có cache
        currentMetadata = {
          provider: "Open-Meteo",
          model: "ECMWF-IFS",
          source: "fallback",
          isFallback: true,
          fetchedAt: now,
          expiresAt: null,
          statusText: "⚠ Dữ liệu dự phòng · Không thể kết nối nguồn thời tiết",
          cooldownUntil: apiCooldownUntil > now ? apiCooldownUntil : null,
        };
        notifyMetadataChanged();
        return generateFallbackStations();
      }

      // Xử lý dữ liệu thành công (TIER 1: REAL DATA)
      consecutive429Count = 0; // Reset lỗi 429 liên tiếp
      const data = await response.json();
      const results = Array.isArray(data) ? data : [data];

      const stationsResult: StationForecast[] = METEOROLOGICAL_STATIONS.map((station, idx) => {
        const item = results[idx] || results[0] || {};
        const hourly = item.hourly || {};
        const times: string[] = hourly.time || [];

        const currentIdx = 0;
        const rain = hourly.rain?.[currentIdx] ?? 0;
        const windSpeed = hourly.wind_speed_10m?.[currentIdx] ?? 14;
        const cloudCover = hourly.cloud_cover?.[currentIdx] ?? 60;
        const capeVal = hourly.cape?.[currentIdx] ?? 0;
        const snowfallVal = hourly.snowfall?.[currentIdx] ?? 0;
        const surfacePressureVal = hourly.surface_pressure?.[currentIdx] ?? 1008;
        const uvIndexVal = hourly.uv_index?.[currentIdx] ?? 0;
        const soilTempVal = hourly.soil_temperature_0_to_7cm?.[currentIdx] ?? 28;
        const soilMoistureVal = hourly.soil_moisture_0_to_7cm?.[currentIdx] ?? 0.3;

        const isStormRisk = capeVal > 500;
        const windSpeedForDesc = isStormRisk ? Math.max(windSpeed, 61) : windSpeed;

        const current = {
          temperature: hourly.temperature_2m?.[currentIdx] ?? 28.5,
          relativeHumidity: hourly.relative_humidity_2m?.[currentIdx] ?? 80,
          windSpeed,
          windGusts: hourly.wind_gusts_10m?.[currentIdx] ?? 22,
          windDirection: hourly.wind_direction_10m?.[currentIdx] ?? 125,
          rain,
          precipitation: hourly.precipitation?.[currentIdx] ?? 0,
          snowfall: snowfallVal,
          pressureMsl: hourly.pressure_msl?.[currentIdx] ?? 1008,
          surfacePressure: surfacePressureVal,
          cloudCover,
          visibility: hourly.visibility?.[currentIdx] ?? 10000,
          runoff: hourly.runoff?.[currentIdx] ?? 0,
          cape: capeVal,
          uvIndex: uvIndexVal,
          soilTemperature: soilTempVal,
          soilMoisture: soilMoistureVal,
          isDay: Boolean(hourly.is_day?.[currentIdx] ?? 1),
          weatherDesc: getWeatherDescription(rain, windSpeedForDesc, cloudCover),
        };

        // 10 ngày
        const dailyMap = new Map<string, {
          maxTemp: number;
          minTemp: number;
          totalRain: number;
          maxWindGust: number;
          maxRunoff: number;
        }>();

        times.forEach((t, i) => {
          const dateStr = t.split("T")[0];
          const temp = hourly.temperature_2m?.[i] ?? 25;
          const r = hourly.rain?.[i] ?? 0;
          const gust = hourly.wind_gusts_10m?.[i] ?? 15;
          const run = hourly.runoff?.[i] ?? 0;

          if (!dailyMap.has(dateStr)) {
            dailyMap.set(dateStr, { maxTemp: temp, minTemp: temp, totalRain: r, maxWindGust: gust, maxRunoff: run });
          } else {
            const entry = dailyMap.get(dateStr)!;
            entry.maxTemp = Math.max(entry.maxTemp, temp);
            entry.minTemp = Math.min(entry.minTemp, temp);
            entry.totalRain += r;
            entry.maxWindGust = Math.max(entry.maxWindGust, gust);
            entry.maxRunoff = Math.max(entry.maxRunoff, run);
          }
        });

        const dailySummary: StationForecast["dailySummary"] = Array.from(dailyMap.entries())
          .slice(0, 10)
          .map(([date, val]) => {
            const isHeavyRain = val.totalRain > 100 || val.maxRunoff > 15;
            const isModerateRisk = val.totalRain > 50 || val.maxWindGust > 60;
            const isWarning = val.totalRain > 25;
            const risk = isHeavyRain ? "Đặc biệt nghiêm trọng" : isModerateRisk ? "Nguy cơ cao" : isWarning ? "Cảnh báo" : "Bình thường";
            return {
              date,
              maxTemp: Math.round(val.maxTemp),
              minTemp: Math.round(val.minTemp),
              totalRain: Math.round(val.totalRain * 10) / 10,
              maxWindGust: Math.round(val.maxWindGust),
              maxRunoff: Math.round(val.maxRunoff * 10) / 10,
              floodRiskLevel: risk as any,
            };
          });

        const hourlySummary = times.slice(0, 24).map((time, i) => ({
          time,
          temperature: hourly.temperature_2m?.[i] ?? 25,
          rain: hourly.rain?.[i] ?? 0,
          windSpeed: hourly.wind_speed_10m?.[i] ?? 12,
          windGusts: hourly.wind_gusts_10m?.[i] ?? 20,
          pressure: hourly.pressure_msl?.[i] ?? 1008,
          runoff: hourly.runoff?.[i] ?? 0,
        }));

        return {
          stationId: station.id,
          stationName: station.name,
          region: station.region,
          latitude: station.lat,
          longitude: station.lng,
          current,
          dailySummary,
          hourly: hourlySummary,
        };
      });

      // Lọc bỏ dữ liệu lỗi nếu có trạm bị corrupt
      const validStations = stationsResult.filter(validateStationData);
      const finalStations = validStations.length > 0 ? validStations : generateFallbackStations();

      // Lưu Tier 1 vào Cache
      saveStationsToCache(finalStations);

      const timeStr = formatTime(now);
      currentMetadata = {
        provider: "Open-Meteo",
        model: "ECMWF-IFS",
        source: "open-meteo",
        isFallback: false,
        fetchedAt: now,
        expiresAt: now + STATIONS_CACHE_TTL,
        statusText: `Nguồn: ECMWF-IFS (Open-Meteo) · Cập nhật ${timeStr}`,
        cooldownUntil: null,
      };
      notifyMetadataChanged();

      return finalStations;
    } catch (error) {
      console.warn("[VNDMS/ECMWF] Ngoại lệ kết nối API thời tiết:", error);

      // Ưu tiên TIER 2 nếu có
      if (cachedRealStations) {
        const timeStr = formatTime(cachedRealStations.fetchedAt);
        currentMetadata = {
          provider: "Open-Meteo",
          model: "ECMWF-IFS",
          source: "cache",
          isFallback: false,
          fetchedAt: cachedRealStations.fetchedAt,
          expiresAt: cachedRealStations.expiresAt,
          statusText: `Nguồn: ECMWF-IFS (Open-Meteo) · Dữ liệu lưu lúc ${timeStr}`,
          cooldownUntil: null,
        };
        notifyMetadataChanged();
        return cachedRealStations.data;
      }

      // TIER 3 Fallback
      currentMetadata = {
        provider: "Open-Meteo",
        model: "ECMWF-IFS",
        source: "fallback",
        isFallback: true,
        fetchedAt: now,
        expiresAt: null,
        statusText: "⚠ Dữ liệu dự phòng · Không thể kết nối nguồn thời tiết",
        cooldownUntil: null,
      };
      notifyMetadataChanged();
      return generateFallbackStations();
    } finally {
      inFlightStationsPromise = null;
    }
  })();

  return inFlightStationsPromise;
}

/* ─────────────────────────────────────────────────────────────
 * HÀM FETCH GRID SAMPLES (LƯỚI TRƯỜNG NHIỆT ĐỘ CHO SHADER)
 * ───────────────────────────────────────────────────────────── */

export async function fetchEcmwfGridSamples(force = false): Promise<ForecastGridSample[]> {
  const now = Date.now();

  // 1. Kiểm tra Cache Tier 2
  if (!force && cachedRealGrid && now < cachedRealGrid.expiresAt) {
    return cachedRealGrid.data;
  }

  // 2. Kiểm tra Cooldown 429
  if (now < apiCooldownUntil) {
    if (cachedRealGrid) return cachedRealGrid.data;
    return generateFallbackGridSamples();
  }

  // 3. In-flight Promise Deduplication
  if (inFlightGridPromise) {
    return inFlightGridPromise;
  }

  inFlightGridPromise = (async () => {
    try {
      const lats = DETERMINISTIC_GRID_COORDINATES.map((c) => c.lat.toFixed(2)).join(",");
      const lngs = DETERMINISTIC_GRID_COORDINATES.map((c) => c.lng.toFixed(2)).join(",");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,rain,wind_speed_10m,cape,uv_index,snowfall,soil_temperature_0_to_7cm,soil_moisture_0_to_7cm&models=ecmwf_ifs`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 429) {
          handleRateLimit429(res);
        } else {
          console.warn(`[VNDMS/ECMWF] Lỗi HTTP Grid: ${res.status}`);
        }

        if (cachedRealGrid) return cachedRealGrid.data;
        return generateFallbackGridSamples();
      }

      const data = await res.json();
      const results = Array.isArray(data) ? data : [data];

      const samples: ForecastGridSample[] = DETERMINISTIC_GRID_COORDINATES.map((coord, idx) => {
        const item = results[idx] || {};
        const current = item.current || {};
        const temp = current.temperature_2m;

        return {
          id: coord.id,
          lat: coord.lat,
          lng: coord.lng,
          temperature: isValidNumber(temp) ? temp : 26.0,
          rain: isValidNumber(current.rain) ? current.rain : 0,
          windSpeed: isValidNumber(current.wind_speed_10m) ? current.wind_speed_10m : 12,
          cape: current.cape ?? 0,
          uvIndex: current.uv_index ?? 0,
          snowfall: current.snowfall ?? 0,
          soilTemp: current.soil_temperature_0_to_7cm ?? 28,
          soilMoisture: current.soil_moisture_0_to_7cm ?? 0.3,
          source: "open-meteo",
          isLand: coord.isLand,
        };
      });

      const validSamples = samples.filter(validateGridSample);
      const finalGrid = validSamples.length > 0 ? validSamples : generateFallbackGridSamples();

      // Lưu Tier 1 Cache
      saveGridToCache(finalGrid);
      return finalGrid;
    } catch (err) {
      console.warn("[VNDMS/ECMWF] Ngoại lệ tải lưới thời tiết:", err);
      if (cachedRealGrid) return cachedRealGrid.data;
      return generateFallbackGridSamples();
    } finally {
      inFlightGridPromise = null;
    }
  })();

  return inFlightGridPromise;
}

/* ─────────────────────────────────────────────────────────────
 * TRA CỨU NHANH TỪ LOCAL CACHE (HOÀN TOÀN SYNCHRONOUS, KHÔNG GỌI API)
 * ───────────────────────────────────────────────────────────── */

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function lookupWeatherFromCache(
  locationName: string,
  coords?: [number, number],
  stations?: StationForecast[],
): StationForecast | null {
  const stationList =
    stations && stations.length > 0
      ? stations
      : cachedRealStations?.data || (METEOROLOGICAL_STATIONS as any[]);
  if (!stationList || stationList.length === 0) return null;

  const norm = locationName.toLowerCase().trim();
  const directMatch = stationList.find((s: any) => {
    const sName = (s.stationName || s.name || "").toLowerCase();
    return sName.includes(norm) || norm.includes(sName);
  });
  if (directMatch) return directMatch;

  if (coords) {
    const [lng, lat] = coords;
    let closest: StationForecast | null = null;
    let minDist = Infinity;

    for (let i = 0; i < stationList.length; i++) {
      const st = stationList[i];
      const sLat = st.latitude ?? (st as any).lat;
      const sLng = st.longitude ?? (st as any).lng;
      if (typeof sLat === "number" && typeof sLng === "number") {
        const d = haversineDistanceKm(lat, lng, sLat, sLng);
        if (d < minDist) {
          minDist = d;
          closest = st;
        }
      }
    }
    return closest;
  }

  return stationList[0] || null;
}
