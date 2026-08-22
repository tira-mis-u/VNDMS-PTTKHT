import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import { Minus, Plus, Scan } from "lucide-react";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  UNIFIED_MAP_LAYER_CONFIG,
  type UnifiedMapKind,
  type UnifiedMapPoint,
  type UnifiedMapRouteLine,
} from "@/application/map/unifiedMapQueries";

const DEFAULT_CENTER: [number, number] = [105.852, 21.052];
const DEFAULT_ZOOM = 11;

function pointCollection(points: UnifiedMapPoint[], kind: UnifiedMapKind) {
  return {
    type: "FeatureCollection" as const,
    features: points
      .filter((point) => point.kind === kind)
      .map((point) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: point.coordinates },
        properties: {
          id: point.id,
          kind: point.kind,
          code: point.code,
          title: point.title,
          area: point.area,
        },
      })),
  };
}

function lineCollection(
  routes: UnifiedMapRouteLine[],
  blocked: boolean,
) {
  return {
    type: "FeatureCollection" as const,
    features: routes
      .filter((route) => route.blocked === blocked)
      .map((route) => ({
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: route.points },
        properties: {
          id: route.id,
          operationId: route.operationId,
          name: route.name,
          status: route.status,
        },
      })),
  };
}

const RADIUS: Partial<Record<UnifiedMapKind, number>> = {
  sos: 8,
  incident: 7.5,
  task: 6.5,
};

export function UnifiedMapCanvas({
  points,
  routes,
  focusKey,
  onSelect,
  focusTarget,
}: {
  points: UnifiedMapPoint[];
  routes: UnifiedMapRouteLine[];
  /** Tăng key để yêu cầu bản đồ bay tới entity focus (deep-link/search). */
  focusKey: number;
  focusTarget: UnifiedMapPoint | null;
  onSelect: (ref: { kind: UnifiedMapKind; id: string }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Khởi tạo bản đồ một lần; mọi cập nhật dữ liệu đi qua setData.
  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current);
    map.on("load", () => {
      map.resize();
      applyVietnameseMapLabels(map);
      addVietnamSeaLabels(map, "om");

      for (const layer of UNIFIED_MAP_LAYER_CONFIG) {
        map.addSource(`om-${layer.key}`, {
          type: "geojson",
          data: pointCollection([], layer.key),
        });
        map.addLayer({
          id: `om-${layer.key}-points`,
          type: "circle",
          source: `om-${layer.key}`,
          paint: {
            "circle-radius": RADIUS[layer.key] ?? 6,
            "circle-color": layer.color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.96,
          },
        });
        map.addLayer({
          id: `om-${layer.key}-labels`,
          type: "symbol",
          source: `om-${layer.key}`,
          minzoom: 11.2,
          layout: {
            "text-field": ["get", "code"],
            "text-size": 10.5,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-optional": true,
          },
          paint: {
            "text-color": "#2c3a4d",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.6,
          },
        });
        if (layer.key === "evacuation") continue;
        map.on("click", `om-${layer.key}-points`, (event: MapLayerMouseEvent) => {
          const props = event.features?.[0]?.properties;
          if (!props) return;
          onSelectRef.current({
            kind: props.kind as UnifiedMapKind,
            id: props.id,
          });
        });
        map.on("mouseenter", `om-${layer.key}-points`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `om-${layer.key}-points`, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Tuyến sơ tán: hai source theo trạng thái (thông suốt / bị chặn-hạn chế).
      map.addSource("om-routes-ok", {
        type: "geojson",
        data: lineCollection([], false),
      });
      map.addSource("om-routes-blocked", {
        type: "geojson",
        data: lineCollection([], true),
      });
      map.addLayer({
        id: "om-routes-ok-line",
        type: "line",
        source: "om-routes-ok",
        paint: {
          "line-color": "#0e7490",
          "line-width": 3,
          "line-opacity": 0.75,
        },
      });
      map.addLayer({
        id: "om-routes-blocked-line",
        type: "line",
        source: "om-routes-blocked",
        paint: {
          "line-color": "#d92d20",
          "line-width": 3,
          "line-opacity": 0.85,
          "line-dasharray": [2, 1.6],
        },
      });
      for (const id of ["om-routes-ok-line", "om-routes-blocked-line"]) {
        map.on("click", id, (event: MapLayerMouseEvent) => {
          const props = event.features?.[0]?.properties;
          if (!props?.operationId) return;
          onSelectRef.current({
            kind: "evacuation",
            id: props.operationId,
          });
        });
        map.on("mouseenter", id, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", id, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      setReady(true);
    });
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Đồng bộ dữ liệu đã phân quyền vào các source.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of UNIFIED_MAP_LAYER_CONFIG) {
      const source = map.getSource(`om-${layer.key}`) as
        | GeoJSONSource
        | undefined;
      source?.setData(pointCollection(points, layer.key));
    }
    const ok = map.getSource("om-routes-ok") as GeoJSONSource | undefined;
    ok?.setData(lineCollection(routes, false));
    const blocked = map.getSource("om-routes-blocked") as
      | GeoJSONSource
      | undefined;
    blocked?.setData(lineCollection(routes, true));
  }, [points, routes, ready]);

  // Deep-link focus: bay tới điểm và báo page mở drawer.
  useEffect(() => {
    if (focusKey <= 0 || !focusTarget) return;
    const map = mapRef.current;
    if (!map || !ready) return;
    map.flyTo({
      center: focusTarget.coordinates,
      zoom: Math.max(map.getZoom(), 12.2),
      duration: 700,
    });
  }, [focusKey, focusTarget, ready]);

  const zoomBy = (amount: number) =>
    mapRef.current?.zoomTo(
      (mapRef.current.getZoom() ?? DEFAULT_ZOOM) + amount,
      { duration: 200 },
    );

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    if (points.length === 0) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 500 });
      return;
    }
    if (points.length === 1) {
      map.flyTo({ center: points[0].coordinates, zoom: 12, duration: 500 });
      return;
    }
    const lngs = points.map((p) => p.coordinates[0]);
    const lats = points.map((p) => p.coordinates[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, maxZoom: 12.4, duration: 500 },
    );
  };

  return (
    <div className="om-canvas-wrap">
      <div
        ref={container}
        className="om-canvas map-canvas"
        aria-label="Bản đồ tác nghiệp thống nhất"
      />
      <div className="map-toolbar om-toolbar" aria-label="Điều khiển bản đồ">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Phóng to">
          <Plus size={16} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Thu nhỏ">
          <Minus size={16} />
        </button>
        <button type="button" onClick={resetView} aria-label="Vừa khung dữ liệu">
          <Scan size={15} />
        </button>
      </div>
    </div>
  );
}
