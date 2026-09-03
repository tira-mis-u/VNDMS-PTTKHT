import { Select as UiSelect } from "@/components/ui/Select";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Layers3, Search, Thermometer, X } from "lucide-react";
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
  subscribeWeatherMetadata,
  type WeatherMetadata,
} from "@/infrastructure/weather/ecmwfWeatherService";

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

  useEffect(() => {
    const unsub = subscribeWeatherMetadata(setWeatherMeta);
    return unsub;
  }, []);

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

  return (
    <div className="workspace-content operational-map-page">
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

      {/* ── Bản đồ full-width ── */}
      <div className="om-layout">
        <div className="om-map-zone">
          <UnifiedMapCanvas
            points={visiblePoints}
            routes={visibleRoutes}
            focusKey={focusKey}
            focusTarget={activeFocusTarget ?? null}
            onSelect={setSelected}
          />

          {/* Temperature legend — always visible, bottom-left */}
          <div className="om-temp-legend" role="region" aria-label="Trường nhiệt độ ECMWF-IFS">
            <div className="om-temp-legend-title">
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Thermometer size={14} color="#f87171" /> Trường nhiệt độ ECMWF-IFS
              </span>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>Nội suy liên tục (°C)</span>
            </div>
            {weatherMeta && (
              <div style={{ fontSize: "9.5px", marginTop: "2px", marginBottom: "4px", color: weatherMeta.isFallback ? "#b45309" : "#64748b", fontWeight: 500 }}>
                {weatherMeta.statusText}
              </div>
            )}
            <div className="om-temp-bar" />
            <div className="om-temp-ticks">
              <span>18°</span>
              <span>22°</span>
              <span>26°</span>
              <span>30°</span>
              <span>34°</span>
            </div>
          </div>

          {/* Map symbol legend — bottom-left below temp legend */}
          <div className="om-legend" aria-label="Chú giải bản đồ">
            {UNIFIED_MAP_LAYER_CONFIG.map((layer) =>
              layers[layer.key] && totals[layer.key] > 0 ? (
                <span key={layer.key}>
                  <i style={{ background: layer.color }} /> {layer.label}
                </span>
              ) : null,
            )}
            <span className="om-legend-line"><b /> Tuyến sơ tán</span>
            <span className="om-legend-line om-legend-line-blocked"><b /> Tuyến bị chặn / hạn chế</span>
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

      <div style={{ marginTop: "20px" }}>
        <EcmwfWeatherPanel />
      </div>
    </div>
  );
}

