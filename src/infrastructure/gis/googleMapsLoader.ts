/**
 * Map Engine Loader — Tự động nhận diện và quản lý nạp engine bản đồ tối ưu cho VNDMS:
 * - Google Maps (nếu key bắt đầu bằng AIzaSy... hoặc VITE_GOOGLE_MAPS_API_KEY)
 * - NDAMapVN / MapLibre Việt hóa (chuẩn bản đồ tác nghiệp Việt Nam, Hoàng Sa, Trường Sa)
 */

let googleMapsPromise: Promise<typeof google.maps | null> | null = null;

export function getGoogleMapsApiKey(): string {
  const gKey = (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  if (gKey && gKey.startsWith("AIzaSy")) return gKey;

  const ndaKey = (import.meta.env?.VITE_NDAMAPVN_API_KEY as string | undefined)?.trim();
  if (ndaKey && ndaKey.startsWith("AIzaSy")) return ndaKey;

  if (typeof window !== "undefined") {
    const storageKey = localStorage.getItem("vndms_google_maps_api_key")?.trim();
    if (storageKey && storageKey.startsWith("AIzaSy")) return storageKey;
  }

  return "";
}

export function hasGoogleMapsKey(): boolean {
  const key = getGoogleMapsApiKey();
  return Boolean(key && key.startsWith("AIzaSy"));
}

export function loadGoogleMapsScript(): Promise<typeof google.maps | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const apiKey = getGoogleMapsApiKey();
  // Nếu không phải Google Maps key chuẩn (AIzaSy...), không nạp google script để tránh crash/trắng màn hình
  if (!apiKey || !apiKey.startsWith("AIzaSy")) {
    return Promise.resolve(null);
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve) => {
    const existingScript = document.getElementById("vndms-google-maps-script");
    if (existingScript) {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        existingScript.addEventListener("load", () => resolve(window.google?.maps || null));
        existingScript.addEventListener("error", () => resolve(null));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "vndms-google-maps-script";
    script.type = "text/javascript";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&language=vi&region=VN&libraries=places,geometry,marker&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        resolve(null);
      }
    };

    script.onerror = () => {
      console.warn("[VNDMS] Không thể tải Google Maps API script. Chuyển sang bản đồ số tác nghiệp NDAMapVN.");
      resolve(null);
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function toGoogleLatLng(coordinates: [number, number]): { lat: number; lng: number } {
  return {
    lat: coordinates[1],
    lng: coordinates[0],
  };
}

export function fromGoogleLatLng(latLng: google.maps.LatLng | google.maps.LatLngLiteral): [number, number] {
  if ("lat" in latLng && typeof (latLng as { lat?: unknown }).lat === "function") {
    const obj = latLng as google.maps.LatLng;
    return [obj.lng(), obj.lat()];
  }
  const literal = latLng as google.maps.LatLngLiteral;
  return [Number(literal.lng), Number(literal.lat)];
}
