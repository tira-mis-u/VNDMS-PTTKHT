import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
import {
  Building2,
  Crosshair,
  ListTodo,
  Minus,
  Navigation,
  Plus,
  ShieldCheck,
  Siren,
} from "lucide-react";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
function addIconMarker(
  map: MapLibreMap,
  coordinates: [number, number],
  className: string,
  node: ReactNode,
  roots: Root[],
) {
  const el = document.createElement("div");
  el.className = `team-map-marker ${className}`;
  const root = createRoot(el);
  root.render(node);
  roots.push(root);
  new Marker({ element: el, anchor: "center" })
    .setLngLat(coordinates)
    .addTo(map);
}
export default function TeamOperationalMap({
  team,
  allTeams,
  task,
  incident,
}: {
  team: RescueTeam;
  allTeams: RescueTeam[];
  task?: IncidentTask;
  incident?: Incident;
}) {
  const { shelters } = useOperationalState();
  const shelter =
    shelters.find(
      (item) => incident && item.linkedIncidentIds.includes(incident.id),
    ) ?? shelters[0];
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const roots: Root[] = [];
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: team.coordinates,
      zoom: 12.5,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      addIconMarker(
        map,
        team.coordinates,
        "primary",
        <Navigation size={16} />,
        roots,
      );
      allTeams
        .filter((item) => item.id !== team.id)
        .forEach((item) =>
          addIconMarker(
            map,
            item.coordinates,
            item.status === "Mất liên lạc" ? "lost" : "other",
            <ShieldCheck size={14} />,
            roots,
          ),
        );
      if (incident)
        addIconMarker(
          map,
          incident.location.coordinates,
          "incident",
          <Siren size={14} />,
          roots,
        );
      if (task)
        addIconMarker(
          map,
          task.coordinates,
          "task",
          <ListTodo size={14} />,
          roots,
        );
      if (shelter)
        addIconMarker(
          map,
          shelter.coordinates,
          "shelter",
          <Building2 size={14} />,
          roots,
        );
      if (task) {
        const route = {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              team.coordinates,
              [
                (team.coordinates[0] + task.coordinates[0]) / 2,
                (team.coordinates[1] + task.coordinates[1]) / 2,
              ],
              task.coordinates,
            ],
          },
          properties: {},
        };
        map.addSource("team-route", { type: "geojson", data: route });
        map.addLayer({
          id: "team-route",
          type: "line",
          source: "team-route",
          paint: {
            "line-color": "#175cd3",
            "line-width": 3,
            "line-dasharray": [2, 1],
          },
        });
      }
      addVietnamSeaLabels(map, "team");
    });
    return () => {
      roots.forEach((root) => root.unmount());
      map.remove();
      mapRef.current = null;
    };
  }, [team, allTeams, task, incident, shelter]);
  const zoom = (d: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 12) + d, {
      duration: 200,
    });
  return (
    <div className="team-operational-map">
      <div ref={container} className="map-canvas" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải vị trí lực lượng…
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
        <span />
        <button
          aria-label="Đưa bản đồ về vị trí đội"
          onClick={() =>
            mapRef.current?.flyTo({ center: team.coordinates, zoom: 14 })
          }
        >
          <Crosshair size={15} />
        </button>
      </div>
      <div className="team-map-legend">
        <span>
          <i className="marker-key primary">
            <Navigation size={10} />
          </i>
          Đội hiện tại
        </span>
        <span>
          <i className="marker-key other">
            <ShieldCheck size={10} />
          </i>
          Đội khác
        </span>
        <span>
          <i className="marker-key incident">
            <Siren size={10} />
          </i>
          Sự cố
        </span>
        <span>
          <i className="marker-key task">
            <ListTodo size={10} />
          </i>
          Nhiệm vụ
        </span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
