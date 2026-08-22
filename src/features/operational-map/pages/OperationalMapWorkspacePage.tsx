import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Crosshair, Layers3, Search, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
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
  type UnifiedMapPoint,
  type UnifiedMapSeverity,
} from "@/application/map/unifiedMapQueries";
import { UnifiedMapCanvas } from "../components/UnifiedMapCanvas";
import { EntityDetailDrawer } from "../components/EntityDetailDrawer";

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
  const dataStamp = getUnifiedMapDataStamp(store);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<"" | UnifiedMapSeverity>("");
  const [layers, setLayers] = useState(defaultUnifiedMapLayers);
  const [panelOpen, setPanelOpen] = useState(true);
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

  const jumpTo = (point: UnifiedMapPoint) => {
    setSelected({ kind: point.kind, id: point.id });
    setLayers((current) =>
      current[point.kind] ? current : { ...current, [point.kind]: true },
    );
    setFocusKey((key) => key + 1);
    setPendingFocus(point.id);
  };

  // focusTarget override dành cho click từ danh sách (không đổi URL).
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const activeFocusTarget = pendingFocus
    ? (allPoints.find((point) => point.id === pendingFocus) ?? focusTarget)
    : focusTarget;

  const visibleTotal = visiblePoints.length;

  return (
    <div className="workspace-content operational-map-page">
      <div className="page-header">
        <div>
          <div className="breadcrumbs">
            <span>Quản lý &amp; điều hành</span>
            <ChevronRight size={13} />
            <b>Bản đồ tác nghiệp</b>
          </div>
          <h1>Bản đồ tác nghiệp</h1>
          <p>
            Góc nhìn không gian tổng hợp của toàn bộ hoạt động tác nghiệp —
            chỉ hiển thị các đối tượng trong phạm vi quyền đọc của tài khoản.
          </p>
        </div>
        <div className="om-header-side">
          <span className="om-data-stamp">
            <i /> Dữ liệu nghiệp vụ đã đồng bộ{dataStamp ? ` · ${dataStamp}` : ""}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls="om-layer-panel"
          >
            <Layers3 size={15} />
            Lớp dữ liệu
          </Button>
        </div>
      </div>

      <div className={`om-layout${panelOpen ? "" : " om-panel-collapsed"}`}>
        <div className="om-map-zone">
          <UnifiedMapCanvas
            points={visiblePoints}
            routes={visibleRoutes}
            focusKey={focusKey}
            focusTarget={activeFocusTarget ?? null}
            onSelect={setSelected}
          />
          <div className="om-legend" aria-label="Chú giải bản đồ">
            {UNIFIED_MAP_LAYER_CONFIG.map((layer) =>
              totals[layer.key] > 0 ? (
                <span key={layer.key}>
                  <i style={{ background: layer.color }} /> {layer.label}
                </span>
              ) : null,
            )}
            <span className="om-legend-line">
              <b /> Tuyến sơ tán
            </span>
            <span className="om-legend-line om-legend-line-blocked">
              <b /> Tuyến bị chặn / hạn chế
            </span>
          </div>
          {visibleTotal === 0 && (
            <div className="om-empty" role="status">
              <Crosshair size={18} />
              <p>
                Không có đối tượng nào khớp bộ lọc trong phạm vi quyền đọc.
              </p>
            </div>
          )}
          {detail && (
            <EntityDetailDrawer
              detail={detail}
              onClose={() => {
                setSelected(null);
                setPendingFocus(null);
              }}
              onOpenDetail={navigate}
            />
          )}
        </div>

        <aside
          id="om-layer-panel"
          className="om-panel"
          aria-label="Bảng lớp dữ liệu và bộ lọc"
        >
          <div className="om-panel-section">
            <h2>Lọc đối tượng</h2>
            <label className="incident-search om-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo mã, tên hoặc khu vực…"
                aria-label="Tìm đối tượng trên bản đồ"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </label>
            <select
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as "" | UnifiedMapSeverity)
              }
              aria-label="Lọc theo mức ưu tiên"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option === "" ? "Tất cả mức ưu tiên" : option}
                </option>
              ))}
            </select>
          </div>

          <div className="om-panel-section">
            <h2>
              Lớp tác nghiệp <small>{visibleTotal} đối tượng hiển thị</small>
            </h2>
            <ul className="om-layer-list" role="list">
              {UNIFIED_MAP_LAYER_CONFIG.map((layer) => {
                const count = totals[layer.key];
                const active = layers[layer.key];
                return (
                  <li key={layer.key}>
                    <label
                      className={`om-layer-row${count === 0 ? " is-empty" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleLayer(layer.key)}
                      />
                      <i style={{ background: layer.color }} />
                      <span className="om-layer-name">{layer.label}</span>
                      <span className="om-layer-count">{count}</span>
                    </label>
                    {count === 0 && (
                      <p className="om-layer-empty">
                        Không có dữ liệu trong phạm vi quyền
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="om-panel-section om-panel-results">
            <h2>Kết quả trên bản đồ</h2>
            {visiblePoints.length === 0 ? (
              <p className="om-panel-none">
                Không có đối tượng nào — đổi bộ lọc hoặc bật thêm lớp.
              </p>
            ) : (
              <ul className="om-result-list" role="list">
                {visiblePoints.map((point) => (
                  <li key={`${point.kind}:${point.id}`}>
                    <button
                      type="button"
                      className={`om-result-row${
                        selected?.id === point.id ? " active" : ""
                      }`}
                      onClick={() => jumpTo(point)}
                    >
                      <span className="om-result-head">
                        <b>{point.code}</b>
                        <Badge tone={point.tone}>{point.status}</Badge>
                      </span>
                      <span className="om-result-title">{point.title}</span>
                      <span className="om-result-area">{point.area}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
