import { useState } from "react";

/**
 * Nguồn tọa độ của người dân — không bao giờ là tọa độ mặc định.
 * "gps": lấy từ GPS thiết bị · "map": người dân tự chạm lên bản đồ.
 */
export type CitizenLocationSource = "gps" | "map" | null;

interface CitizenLocation {
  coords: [number, number] | null;
  source: CitizenLocationSource;
}

/**
 * Cache ở phạm vi module để vị trí đã lấy (GPS hoặc điểm chạm bản đồ) được
 * GIỮ NGUYÊN khi người dân chuyển qua lại giữa Trang chủ / Bản đồ tác nghiệp /
 * Yêu cầu của tôi trong cùng một phiên đăng nhập.
 */
let cached: CitizenLocation = { coords: null, source: null };

export function useCitizenLocation() {
  const [location, setLocationState] = useState<CitizenLocation>(cached);
  const [locating, setLocating] = useState(false);

  const setLocation = (coords: [number, number] | null, source: CitizenLocationSource) => {
    cached = { coords, source };
    setLocationState(cached);
  };

  /**
   * Lấy GPS thiết bị. Kết quả trả qua callback để trang gọi hiển thị
   * phản hồi theo ngữ cảnh riêng (toast trang chủ, badge trong biểu mẫu…).
   */
  const requestGps = (onResult: (ok: boolean, message: string) => void) => {
    if (!navigator.geolocation) {
      onResult(false, "Trình duyệt không hỗ trợ định vị GPS tự động.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setLocation(coords, "gps");
        setLocating(false);
        onResult(
          true,
          `Đã lấy vị trí GPS từ thiết bị: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        );
      },
      (err) => {
        setLocating(false);
        onResult(
          false,
          `Không lấy được vị trí GPS (${err.message}). Bạn có thể sang mục Bản đồ tác nghiệp để đánh dấu vị trí của mình.`,
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return {
    coords: location.coords,
    source: location.source,
    locating,
    setLocation,
    requestGps,
  };
}
