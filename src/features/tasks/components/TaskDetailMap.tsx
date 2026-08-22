import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import { Minus, Plus } from "lucide-react";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
export default function TaskDetailMap({
  task,
  incident,
  team,
}: {
  task: IncidentTask;
  incident?: Incident;
  team?: RescueTeam;
}) {
  const { shelters } = useOperationalState();
  const nearest =
    shelters.find((item) => item.linkedIncidentIds.includes(task.incidentId)) ??
    shelters[0];
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const [lng, lat] = task.coordinates;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: [lng, lat],
      zoom: 13.7,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      const points = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: task.coordinates },
            properties: { kind: "task", label: task.id },
          },
          ...(incident
            ? [
                {
                  type: "Feature" as const,
                  geometry: {
                    type: "Point" as const,
                    coordinates: incident.location.coordinates,
                  },
                  properties: { kind: "incident", label: incident.id },
                },
              ]
            : []),
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
          ...(nearest
            ? [
                {
                  type: "Feature" as const,
                  geometry: {
                    type: "Point" as const,
                    coordinates: nearest.coordinates,
                  },
                  properties: { kind: "shelter", label: nearest.id },
                },
              ]
            : []),
        ],
      };
      map.addSource("task-points", { type: "geojson", data: points });
      map.addLayer({
        id: "task-points",
        type: "circle",
        source: "task-points",
        paint: {
          "circle-radius": ["match", ["get", "kind"], "task", 8, 6],
          "circle-color": [
            "match",
            ["get", "kind"],
            "task",
            "#d92d20",
            "incident",
            "#f79009",
            "team",
            "#1570ef",
            "shelter",
            "#079455",
            "#667085",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "task-labels",
        type: "symbol",
        source: "task-points",
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
            team?.coordinates ?? [lng - 0.02, lat - 0.01],
            [lng - 0.01, lat - 0.004],
            [lng, lat],
          ],
        },
        properties: {},
      };
      map.addSource("task-route", { type: "geojson", data: route });
      map.addLayer({
        id: "task-route",
        type: "line",
        source: "task-route",
        paint: {
          "line-color": "#175cd3",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
      addVietnamSeaLabels(map, "task");
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [task, incident, team, nearest]);
  const zoom = (d: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 13) + d, {
      duration: 200,
    });
  return (
    <div className="task-detail-map">
      <div ref={container} className="map-canvas" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải bản đồ nhiệm vụ…
        </div>
      )}
      <div className="map-toolbar">
        <button onClick={() => zoom(1)} aria-label="Phóng to bản đồ">
          <Plus size={16} />
        </button>
        <span />
        <button onClick={() => zoom(-1)} aria-label="Thu nhỏ bản đồ">
          <Minus size={16} />
        </button>
      </div>
      <div className="task-map-legend">
        <span>
          <i className="map-dot task" />
          Nhiệm vụ
        </span>
        <span>
          <i className="map-dot incident" />
          Sự cố
        </span>
        <span>
          <i className="map-dot team" />
          Đội
        </span>
        <span>
          <i className="map-dot shelter" />
          Điểm sơ tán
        </span>
        <span>
          <i className="map-line route" />
          Tuyến tác nghiệp
        </span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
