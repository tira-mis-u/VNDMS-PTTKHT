import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import { Layers3, Minus, Plus } from "lucide-react";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";

export default function IncidentDetailMap({
  incident,
  team,
}: {
  incident: Incident;
  team?: RescueTeam;
}) {
  const { shelters, sosRequests } = useOperationalState();
  const relatedShelters = useMemo(
    () =>
      shelters.filter((item) => item.linkedIncidentIds.includes(incident.id)),
    [shelters, incident.id],
  );
  const relatedSos = useMemo(
    () => sosRequests.filter((item) => item.linkedIncidentId === incident.id),
    [sosRequests, incident.id],
  );
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [legend, setLegend] = useState(true);
  useEffect(() => {
    if (!container.current) return;
    const [lng, lat] = incident.location.coordinates;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: [lng, lat],
      zoom: 13.4,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      const affected = {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [lng - 0.018, lat - 0.009],
              [lng + 0.011, lat - 0.011],
              [lng + 0.019, lat + 0.005],
              [lng + 0.006, lat + 0.014],
              [lng - 0.015, lat + 0.009],
              [lng - 0.018, lat - 0.009],
            ],
          ],
        },
        properties: {},
      };
      map.addSource("affected-area", { type: "geojson", data: affected });
      map.addLayer({
        id: "affected-fill",
        type: "fill",
        source: "affected-area",
        paint: { "fill-color": "#f79009", "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "affected-line",
        type: "line",
        source: "affected-area",
        paint: {
          "line-color": "#dc6803",
          "line-width": 2,
          "line-dasharray": [3, 2],
        },
      });
      const points = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [lng, lat] },
            properties: { kind: "incident", label: incident.id },
          },
          ...(team
            ? [
                {
                  type: "Feature" as const,
                  geometry: {
                    type: "Point" as const,
                    coordinates: team.coordinates,
                  },
                  properties: { kind: "team", label: team.id },
                },
              ]
            : []),
          ...relatedShelters.slice(0, 2).map((item) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: item.coordinates,
            },
            properties: { kind: "shelter", label: item.id },
          })),
          ...relatedSos.map((item) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: item.location.coordinates,
            },
            properties: { kind: "sos", label: item.id },
          })),
        ],
      };
      map.addSource("incident-points", { type: "geojson", data: points });
      const colors = [
        "match",
        ["get", "kind"],
        "incident",
        "#d92d20",
        "sos",
        "#b42318",
        "team",
        "#1570ef",
        "shelter",
        "#079455",
        "#667085",
      ];
      map.addLayer({
        id: "incident-points",
        type: "circle",
        source: "incident-points",
        paint: {
          "circle-radius": [
            "match",
            ["get", "kind"],
            "incident",
            8,
            "sos",
            7,
            6,
          ],
          "circle-color": colors as never,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "incident-labels",
        type: "symbol",
        source: "incident-points",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#344054",
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
        },
      });
      const route = {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [lng - 0.025, lat - 0.015],
            [lng - 0.012, lat - 0.004],
            [lng, lat],
            [lng + 0.016, lat + 0.009],
          ],
        },
        properties: {},
      };
      map.addSource("evacuation-route", { type: "geojson", data: route });
      map.addLayer({
        id: "evacuation-route",
        type: "line",
        source: "evacuation-route",
        paint: {
          "line-color": "#175cd3",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
      const blocked = {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [lng - 0.012, lat + 0.005],
            [lng - 0.002, lat + 0.001],
          ],
        },
        properties: {},
      };
      map.addSource("blocked-road", { type: "geojson", data: blocked });
      map.addLayer({
        id: "blocked-road",
        type: "line",
        source: "blocked-road",
        paint: { "line-color": "#d92d20", "line-width": 4 },
      });
      addVietnamSeaLabels(map, "incident");
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [incident, team, relatedShelters, relatedSos]);
  const zoom = (delta: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 13) + delta, {
      duration: 200,
    });
  return (
    <div className="incident-detail-map">
      <div ref={container} className="map-canvas" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải dữ liệu bản đồ…
        </div>
      )}
      <div className="map-toolbar">
        <button onClick={() => zoom(1)} title="Phóng to">
          <Plus size={16} />
        </button>
        <span />
        <button onClick={() => zoom(-1)} title="Thu nhỏ">
          <Minus size={16} />
        </button>
      </div>
      <button
        className="incident-map-layers"
        onClick={() => setLegend(!legend)}
      >
        <Layers3 size={14} />
        Lớp hiển thị
      </button>
      {legend && (
        <div className="incident-map-legend">
          <span>
            <i className="map-dot incident" />
            Sự cố
          </span>
          <span>
            <i className="map-dot sos" />
            SOS
          </span>
          <span>
            <i className="map-dot team" />
            Đội cứu hộ
          </span>
          <span>
            <i className="map-dot shelter" />
            Điểm sơ tán
          </span>
          <span>
            <i className="map-line route" />
            Tuyến sơ tán
          </span>
          <span>
            <i className="map-line blocked" />
            Đường hạn chế
          </span>
        </div>
      )}
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
