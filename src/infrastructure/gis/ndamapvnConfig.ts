/**
 * NDAMapVN GIS & Routing Architecture Configuration
 * Cấu hình hệ thống bản đồ số và dịch vụ điều hướng/định tuyến NDAMapVN.
 */

export interface NdaMapConfig {
  apiKey: string;
  tileUrl: string;
  routingApiUrl: string;
  geocodingApiUrl: string;
}

export function getNdaMapConfig(): NdaMapConfig {
  const apiKey = (import.meta.env?.VITE_NDAMAPVN_API_KEY as string | undefined)?.trim() || "";
  const tileUrl = (import.meta.env?.VITE_NDAMAPVN_TILE_URL as string | undefined)?.trim() || "https://tiles.ndamapvn.gov.vn/styles/vietnam/{z}/{x}/{y}.png";
  const routingApiUrl = (import.meta.env?.VITE_NDAMAPVN_ROUTING_API_URL as string | undefined)?.trim() || "https://api.ndamapvn.gov.vn/v1/routing";
  const geocodingApiUrl = (import.meta.env?.VITE_NDAMAPVN_GEOCODING_API_URL as string | undefined)?.trim() || "https://api.ndamapvn.gov.vn/v1/geocoding";

  return {
    apiKey,
    tileUrl,
    routingApiUrl,
    geocodingApiUrl,
  };
}

export function isNdaMapConfigured(): boolean {
  const { apiKey } = getNdaMapConfig();
  return Boolean(apiKey && apiKey.length > 4 && !apiKey.includes("your_ndamapvn_api_key"));
}
