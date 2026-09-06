import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function two(value: number) {
  return String(value).padStart(2, "0");
}
/** Nhãn giờ theo giờ Việt Nam (UTC+7) từ mốc thời gian UTC. */
function localParts(ms: number) {
  const local = new Date(ms + 7 * HOUR_MS);
  return {
    hour: local.getUTCHours(),
    day: local.getUTCDate(),
    month: local.getUTCMonth() + 1,
    weekday: WEEKDAY[local.getUTCDay()],
    dayStartMs: Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
    ) - 7 * HOUR_MS,
  };
}
export function forecastClockLabel(ms: number) {
  const parts = localParts(ms);
  return `${two(parts.hour)}:00 ${two(parts.day)}/${two(parts.month)}`;
}

/**
 * THANH THỜI GIAN DỰ BÁO (kiểu Windy) — đặt NGAY DƯỚI khung bản đồ.
 *
 * Ba quyết định thiết kế, mỗi cái đều xuất phát từ một lỗi thật:
 *
 * 1. **Nằm dưới bản đồ, không nổi trên bản đồ.** Bản trước thanh này nổi bên
 *    trong khung bản đồ nên vừa che địa hình vừa bị đẩy khỏi khung nhìn khi
 *    chiều cao bản đồ lớn hơn phần màn hình còn lại.
 * 2. **Chọn được giờ bất kỳ**, không phải nhảy theo nấc cố định của mô hình.
 *    Người trực hỏi "3 giờ chiều mai gió thế nào" chứ không hỏi "mốc số 9".
 *    Bước kéo là 1 giờ; giữa hai mốc mô hình, trường gió và vị trí tâm bão
 *    được **nội suy tuyến tính** và thanh này **nói rõ đang nội suy** —
 *    không giả vờ đó là số liệu mô hình gốc.
 * 3. **Thước có mốc ngày/đêm thật**: vạch ngày, vạch mốc mô hình, vạch "bây
 *    giờ", nên người dùng đọc được vị trí thời gian mà không cần diễn giải.
 */
export function ForecastTimeline({
  startMs,
  endMs,
  nowMs,
  valueMs,
  modelTimesMs,
  playing,
  onChange,
  onTogglePlay,
  onReset,
  statusLabel,
  historical = false,
}: {
  startMs: number;
  endMs: number;
  nowMs: number;
  valueMs: number;
  modelTimesMs: number[];
  playing: boolean;
  onChange: (ms: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
  /** Mô tả ngắn tình hình bão tại mốc đang xem (nếu có). */
  statusLabel?: string | null;
  /**
   * Chế độ xem lại dữ liệu quá khứ (tái phân tích ERA5): mốc tham chiếu không
   * còn là "bây giờ" và nguồn số liệu không phải mô hình dự báo, nên chữ trên
   * trục phải đổi theo — nếu không sẽ nói dối người dùng.
   */
  historical?: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const span = Math.max(endMs - startMs, HOUR_MS);

  const ratioOf = useCallback(
    (ms: number) => Math.min(1, Math.max(0, (ms - startMs) / span)),
    [startMs, span],
  );

  const setFromClientX = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const rect = rail.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      // Bám nấc 1 giờ: đủ mượt để xem diễn biến, đủ rời rạc để đọc nhãn giờ.
      const raw = startMs + ratio * span;
      onChange(Math.round(raw / HOUR_MS) * HOUR_MS);
    },
    [onChange, span, startMs],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => setFromClientX(event.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, setFromClientX]);

  /** Vạch mốc ngày (00:00 giờ Việt Nam) để đọc nhanh "ngày nào". */
  const dayMarks = useMemo(() => {
    const marks: { ms: number; label: string }[] = [];
    const first = localParts(startMs).dayStartMs;
    for (let ms = first; ms <= endMs; ms += DAY_MS) {
      if (ms < startMs) continue;
      const parts = localParts(ms);
      marks.push({ ms, label: `${parts.weekday} ${two(parts.day)}/${two(parts.month)}` });
    }
    return marks;
  }, [endMs, startMs]);

  const current = localParts(valueMs);
  const offsetHours = Math.round((valueMs - nowMs) / HOUR_MS);
  const exactModel = modelTimesMs.includes(valueMs);
  const before = [...modelTimesMs].reverse().find((ms) => ms <= valueMs);
  const after = modelTimesMs.find((ms) => ms >= valueMs);
  const sourceName = historical ? "Số liệu ERA5" : "Số liệu ECMWF-IFS";
  /**
   * Ghi chú nguồn: nói bằng tiếng người. Người trực cần biết "số này lấy lúc
   * mấy giờ, của ai" — không cần biết nó là mốc mô hình hay giá trị nội suy.
   */
  const provenance = exactModel
    ? `${sourceName} lúc ${forecastClockLabel(valueMs)}`
    : before !== undefined && after !== undefined
      ? `${sourceName} lúc ${forecastClockLabel(valueMs)} (ước tính theo hai lần cập nhật gần nhất)`
      : historical
        ? "Ngoài khoảng thời gian của đợt xem lại"
        : "Ngoài khoảng dự báo";

  return (
    <div className="om-timeline" aria-label="Trục thời gian dự báo bão và gió">
      <button
        type="button"
        className="om-timeline-play"
        onClick={onTogglePlay}
        aria-label={playing ? "Dừng chạy thời gian" : "Chạy thời gian dự báo"}
        title={playing ? "Dừng" : "Chạy thời gian dự báo"}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
      </button>

      <div className="om-timeline-readout">
        <b>
          {current.weekday} {two(current.day)}/{two(current.month)} · {two(current.hour)}:00
        </b>
        <span className={offsetHours === 0 ? "is-now" : undefined}>
          {offsetHours === 0
            ? historical
              ? "mốc gốc của đợt xem lại"
              : "thời điểm hiện tại"
            : `${offsetHours > 0 ? "+" : "−"}${Math.abs(offsetHours)} giờ`}
        </span>
      </div>

      <div className="om-timeline-track">
        <div
          className="om-timeline-rail"
          ref={railRef}
          role="slider"
          tabIndex={0}
          aria-valuemin={startMs}
          aria-valuemax={endMs}
          aria-valuenow={valueMs}
          aria-valuetext={`${forecastClockLabel(valueMs)} — ${provenance}`}
          onPointerDown={(event) => {
            setDragging(true);
            setFromClientX(event.clientX);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 6 * HOUR_MS : HOUR_MS;
            if (event.key === "ArrowLeft" || event.key === "ArrowDown")
              onChange(Math.max(startMs, valueMs - step));
            else if (event.key === "ArrowRight" || event.key === "ArrowUp")
              onChange(Math.min(endMs, valueMs + step));
            else if (event.key === "Home") onChange(startMs);
            else if (event.key === "End") onChange(endMs);
            else return;
            event.preventDefault();
          }}
        >
          {/* Nền ngày/đêm + nhãn ngày */}
          {dayMarks.map((mark) => (
            <span
              key={mark.ms}
              className="om-timeline-day"
              style={{ left: `${ratioOf(mark.ms) * 100}%` }}
            >
              <i />
              <em>{mark.label}</em>
            </span>
          ))}
          {/* Vạch mốc mô hình: cho biết dữ liệu gốc dày thưa thế nào */}
          {modelTimesMs.map((ms) => (
            <span
              key={`m-${ms}`}
              className="om-timeline-tick"
              style={{ left: `${ratioOf(ms) * 100}%` }}
            />
          ))}
          <span
            className="om-timeline-past"
            style={{ width: `${ratioOf(nowMs) * 100}%` }}
          />
          <span className="om-timeline-now" style={{ left: `${ratioOf(nowMs) * 100}%` }}>
            <i />
            <em>{historical ? "mốc gốc" : "bây giờ"}</em>
          </span>
          <span
            className={`om-timeline-handle${dragging ? " is-dragging" : ""}`}
            style={{ left: `${ratioOf(valueMs) * 100}%` }}
          >
            <i />
            <em>{two(current.hour)}:00</em>
          </span>
        </div>
      </div>

      <div className="om-timeline-meta">
        <span className="om-timeline-provenance" title={provenance}>
          {provenance}
        </span>
        {statusLabel && <span className="om-timeline-storm">{statusLabel}</span>}
      </div>

      {valueMs !== nowMs && (
        <button
          type="button"
          className="om-timeline-reset"
          onClick={onReset}
          title={historical ? "Về mốc gốc của đợt xem lại" : "Về thời điểm hiện tại"}
        >
          <SkipBack size={13} /> {historical ? "Mốc gốc" : "Hiện tại"}
        </button>
      )}
    </div>
  );
}
