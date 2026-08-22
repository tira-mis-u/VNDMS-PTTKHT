import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import { Layers3, Minus, Plus, Scan } from "lucide-react";
import { OPERATIONAL_MAP_WORKSPACE_PATH } from "@/app/routes/router";
import type {
  CommandCenterEntityKind,
  CommandCenterEntityRef,
} from "@/application/command-center/commandCenterQueries";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

const layerConfig: Array<{
  key: CommandCenterEntityKind;
  label: string;
  color: string;
}> = [
  { key: "sos", label: "SOS", color: "#d92d20" },
  { key: "incident", label: "Sự cố", color: "#f79009" },
  { key: "team", label: "Đội cứu hộ", color: "#1570ef" },
  { key: "shelter", label: "Điểm sơ tán", color: "#079455" },
];

function toCollection(
  kind: CommandCenterEntityKind,
  rows: Array<{
    id: string;
    coordinates: [number, number];
    name?: string;
    area?: string;
  }>,
) {
  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: row.coordinates },
      properties: {
        id: row.id,
        kind,
        label: row.id,
        title: row.name ?? row.area ?? row.id,
      },
    })),
  };
}

export function OperationalMap({
  onOpen,
  onNavigate,
}: {
  onOpen: (ref: CommandCenterEntityRef) => void;
  onNavigate: (path: string) => void;
}) {
  const { incidents, teams, shelters, sosRequests } = useOperationalState();
  const incidentsRef = useRef(incidents);
  const teamsRef = useRef(teams);
  const sheltersRef = useRef(shelters);
  const sosRef = useRef(sosRequests);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    sos: true,
    incident: true,
    team: true,
    shelter: true,
  });

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: [105.852, 21.052],
      zoom: 11.2,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);

      const collections = {
        sos: toCollection(
          "sos",
          sosRef.current.map((item) => ({
            id: item.id,
            name: item.description,
            area: item.location.address,
            coordinates: item.location.coordinates,
          })),
        ),
        incident: toCollection(
          "incident",
          incidentsRef.current.map((item) => ({
            id: item.id,
            name: item.title,
            area: item.location.name,
            coordinates: item.location.coordinates,
          })),
        ),
        team: toCollection("team", teamsRef.current),
        shelter: toCollection("shelter", sheltersRef.current),
      };
      layerConfig.forEach((config) => {
        map.addSource(`cc-${config.key}`, {
          type: "geojson",
          data: collections[config.key as keyof typeof collections],
        });
        map.addLayer({
          id: `cc-${config.key}-points`,
          type: "circle",
          source: `cc-${config.key}`,
          paint: {
            "circle-radius":
              config.key === "sos" ? 8 : config.key === "incident" ? 7 : 6,
            "circle-color": config.color,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: `cc-${config.key}-labels`,
          type: "symbol",
          source: `cc-${config.key}`,
          minzoom: 10.4,
          layout: {
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-offset": [0, 1.35],
            "text-anchor": "top",
          },
          paint: {
            "text-color": "#344054",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
        map.on("click", `cc-${config.key}-points`, (event) => {
          const item = event.features?.[0]?.properties;
          if (!item) return;
          if (item.kind === "incident") onNavigate(`/incidents/${item.id}`);
          else if (item.kind === "team") onNavigate(`/teams/${item.id}`);
          else if (item.kind === "sos") onNavigate(`/sos/${item.id}`);
          else if (item.kind === "shelter") onNavigate(`/shelters/${item.id}`);
          else
            onOpen({ kind: item.kind as CommandCenterEntityKind, id: item.id });
        });
        map.on("mouseenter", `cc-${config.key}-points`, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", `cc-${config.key}-points`, () => {
          map.getCanvas().style.cursor = "";
        });
      });
      addVietnamSeaLabels(map, "cc");
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onOpen, onNavigate]);

  useEffect(() => {
    incidentsRef.current = incidents;
    teamsRef.current = teams;
    sheltersRef.current = shelters;
    sosRef.current = sosRequests;
    if (!ready) return;
    const incidentSource = mapRef.current?.getSource("cc-incident") as
      GeoJSONSource | undefined;
    incidentSource?.setData(
      toCollection(
        "incident",
        incidents.map((item) => ({
          id: item.id,
          name: item.title,
          area: item.location.name,
          coordinates: item.location.coordinates,
        })),
      ),
    );
    const teamSource = mapRef.current?.getSource("cc-team") as
      GeoJSONSource | undefined;
    teamSource?.setData(toCollection("team", teams));
    const sosSource = mapRef.current?.getSource("cc-sos") as
      GeoJSONSource | undefined;
    sosSource?.setData(
      toCollection(
        "sos",
        sosRequests.map((item) => ({
          id: item.id,
          name: item.description,
          area: item.location.address,
          coordinates: item.location.coordinates,
        })),
      ),
    );
    const shelterSource = mapRef.current?.getSource("cc-shelter") as
      GeoJSONSource | undefined;
    shelterSource?.setData(toCollection("shelter", shelters));
  }, [incidents, teams, shelters, sosRequests, ready]);

  const toggleLayer = (key: string) => {
    const next = !visible[key];
    setVisible((current) => ({ ...current, [key]: next }));
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    [`cc-${key}-points`, `cc-${key}-labels`].forEach((id) => {
      if (map.getLayer(id))
        map.setLayoutProperty(id, "visibility", next ? "visible" : "none");
    });
  };
  const zoom = (amount: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 11) + amount, {
      duration: 200,
    });

  return (
    <section className="content-section cc-map-section">
      <div className="section-heading">
        <div>
          <h2>Bản đồ tác nghiệp</h2>
          <p>Sự cố, yêu cầu hỗ trợ và lực lượng trong kịch bản Lũ Sông Hồng</p>
        </div>
        <div className="section-heading-actions">
          <button
            className="text-action"
            onClick={() => onNavigate(OPERATIONAL_MAP_WORKSPACE_PATH)}
          >
            <Scan size={14} />
            Mở bản đồ tác nghiệp
          </button>
          <button
            className="text-action"
            onClick={() => setLayersOpen(!layersOpen)}
          >
            <Layers3 size={14} />
            Lớp dữ liệu
          </button>
        </div>
      </div>
      <div className="cc-map-shell">
        <div
          ref={container}
          className="map-canvas"
          aria-label="Bản đồ tác nghiệp thực tế tại Hà Nội"
        />
        {!ready && (
          <div className="map-loading">
            <span className="spinner" />
            Đang tải bản đồ tác nghiệp…
          </div>
        )}
        <div className="map-toolbar">
          <button title="Phóng to" onClick={() => zoom(1)}>
            <Plus size={16} />
          </button>
          <span />
          <button title="Thu nhỏ" onClick={() => zoom(-1)}>
            <Minus size={16} />
          </button>
        </div>
        {layersOpen && (
          <div className="cc-layer-control">
            <strong>Lớp dữ liệu</strong>
            {layerConfig.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleLayer(item.key)}
                className={!visible[item.key] ? "disabled" : ""}
              >
                <i style={{ background: item.color }} />
                {item.label}
                <span>{visible[item.key] ? "Hiện" : "Ẩn"}</span>
              </button>
            ))}
          </div>
        )}
        <div className="map-legend">
          {layerConfig.map((item) => (
            <span key={item.key}>
              <i className="legend-dot" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
      </div>
    </section>
  );
}
