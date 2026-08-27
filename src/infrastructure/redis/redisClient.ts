import { Redis } from "@upstash/redis";

const upstashUrl = (import.meta.env?.VITE_UPSTASH_REDIS_REST_URL as string | undefined)?.trim();
const upstashToken = (import.meta.env?.VITE_UPSTASH_REDIS_REST_TOKEN as string | undefined)?.trim();

export const isRedisConfigured = Boolean(
  upstashUrl &&
  upstashToken &&
  upstashUrl.startsWith("http") &&
  !upstashUrl.includes("your-redis-instance")
);

export const redis: Redis | null = isRedisConfigured
  ? new Redis({
      url: upstashUrl!,
      token: upstashToken!,
    })
  : null;

export interface LiveLocationPing {
  id: string;
  type: "citizen" | "team";
  name: string;
  coordinates: [number, number]; // [lng, lat]
  status?: string;
  phone?: string;
  timestamp: number;
}

/**
 * Gửi tọa độ GPS Realtime của công dân hoặc đội cứu hộ vào Redis
 */
export async function pushLiveLocationPing(ping: LiveLocationPing): Promise<boolean> {
  if (!redis) {
    // Fallback: lưu vào sessionStorage cục bộ nếu chưa cấu hình Redis
    try {
      const stored = JSON.parse(sessionStorage.getItem("vndms_live_pings") || "{}");
      stored[ping.id] = ping;
      sessionStorage.setItem("vndms_live_pings", JSON.stringify(stored));
      return true;
    } catch {
      return false;
    }
  }

  try {
    const key = `vndms:location:${ping.type}:${ping.id}`;
    // Lưu với thời gian sống TTL 300 giây (5 phút) để tự động dọn sạch thiết bị ngắt kết nối
    await redis.set(key, JSON.stringify(ping), { ex: 300 });

    // Cập nhật vào Geospatial Index của Redis
    await redis.geoadd("vndms:geo:live_fleet", {
      longitude: ping.coordinates[0],
      latitude: ping.coordinates[1],
      member: ping.id,
    });

    return true;
  } catch (error) {
    console.warn("[VNDMS/Redis] Lỗi khi gửi ping vị trí:", error);
    return false;
  }
}

/**
 * Lấy toàn bộ vị trí thiết bị đang online từ Redis
 */
export async function fetchLiveLocations(): Promise<LiveLocationPing[]> {
  if (!redis) {
    try {
      const stored = JSON.parse(sessionStorage.getItem("vndms_live_pings") || "{}");
      return Object.values(stored) as LiveLocationPing[];
    } catch {
      return [];
    }
  }

  try {
    const keys = await redis.keys("vndms:location:*");
    if (!keys || keys.length === 0) return [];

    const pings: LiveLocationPing[] = [];
    for (const key of keys) {
      const data = await redis.get<LiveLocationPing | string>(key);
      if (data) {
        pings.push(typeof data === "string" ? JSON.parse(data) : data);
      }
    }
    return pings;
  } catch (error) {
    console.warn("[VNDMS/Redis] Lỗi khi lấy danh sách vị trí:", error);
    return [];
  }
}
