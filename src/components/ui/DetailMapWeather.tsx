import { useEffect, useState } from "react";
import {
  nearestDetailWeather,
  type DetailWeather,
} from "@/infrastructure/weather/detailMapTemperature";

/**
 * Thời tiết điểm bản đồ chi tiết — hiển thị TĨNH trên dòng tiêu đề khối bản
 * đồ (cùng dòng "Bản đồ số NDAMapVN"), thay cho huy hiệu nổi phủ lên bản đồ.
 */
export function DetailMapWeather({ center }: { center: [number, number] }) {
  const [wx, setWx] = useState<DetailWeather | null>(null);
  const key = `${center[0].toFixed(4)},${center[1].toFixed(4)}`;

  useEffect(() => {
    let live = true;
    nearestDetailWeather(center)
      .then((result) => {
        if (live) setWx(result);
      })
      .catch(() => {
        if (live) setWx(null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!wx) return null;
  return (
    <span className="detail-map-weather">
      {" "}· {wx.temperature.toFixed(1)}°C · {wx.rain.toFixed(1)} mm/h ·{" "}
      {wx.windSpeed.toFixed(0)} km/h · {wx.stationName}
    </span>
  );
}
