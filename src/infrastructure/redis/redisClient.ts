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

export type LiveDeviceRole =
  | "commander"
  | "rescue_leader"
  | "rescue_member"
  | "operator"
  | "local_officer"
  | "warehouse_staff"
  | "relief_worker"
  | "citizen";

export interface LiveLocationPing {
  id: string;
  type: "citizen" | "team" | "personnel";
  role: LiveDeviceRole;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  status?: string;
  phone?: string;
  heading?: number;
  speed?: number;
  accuracy?: number;
  isPanicSOS?: boolean; // Cảnh báo 1 chạm khẩn cấp
  timestamp: number;
}

const LOCAL_STORAGE_KEY = "vndms_live_pings_v2";
export const BROADCAST_EVENT_NAME = "vndms_live_ping_event";

/**
 * Gửi tọa độ GPS Realtime (hoặc SOS 1-chạm) của bất kỳ tài khoản nào vào Redis
 */
export async function pushLiveLocationPing(ping: LiveLocationPing): Promise<boolean> {
  // 1. Luôn phát event trong window/session để các component cập nhật tức thì
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY) || "{}";
    const stored = JSON.parse(raw);
    stored[ping.id] = ping;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored));
    window.dispatchEvent(new CustomEvent(BROADCAST_EVENT_NAME, { detail: ping }));
  } catch {
    // Ignore storage quota error
  }

  // 2. Gửi lên Vite Backend Redis API (nếu đang chạy trên web)
  try {
    fetch("/api/redis/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ping),
    }).catch(() => {});
  } catch {
    // ignore
  }

  // 3. Gửi lên Upstash REST (nếu được cấu hình trực tiếp)
  if (redis) {
    try {
      const key = `vndms:location:${ping.role}:${ping.id}`;
      const ttl = ping.isPanicSOS ? 1800 : 300;
      await redis.set(key, JSON.stringify(ping), { ex: ttl });
      await redis.geoadd("vndms:geo:live_fleet", {
        longitude: ping.coordinates[0],
        latitude: ping.coordinates[1],
        member: ping.id,
      });
    } catch (error) {
      console.warn("[VNDMS/Redis] Lỗi khi gửi ping vị trí lên Upstash:", error);
    }
  }

  return true;
}

/**
 * Lấy toàn bộ vị trí thiết bị/nhân sự/công dân đang online từ Redis hoặc Cache
 */
export async function fetchLiveLocations(): Promise<LiveLocationPing[]> {
  const now = Date.now();
  let localPings: LiveLocationPing[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
    localPings = (Object.values(stored) as LiveLocationPing[]).filter(
      (p) => now - p.timestamp < 10 * 60 * 1000
    );
  } catch {
    localPings = [];
  }

  // 1. Thử lấy từ Redis endpoint `/api/redis/locations`
  try {
    const res = await fetch("/api/redis/locations");
    if (res.ok) {
      const body = await res.json();
      if (body.success && Array.isArray(body.data) && body.data.length > 0) {
        const map = new Map<string, LiveLocationPing>();
        // Ưu tiên remote redis data
        body.data.forEach((p: LiveLocationPing) => map.set(p.id, p));
        localPings.forEach((p) => {
          if (!map.has(p.id)) map.set(p.id, p);
        });
        return Array.from(map.values());
      }
    }
  } catch {
    // ignore fetch error in non-browser or offline
  }

  // 2. Thử lấy từ Upstash REST nếu có
  if (redis) {
    try {
      const keys = await redis.keys("vndms:location:*");
      if (keys && keys.length > 0) {
        const remotePings: LiveLocationPing[] = [];
        for (const key of keys) {
          const data = await redis.get<LiveLocationPing | string>(key);
          if (data) {
            remotePings.push(typeof data === "string" ? JSON.parse(data) : data);
          }
        }
        const map = new Map<string, LiveLocationPing>();
        localPings.forEach((p) => map.set(p.id, p));
        remotePings.forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
      }
    } catch (error) {
      console.warn("[VNDMS/Redis] Lỗi khi lấy danh sách vị trí từ Upstash:", error);
    }
  }

  return localPings;
}

/**
 * Xóa tín hiệu định vị khi người dùng tắt phát beacon
 */
export async function removeLiveLocationPing(id: string, role: string): Promise<void> {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
    delete stored[id];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored));
    window.dispatchEvent(new CustomEvent(BROADCAST_EVENT_NAME, { detail: { id, removed: true } }));
  } catch {
    // Ignore
  }

  try {
    fetch("/api/redis/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  if (redis) {
    try {
      await redis.del(`vndms:location:${role}:${id}`);
      await redis.zrem("vndms:geo:live_fleet", id);
    } catch {
      // Ignore
    }
  }
}
