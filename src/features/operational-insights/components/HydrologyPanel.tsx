import { useEffect, useMemo, useState } from "react";
import { CloudRain, Droplets, RefreshCw, TrendingDown, TrendingUp, Waves } from "lucide-react";
import {
  fetchHydrologyData,
  HYDRO_LEVEL_TONE,
  type HydrologySnapshot,
  type HydroStationReading,
} from "@/infrastructure/weather/hydrologyService";

const REGION_ORDER = ["Bắc Bộ", "Bắc Trung Bộ", "Nam Trung Bộ", "Tây Nguyên", "Nam Bộ"];

function TrendIcon({ trend }: { trend: HydroStationReading["trend"] }) {
  if (trend === "Đang lên") return <TrendingUp size={13} aria-hidden />;
  if (trend === "Đang xuống") return <TrendingDown size={13} aria-hidden />;
  return <span className="hydro-trend-flat" aria-hidden />;
}

/**
 * Bảng quan trắc mưa và dòng chảy sông.
 *
 * Thay cho khối "Chưa có dữ liệu quan trắc" trước đây: đây là số liệu thật
 * lấy trực tiếp từ mô hình ECMWF-IFS (mưa) và GloFAS (lưu lượng sông). Hệ
 * thống nói rõ giới hạn: lưu lượng không phải mực nước nên không quy đổi
 * được sang cấp báo động I/II/III.
 */
export function HydrologyPanel() {
  const [snapshot, setSnapshot] = useState<HydrologySnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchHydrologyData()
      .then((data) => {
        if (active) {
          setSnapshot(data);
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const stations = snapshot?.stations ?? [];
    return REGION_ORDER.map((region) => ({
      region,
      rows: stations.filter((station) => station.region === region),
    })).filter((group) => group.rows.length > 0);
  }, [snapshot]);

  const refresh = () => {
    setLoading(true);
    fetchHydrologyData(true)
      .then((data) => {
        setSnapshot(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <section className="hydro-panel" aria-labelledby="hydro-title">
      <div className="hydro-head">
        <div>
          <h2 id="hydro-title">
            <Waves size={17} /> Quan trắc mưa &amp; dòng chảy sông
          </h2>
          <p>
            {snapshot?.source === "unavailable"
              ? snapshot.statusText
              : (snapshot?.statusText ?? "Đang tải dữ liệu mưa và lưu lượng các lưu vực…")}
          </p>
        </div>
        <button className="hydro-refresh" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin-once" : ""} />
          {loading ? "Đang tải" : "Làm mới"}
        </button>
      </div>

      {snapshot?.highlights?.length ? (
        <ul className="hydro-highlights">
          {snapshot.highlights.map((line) => (
            <li key={line}>
              <Droplets size={14} /> {line}
            </li>
          ))}
        </ul>
      ) : snapshot && snapshot.source !== "unavailable" ? (
        <p className="hydro-quiet">
          Không lưu vực nào vượt rõ mức nền 90 ngày trong 24 giờ qua và 7 ngày dự báo tới.
        </p>
      ) : null}

      {grouped.map((group) => (
        <div key={group.region} className="hydro-region">
          <h3>{group.region}</h3>
          <div className="hydro-table-wrap">
            <table className="hydro-table">
              <thead>
                <tr>
                  <th scope="col">Lưu vực</th>
                  <th scope="col">Mưa 24h qua</th>
                  <th scope="col">Mưa 24h tới</th>
                  <th scope="col">Lưu lượng hiện tại</th>
                  <th scope="col">So với nền 90 ngày</th>
                  <th scope="col">Đỉnh dự báo 7 ngày</th>
                  <th scope="col">Biên trên tổ hợp</th>
                  <th scope="col">Mức cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <b>{row.river}</b>
                      <small>{row.place}</small>
                    </th>
                    <td>
                      <span className={row.rain24h > 50 ? "hydro-strong" : ""}>
                        <CloudRain size={12} /> {row.rain24h} mm
                      </span>
                    </td>
                    <td className={row.rainNext24h > 50 ? "hydro-strong" : ""}>{row.rainNext24h} mm</td>
                    <td>
                      {row.discharge.toLocaleString("vi-VN")} m³/s{" "}
                      <span className={`hydro-trend ${row.trend === "Đang lên" ? "up" : row.trend === "Đang xuống" ? "down" : ""}`}>
                        <TrendIcon trend={row.trend} />
                        {row.trend}
                      </span>
                    </td>
                    <td>
                      <span className={row.ratio >= 1.5 ? "hydro-strong" : ""}>{row.ratio.toFixed(2)}×</span>
                      <small className="hydro-sub"> nền {row.baseline90d.toLocaleString("vi-VN")}</small>
                    </td>
                    <td>
                      {row.dischargePeak.toLocaleString("vi-VN")} m³/s
                      {row.peakDate ? <small> · {row.peakDate.slice(8, 10)}/{row.peakDate.slice(5, 7)}</small> : null}
                    </td>
                    <td className="hydro-sub">≤ {row.peakEnsembleMax.toLocaleString("vi-VN")} m³/s</td>
                    <td>
                      <span className="hydro-level" style={{ background: `${HYDRO_LEVEL_TONE[row.level]}1f`, color: HYDRO_LEVEL_TONE[row.level] }}>
                        {row.level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p className="hydro-footnote">
        Nguồn: mưa từ mô hình ECMWF-IFS, lưu lượng sông từ mô hình GloFAS (Copernicus Emergency
        Management Service) qua Open-Meteo. Đây là <b>lưu lượng (m³/s), không phải mực nước</b>, nên
        không quy đổi sang cấp báo động I/II/III — cấp báo động là ngưỡng mực nước do cơ quan khí
        tượng thuỷ văn công bố cho từng trạm. “Mức nền 90 ngày” là <b>trung vị lưu lượng 90 ngày gần
        nhất của chính lưu vực đó</b> do hệ thống tự tính, dùng để phát hiện bất thường sớm; “biên
        trên tổ hợp” là giá trị lớn nhất trong các thành phần dự báo tổ hợp, thể hiện độ bất định.
      </p>
    </section>
  );
}
