import { getNdaMapConfig, isNdaMapConfigured } from "./ndamapvnConfig";

export interface RouteRequest {
  origin: [number, number]; // [lng, lat]
  destination: [number, number]; // [lng, lat]
  avoidAreas?: Array<{
    coordinates: [number, number][]; // Polygon tọa độ ngập lụt
  }>;
  vehicle?: "car" | "boat" | "foot" | "rescue_truck";
}

export interface RouteResult {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  isAlternative: boolean;
  warnings?: string[];
}

/**
 * Tính toán tuyến đường cứu hộ / sơ tán thông qua NDAMapVN Routing API
 */
export async function calculateNdaRoute(request: RouteRequest): Promise<RouteResult | null> {
  const { apiKey, routingApiUrl } = getNdaMapConfig();

  if (!isNdaMapConfigured() || !routingApiUrl) {
    // Dự phòng thuật toán nội suy trực tiếp khi chưa điền API Key
    return generateFallbackRoute(request.origin, request.destination);
  }

  try {
    const response = await fetch(`${routingApiUrl}/directions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-NDAMAP-KEY": apiKey,
      },
      body: JSON.stringify({
        coordinates: [request.origin, request.destination],
        avoid_polygons: request.avoidAreas?.map((a) => a.coordinates),
        profile: request.vehicle ?? "rescue_truck",
      }),
    });

    if (!response.ok) {
      console.warn("[NDAMapVN Routing] API phản hồi lỗi:", response.status);
      return generateFallbackRoute(request.origin, request.destination);
    }

    const data = await response.json();
    return {
      coordinates: data.routes[0].geometry.coordinates,
      distanceMeters: data.routes[0].distance,
      durationSeconds: data.routes[0].duration,
      isAlternative: Boolean(data.routes[0].avoided_hazards),
      warnings: data.routes[0].warnings || [],
    };
  } catch (error) {
    console.warn("[NDAMapVN Routing] Ngoại lệ kết nối:", error);
    return generateFallbackRoute(request.origin, request.destination);
  }
}

function generateFallbackRoute(origin: [number, number], destination: [number, number]): RouteResult {
  const midPoint: [number, number] = [
    (origin[0] + destination[0]) / 2 + 0.002,
    (origin[1] + destination[1]) / 2 - 0.001,
  ];
  return {
    coordinates: [origin, midPoint, destination],
    distanceMeters: 4500,
    durationSeconds: 600,
    isAlternative: false,
  };
}
