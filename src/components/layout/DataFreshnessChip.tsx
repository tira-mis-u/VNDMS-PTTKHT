import { useEffect, useState } from "react";
import { CloudOff, Wifi, WifiOff } from "lucide-react";
import { subscribeWeatherMetadata, type WeatherMetadata } from "@/infrastructure/weather/ecmwfWeatherService";

/**
 * CHỈ BÁO TÌNH TRẠNG DỮ LIỆU NGOÀI
 * ─────────────────────────────────────────────────────────────────────────
 * Bão thường đi kèm mất điện, mất Internet. Nếu giao diện vẫn hiển thị số
 * liệu cũ như thật thì người trực có thể ra quyết định trên dữ liệu đã chết.
 * Chip này trả lời đúng một câu: dữ liệu ngoài (khí tượng ECMWF) đang sống
 * hay đã cũ bao lâu, và máy có đang mất mạng không.
 */
export function DataFreshnessChip() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [meta, setMeta] = useState<WeatherMetadata | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const unsubscribe = subscribeWeatherMetadata(setMeta);
    // Nhịp 60 giây để nhãn "cách đây N phút" tự già đi mà không cần sự kiện.
    const timer = window.setInterval(() => forceTick((value) => value + 1), 60000);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  const ageMinutes = (() => {
    if (!meta?.fetchedAt) return null;
    return Math.max(0, Math.round((Date.now() - meta.fetchedAt) / 60000));
  })();

  const stale = ageMinutes !== null && ageMinutes > 90;
  const tone = !online ? "offline" : stale || meta?.isFallback ? "stale" : "live";
  const label = !online
    ? "Mất kết nối"
    : ageMinutes === null
      ? "Đang chờ dữ liệu"
      : ageMinutes < 1
        ? "Dữ liệu vừa cập nhật"
        : `Dữ liệu ${ageMinutes} phút trước`;

  const title = !online
    ? "Thiết bị đang ngoại tuyến: mọi số liệu khí tượng, thuỷ văn và bản đồ nền đang là bản đã tải trước đó."
    : meta?.isFallback
      ? `Không lấy được dữ liệu trực tiếp: ${meta.statusText}`
      : meta?.statusText
        ? `${meta.statusText}${stale ? " · số liệu đã quá 90 phút, cần làm mới" : ""}`
        : "Đang kết nối nguồn dữ liệu khí tượng.";

  return (
    <span className={`data-freshness tone-${tone}`} title={title} role="status">
      {!online ? <WifiOff size={13} /> : tone === "stale" ? <CloudOff size={13} /> : <Wifi size={13} />}
      <span>{label}</span>
    </span>
  );
}
