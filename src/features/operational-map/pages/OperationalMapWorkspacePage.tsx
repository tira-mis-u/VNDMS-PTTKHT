import { Select as UiSelect } from "@/components/ui/Select";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, History, Layers3, Loader2, Search, Thermometer, Tornado, X } from "lucide-react";
import { PageSectionHeader, Input } from "@/components/ui";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import {
  UNIFIED_MAP_LAYER_CONFIG,
  countByLayer,
  defaultUnifiedMapLayers,
  filterUnifiedMapPoints,
  findUnifiedMapDetail,
  getUnifiedMapDataStamp,
  getUnifiedMapPoints,
  getUnifiedMapRoutes,
  visibleUnifiedMapRoutes,
  type UnifiedMapKind,
  type UnifiedMapSeverity,
} from "@/application/map/unifiedMapQueries";
import { UnifiedMapCanvas } from "../components/UnifiedMapCanvas";
import { EntityDetailDrawer } from "../components/EntityDetailDrawer";
import { EcmwfWeatherPanel } from "@/features/command-center/components/EcmwfWeatherPanel";
import {
  HISTORICAL_STORM_PRESETS,
  fetchHistoricalStormField,
  subscribeStormField,
  subscribeWeatherMetadata,
  type StormFieldSnapshot,
  type WeatherMetadata,
} from "@/infrastructure/weather/ecmwfWeatherService";
import { beaufortLevel, stormColor } from "@/infrastructure/weather/stormDetection";

const SEVERITY_OPTIONS: Array<"" | UnifiedMapSeverity> = [
  "",
  "Khẩn cấp",
  "Cao",
  "Trung bình",
  "Thấp",
];

export function OperationalMapWorkspacePage({
  navigate,
  focus,
}: {
  navigate: (path: string) => void;
  focus: string | null;
}) {
  const [weatherMeta, setWeatherMeta] = useState<WeatherMetadata | null>(null);
  const [liveStormField, setLiveStormField] = useState<StormFieldSnapshot | null>(null);
  /**
   * XEM LẠI BÃO LỊCH SỬ — vì sao có mục này:
   * lớp bão chỉ vẽ khi ECMWF-IFS thực sự thấy xoáy thuận trên Biển Đông. Hôm
   * nay không có cơn nào, nên đường đi bão, tâm bão và vòng bán kính gió không
   * xuất hiện — dễ tưởng các ký hiệu đó chỉ để trang trí. Nút này nạp lại một
   * cơn bão CÓ THẬT từ kho tái phân tích ERA5 và chạy đúng thuật toán dò bão
   * đang dùng cho dự báo, kèm nhãn cảnh báo rõ đây là dữ liệu quá khứ.
   */
  const [stormFocusKey, setStormFocusKey] = useState(0);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [replayField, setReplayField] = useState<StormFieldSnapshot | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeWeatherMetadata(setWeatherMeta);
    return unsub;
  }, []);

  /**
   * Khối bản đồ nay cao gần bằng cả cửa sổ, nên khi mở trang phần chú giải và
   * trục thời gian nằm dưới mép màn hình. Cuộn nhẹ một lần khi vào trang để
   * toàn bộ khối bản đồ (kèm chú giải + trục thời gian) nằm trọn trong tầm
   * nhìn; người dùng cuộn lên là thấy lại tiêu đề và bộ lọc.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const zone = document.querySelector(".om-layout");
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      // Khung cuộn không phải window mà là vùng nội dung của app-shell, nên
      // dùng scrollIntoView để không phụ thuộc vào phần tử nào đang cuộn.
      if (rect.bottom - window.innerHeight > 8)
        zone.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = subscribeStormField(setLiveStormField);
    return unsub;
  }, []);

  useEffect(() => {
    if (!replayId) {
      setReplayField(null);
      setReplayError(null);
      return;
    }
    let active = true;
    setReplayLoading(true);
    setReplayError(null);
    fetchHistoricalStormField(replayId)
      .then((snapshot) => {
        if (!active) return;
        setReplayField(snapshot.storms.length ? snapshot : null);
        if (!snapshot.storms.length) setReplayError(snapshot.statusText);
      })
      .catch(() => {
        if (active) setReplayError("Không tải được dữ liệu tái phân tích ERA5");
      })
      .finally(() => {
        if (active) setReplayLoading(false);
      });
    return () => {
      active = false;
    };
  }, [replayId]);

  const store = useOperationalState();
  const {
    incidents,
    sosRequests,
    tasks,
    teams,
    shelters,
    evacuationOperations,
    reliefRequests,
    warehouses,
    recoveryProjects,
  } = store;

  const allPoints = useMemo(
    () => getUnifiedMapPoints(store),
    // Store mảng giữ reference ổn định giữa các lần render; deps theo mảng
    // canonical. eslint-disable không cần thiết — liệt kê đủ collection gốc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      incidents,
      sosRequests,
      tasks,
      teams,
      shelters,
      evacuationOperations,
      reliefRequests,
      warehouses,
      recoveryProjects,
    ],
  );
  const allRoutes = useMemo(
    () => getUnifiedMapRoutes(store),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [evacuationOperations],
  );
  const totals = useMemo(() => countByLayer(allPoints), [allPoints]);
  const dataStamp = useMemo(() => getUnifiedMapDataStamp(store), [store]);
  const formattedDataStamp = useMemo(() => {
    if (!dataStamp) return "Chưa có sự kiện cập nhật trong phạm vi quyền";
    const parsed = new Date(dataStamp);
    return Number.isNaN(parsed.getTime())
      ? `Cập nhật ${dataStamp}`
      : `Cập nhật ${parsed.toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}`;
  }, [dataStamp]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"" | UnifiedMapSeverity>("");
  const [layers, setLayers] = useState(defaultUnifiedMapLayers);
  const [selected, setSelected] = useState<{
    kind: UnifiedMapKind;
    id: string;
  } | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  const visiblePoints = useMemo(
    () => filterUnifiedMapPoints(allPoints, { search, severity, layers }),
    [allPoints, search, severity, layers],
  );
  const visibleRoutes = useMemo(
    () => visibleUnifiedMapRoutes(allRoutes, filterUnifiedMapPoints(allPoints, { search: "", severity: "", layers })),
    [allRoutes, allPoints, layers],
  );

  const focusTarget = useMemo(
    () =>
      focus
        ? (allPoints.find((point) => point.id === focus) ?? null)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, allPoints],
  );

  // Deep-link `?focus=ENTITY_ID`: nếu entity nằm trong phạm vi được phép đọc
  // thì chọn và bay tới; nếu không, bỏ qua lặng lẽ (không lộ dữ liệu).
  useEffect(() => {
    if (focusTarget) {
      setSelected({ kind: focusTarget.kind, id: focusTarget.id });
      setLayers((current) =>
        current[focusTarget.kind]
          ? current
          : { ...current, [focusTarget.kind]: true },
      );
      setFocusKey((key) => key + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  const detail = selected ? findUnifiedMapDetail(store, selected) : undefined;

  const toggleLayer = (kind: UnifiedMapKind) =>
    setLayers((current) => ({ ...current, [kind]: !current[kind] }));

  // focusTarget override dành cho click từ danh sách (không đổi URL).
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const activeFocusTarget = pendingFocus
    ? (allPoints.find((point) => point.id === pendingFocus) ?? focusTarget)
    : focusTarget;

  const visibleTotal = visiblePoints.length;
  /** Trường bão đang hiển thị: bản xem lại (nếu bật) hoặc dự báo trực tiếp. */
  const stormField = replayField ?? liveStormField;
  const replayPreset = HISTORICAL_STORM_PRESETS.find((item) => item.id === replayId);
  const hasBlockedRoute = visibleRoutes.some((route) => route.blocked);
  const hasOpenRoute = visibleRoutes.some((route) => !route.blocked);

  return (
    <div
      className={`workspace-content operational-map-page${
        replayPreset || replayError ? " has-replay-banner" : ""
      }`}
    >
      <PageSectionHeader
        section="Không gian tác nghiệp thống nhất"
        title="Bản đồ tác nghiệp"
        description="Góc nhìn không gian tổng hợp của toàn bộ hoạt động tác nghiệp — chỉ hiển thị các đối tượng trong phạm vi quyền đọc của tài khoản."
        icon={Layers3}
        actions={
          <div className="om-header-side">
            <span className="om-data-stamp" role="status">
              <i aria-hidden="true" />
              <span>Dữ liệu vận hành được phân quyền · {formattedDataStamp}</span>
            </span>
          </div>
        }
      />

      {/* ── Bộ lọc & Lớp dữ liệu — thanh ngang trên bản đồ ── */}
      <div className="om-filter-bar" role="toolbar" aria-label="Bộ lọc và lớp dữ liệu bản đồ">
        {/* Hàng 1: Tìm kiếm + Lọc mức ưu tiên + Tổng số đối tượng */}
        <div className="om-filter-bar-top">
          <div className="om-filter-search-box">
            <label className="ui-search incident-search" style={{ margin: 0, width: "100%" }}>
              <Search size={14} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo mã, tên hoặc khu vực…"
                aria-label="Tìm đối tượng trên bản đồ"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm">
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          <UiSelect
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "" | UnifiedMapSeverity)}
            aria-label="Lọc theo mức ưu tiên"
            className="om-filter-severity-select"
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option || "all"} value={option}>
                {option === "" ? "Tất cả mức ưu tiên" : option}
              </option>
            ))}
          </UiSelect>

          <span className="om-filter-count-badge">
            <b>{visibleTotal}</b> đối tượng hiển thị
          </span>

          {/* Xem lại bão lịch sử — dữ liệu tái phân tích ERA5, không phải dự báo */}
          <div className="om-replay-control">
            {HISTORICAL_STORM_PRESETS.map((preset) => {
              const active = replayId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`om-replay-btn${active ? " active" : ""}`}
                  onClick={() => setReplayId(active ? null : preset.id)}
                  title={preset.summary}
                  aria-pressed={active}
                >
                  {replayLoading && active ? (
                    <Loader2 size={14} className="om-replay-spin" />
                  ) : (
                    <History size={14} />
                  )}
                  {active ? "Đang xem lại: " : "Xem lại "}
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hàng 2: Lớp dữ liệu tự động xuống dòng (flex-wrap: wrap), không tràn viền */}
        <div className="om-filter-bar-bottom">
          <span className="om-filter-bar-label">Lớp:</span>
          <div className="om-layer-chips-wrap">
            {UNIFIED_MAP_LAYER_CONFIG.map((layer) => {
              const count = totals[layer.key];
              const active = layers[layer.key];
              return (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => toggleLayer(layer.key)}
                  className={`om-layer-chip${active ? " active" : ""}${count === 0 ? " empty" : ""}`}
                  aria-pressed={active}
                  title={count === 0 ? "Không có dữ liệu" : `${count} đối tượng`}
                >
                  <i style={{ background: layer.color }} />
                  <span>{layer.label}</span>
                  {count > 0 && <span className="om-chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!replayPreset && liveStormField?.storms?.length ? (
        <div className="om-storm-strip" role="status">
          <Tornado size={15} />
          <span>
            <b>ECMWF-IFS 10 ngày tới:</b>{" "}
            {liveStormField.storms
              .map((storm) => {
                const from = `${storm.points[0].time.slice(8, 10)}/${storm.points[0].time.slice(5, 7)}`;
                const to = `${storm.dissipation.point.time.slice(8, 10)}/${storm.dissipation.point.time.slice(5, 7)}`;
                const land = storm.landfall
                  ? `, đổ bộ ${storm.landfall.time.slice(8, 10)}/${storm.landfall.time.slice(5, 7)}`
                  : "";
                return `${storm.name} (${from}–${to}${land}, gió ${storm.maxWind} km/h — cấp ${beaufortLevel(storm.maxWind)})`;
              })
              .join(" · ")}
          </span>
          <button type="button" onClick={() => setStormFocusKey((value) => value + 1)}>
            Xem trên bản đồ
          </button>
        </div>
      ) : null}

      {(replayPreset || replayError) && (
        <div className={`om-replay-banner${replayError ? " is-error" : ""}`} role="status">
          <History size={15} />
          <span>
            {replayError ? (
              replayError
            ) : replayLoading ? (
              <>Đang nạp dữ liệu tái phân tích ERA5 cho {replayPreset?.label}…</>
            ) : (
              <>
                <b>DỮ LIỆU QUÁ KHỨ — KHÔNG PHẢI DỰ BÁO.</b> {replayPreset?.summary}{" "}
                {replayField?.storms.length
                  ? `Thuật toán dò bão dựng lại ${replayField.storms.length} đường đi từ trường khí áp ERA5.`
                  : ""}
              </>
            )}
          </span>
          <button type="button" onClick={() => setReplayId(null)}>
            Thoát xem lại
          </button>
        </div>
      )}

      {/* ── Bản đồ full-width ── */}
      <div className="om-layout">
        <div className="om-map-zone">
          <UnifiedMapCanvas
            points={visiblePoints}
            routes={visibleRoutes}
            focusKey={focusKey}
            focusTarget={activeFocusTarget ?? null}
            onSelect={setSelected}
            stormOverride={replayField}
            stormFocusKey={stormFocusKey}
          />

          {/* Chú giải ký hiệu tác nghiệp nằm góc dưới trái; toàn bộ dữ liệu khí
              tượng ECMWF-IFS đã được gom thành một khối riêng bên dưới bản đồ. */}
          <div className="om-legend-stack">
            <div className="om-legend" aria-label="Chú giải bản đồ">
              {UNIFIED_MAP_LAYER_CONFIG.map((layer) =>
                layers[layer.key] && totals[layer.key] > 0 ? (
                  <span key={layer.key}>
                    <i style={{ background: layer.color }} /> {layer.label}
                  </span>
                ) : null,
              )}
              {/* Chỉ liệt kê ký hiệu ĐANG THỰC SỰ VẼ trên bản đồ: nếu không có
                  tuyến sơ tán nào trong phạm vi/bộ lọc hiện tại thì không nêu. */}
              {hasOpenRoute && (
                <span className="om-legend-line"><b /> Tuyến sơ tán</span>
              )}
              {hasBlockedRoute && (
                <span className="om-legend-line om-legend-line-blocked"><b /> Tuyến bị chặn / hạn chế</span>
              )}

              {/* Ký hiệu khí tượng ĐANG VẼ TRÊN BẢN ĐỒ phải nằm ngay trong chú
                  giải của bản đồ. Bảng giải thích chi tiết bên dưới là phần bổ
                  sung, không phải nơi duy nhất tra ký hiệu — người trực không
                  nên phải cuộn trang mới biết vệt gió hay vòng tròn là gì. */}
              <span className="om-legend-sep" aria-hidden="true" />
              <span className="om-legend-svg">
                <svg width="26" height="12" aria-hidden="true">
                  <path d="M1 8 C 8 3, 16 3, 25 6" stroke="#64748b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  <path d="M1 4 C 7 1, 15 1, 22 3" stroke="#94a3b8" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </svg>
                Vệt gió 10m
              </span>
              {stormField?.storms?.length ? (
                <>
                  <span className="om-legend-svg">
                    <svg width="30" height="12" aria-hidden="true">
                      <line x1="1" y1="6" x2="13" y2="6" stroke={stormColor(stormField.storms[0].category)} strokeWidth="3" strokeLinecap="round" />
                      <line x1="16" y1="6" x2="29" y2="6" stroke={stormColor(stormField.storms[0].category)} strokeWidth="3" strokeDasharray="4 3" strokeLinecap="round" />
                    </svg>
                    Đường đi đã qua / dự báo
                  </span>
                  <span className="om-legend-svg">
                    <svg width="26" height="14" aria-hidden="true">
                      <circle cx="13" cy="7" r="6" fill="rgba(14,165,233,0.18)" stroke="rgba(14,165,233,0.6)" strokeWidth="1" />
                      <circle cx="13" cy="7" r="2.6" fill={stormColor(stormField.storms[0].category)} stroke="#fff" strokeWidth="1.4" />
                    </svg>
                    Tâm bão &amp; bán kính gió mạnh
                  </span>
                  {stormField.storms.some((storm) => storm.landfall) && (
                    <span className="om-legend-svg">
                      <span style={{ color: "#b91c1c", fontSize: "13px", lineHeight: 1 }}>▲</span>
                      Mốc đổ bộ
                    </span>
                  )}
                  <span className="om-legend-svg">
                    <span style={{ color: "#475569", fontSize: "13px", lineHeight: 1 }}>✕</span>
                    Mốc bão tan
                  </span>
                  <span className="om-legend-storm">
                    {stormField.storms[0].name} · cấp {beaufortLevel(stormField.storms[0].maxWind)}
                  </span>
                </>
              ) : (
                <span className="om-legend-svg om-legend-quiet">
                  <svg width="14" height="14" aria-hidden="true">
                    <circle cx="7" cy="7" r="5" fill="#22c55e" />
                  </svg>
                  Không có xoáy thuận trong 10 ngày tới
                </span>
              )}
              <span className="om-legend-svg">
                <svg width="46" height="10" aria-hidden="true">
                  <defs>
                    <linearGradient id="om-legend-temp" x1="0" x2="1">
                      <stop offset="0" stopColor="#2563eb" />
                      <stop offset="0.35" stopColor="#22c55e" />
                      <stop offset="0.7" stopColor="#f59e0b" />
                      <stop offset="1" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="2" width="46" height="6" rx="3" fill="url(#om-legend-temp)" />
                </svg>
                Nhiệt độ 18–34°C
              </span>
            </div>
          </div>

          {visibleTotal === 0 && (
            <div className="om-empty" role="status">
              <Crosshair size={18} />
              <p>Không có đối tượng nào khớp bộ lọc trong phạm vi quyền đọc.</p>
            </div>
          )}
          {detail && (
            <EntityDetailDrawer
              detail={detail}
              onClose={() => { setSelected(null); setPendingFocus(null); }}
              onOpenDetail={navigate}
            />
          )}
        </div>
      </div>


      {/* ── Khối khí tượng ECMWF-IFS: gộp trường nhiệt độ + bão/dòng gió ──
          Đặt ngoài khung bản đồ để không che địa hình và có đủ chỗ giải thích
          ý nghĩa từng ký hiệu đang vẽ trên bản đồ. */}
      <section className="om-weather-board" aria-label="Dữ liệu khí tượng ECMWF-IFS trên bản đồ">
        <header className="om-weather-board-head">
          <span className="om-weather-board-title">
            <Thermometer size={15} /> Dữ liệu khí tượng ECMWF-IFS đang hiển thị trên bản đồ
          </span>
          {weatherMeta ? (
            <span
              className={`om-weather-board-meta${weatherMeta.isFallback ? " is-fallback" : ""}`}
            >
              {weatherMeta.statusText}
            </span>
          ) : null}
        </header>

        <div className="om-weather-board-grid">
          {/* 1. Thang nhiệt độ */}
          <article className="om-weather-card">
            <h4>
              <Thermometer size={13} color="#ef4444" /> Trường nhiệt độ bề mặt
            </h4>
            <div className="om-temp-bar" />
            <div className="om-temp-ticks">
              <span>18°</span>
              <span>22°</span>
              <span>26°</span>
              <span>30°</span>
              <span>34°</span>
            </div>
            <p className="om-weather-note">
              Màu nền trên đất liền là nhiệt độ không khí 2 m, dựng từ các điểm đo của mô hình ECMWF-IFS.
            </p>
          </article>

          {/* 2. Bão & dòng gió */}
          <article className="om-weather-card">
            <h4>
              <Tornado size={13} color="#f59e0b" /> Bão &amp; dòng gió 10m
            </h4>
            {stormField?.storms?.length ? (
              <ul className="om-weather-list">
                {stormField.storms.slice(0, 3).map((storm) => (
                  <li key={storm.id}>
                    <i style={{ background: stormColor(storm.category) }} />
                    <span>
                      <b>{storm.name}</b> · cấp {beaufortLevel(storm.maxWind)} ·{" "}
                      {storm.minPressure} hPa · gió {storm.maxWind} km/h (giật {storm.maxGusts} km/h)
                      <br />
                      <small style={{ color: "#64748b" }}>
                        {storm.points[0].time.slice(8, 10)}/{storm.points[0].time.slice(5, 7)} →{" "}
                        {storm.dissipation.point.time.slice(8, 10)}/
                        {storm.dissipation.point.time.slice(5, 7)}
                        {storm.landfall
                          ? ` · đổ bộ ${storm.landfall.time.slice(8, 10)}/${storm.landfall.time.slice(5, 7)} lúc ${storm.landfall.time.slice(11, 16)}`
                          : " · không đổ bộ"}
                        {storm.dissipation.reason === "đất liền"
                          ? " · tan trong đất liền"
                          : " · còn hoạt động cuối chuỗi dự báo"}
                      </small>
                    </span>
                  </li>
                ))}
                {stormField.storms.length > 3 ? (
                  <li>
                    <i style={{ background: "#94a3b8" }} />
                    <span>+{stormField.storms.length - 3} vùng xoáy yếu hơn trên Biển Đông</span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <ul className="om-weather-list">
                <li>
                  <i style={{ background: "#22c55e" }} />
                  <span>Không phát hiện xoáy thuận nhiệt đới trong 5 ngày tới</span>
                </li>
              </ul>
            )}
            <p className="om-weather-note">
              {replayPreset
                ? `Đang xem lại ${replayPreset.label} bằng dữ liệu tái phân tích ERA5 (${replayPreset.startDate} → ${replayPreset.endDate}) — không phải dự báo hiện tại.`
                : "Kết quả dò tự động từ trường khí áp mực biển — chỉ để tham khảo, không thay thế bản tin bão chính thức của Trung tâm Dự báo KTTV Quốc gia."}
            </p>
          </article>

          {/* 3. Giải nghĩa ký hiệu đang vẽ trên bản đồ */}
          <article className="om-weather-card">
            <h4>Ký hiệu trên bản đồ</h4>
            <ul className="om-weather-symbols">
              <li>
                <svg width="34" height="12" aria-hidden="true">
                  <line x1="1" y1="6" x2="33" y2="6" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>Nét liền: quỹ đạo tâm xoáy <b>đã đi qua</b></span>
              </li>
              <li>
                <svg width="34" height="12" aria-hidden="true">
                  <line x1="1" y1="6" x2="33" y2="6" stroke="#0ea5e9" strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" />
                </svg>
                <span>Nét đứt: quỹ đạo <b>dự báo</b> 5 ngày tới</span>
              </li>
              <li>
                <svg width="34" height="12" aria-hidden="true">
                  <circle cx="17" cy="6" r="4.5" fill="#0ea5e9" stroke="#fff" strokeWidth="1.6" />
                </svg>
                <span>Chấm tròn: vị trí tâm theo từng <b>mốc 6 giờ</b> (di chuột để xem chi tiết)</span>
              </li>
              <li>
                <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden="true">
                  <circle cx="17" cy="9" r="8.4" fill="#fff" stroke="#0ea5e9" strokeWidth="1.4" />
                  <path d="M17 9c0-3.2 2.4-5.2 5.6-5.2-1.2 1.6-1.2 3.2-2.4 4.4-.8.8-2 .8-3.2.8Z" fill="#0ea5e9" />
                  <path d="M17 9c0 3.2-2.4 5.2-5.6 5.2 1.2-1.6 1.2-3.2 2.4-4.4.8-.8 2-.8 3.2-.8Z" fill="#0ea5e9" />
                </svg>
                <span>Biểu tượng xoáy: <b>vị trí tâm hiện tại</b>; vòng mờ quanh nó là bán kính gió mạnh</span>
              </li>
              <li>
                <svg width="34" height="12" aria-hidden="true">
                  <path d="M2 9c8-5 14 1 22-4" stroke="#1c5692" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  <path d="M4 4c6-3 12 2 18-1" stroke="#1c5692" strokeWidth="1.1" fill="none" opacity="0.6" strokeLinecap="round" />
                </svg>
                <span>Vệt gió chuyển động: <b>hướng và tốc độ gió 10m</b> (vệt càng nhanh, gió càng mạnh)</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <div style={{ marginTop: "20px" }}>
        <EcmwfWeatherPanel />
      </div>
    </div>
  );
}

