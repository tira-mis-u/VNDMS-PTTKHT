import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Marker } from "maplibre-gl";
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
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

const KIND_COLOR: Record<string, string> = {
  primary: "#1570ef",
  other: "#344054",
  lost: "#d92d20",
  incident: "#d92d20",
  task: "#d97706",
  shelter: "#079455",
};

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
    shelters.find((item) => incident && item.linkedIncidentIds.includes(incident.id)) ?? shelters[0];

  const container = useRef<HTMLDivElement>(null);
  const roots = useRef<Root[]>([]);

  const { engine, ready, gmapRef, zoomBy, flyTo } = useDualMapEngine(container, {
    center: team.coordinates,
    zoom: 12.5,
    seaLabelPrefix: "team",
    onMapLibreLoad(map) {
      const addIconMarker = (
        coords: [number, number],
        className: string,
        node: React.ReactNode,
      ) => {
        const el = document.createElement("div");
        el.className = `team-map-marker ${className}`;
        const root = createRoot(el);
        root.render(node);
        roots.current.push(root);
        new Marker({ element: el, anchor: "center" }).setLngLat(coords).addTo(map);
      };

      addIconMarker(team.coordinates, "primary", <Navigation size={16} />);
      allTeams
        .filter((item) => item.id !== team.id)
        .forEach((item) =>
          addIconMarker(item.coordinates, item.status === "Mất liên lạc" ? "lost" : "other", <ShieldCheck size={14} />),
        );
      if (incident) addIconMarker(incident.location.coordinates, "incident", <Siren size={14} />);
      if (task) addIconMarker(task.coordinates, "task", <ListTodo size={14} />);
      if (shelter) addIconMarker(shelter.coordinates, "shelter", <Building2 size={14} />);

      if (task) {
        const route = {
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: [team.coordinates, [(team.coordinates[0] + task.coordinates[0]) / 2, (team.coordinates[1] + task.coordinates[1]) / 2], task.coordinates] },
          properties: {},
        };
        map.addSource("team-route", { type: "geojson", data: route });
        map.addLayer({ id: "team-route", type: "line", source: "team-route", paint: { "line-color": "#175cd3", "line-width": 3, "line-dasharray": [2, 1] } });
      }
    },
  });

  const gmarkersRef = useRef<google.maps.Marker[]>([]);
  const gpolylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (engine !== "google" || !ready || !gmapRef.current || !window.google?.maps) return;
    const map = gmapRef.current;
    gmarkersRef.current.forEach((m) => m.setMap(null));
    gpolylinesRef.current.forEach((p) => p.setMap(null));
    gmarkersRef.current = [];
    gpolylinesRef.current = [];

    const addM = (coords: [number, number], kind: string, title: string) => {
      const m = new google.maps.Marker({
        position: { lat: coords[1], lng: coords[0] }, map, title,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: KIND_COLOR[kind] ?? "#667085", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      gmarkersRef.current.push(m);
    };

    addM(team.coordinates, "primary", team.name);
    allTeams.filter((item) => item.id !== team.id).forEach((item) => addM(item.coordinates, item.status === "Mất liên lạc" ? "lost" : "other", item.name));
    if (incident) addM(incident.location.coordinates, "incident", incident.title);
    if (task) addM(task.coordinates, "task", task.id);
    if (shelter) addM(shelter.coordinates, "shelter", shelter.name);

    if (task) {
      const path = [
        { lat: team.coordinates[1], lng: team.coordinates[0] },
        { lat: (team.coordinates[1] + task.coordinates[1]) / 2, lng: (team.coordinates[0] + task.coordinates[0]) / 2 },
        { lat: task.coordinates[1], lng: task.coordinates[0] },
      ];
      gpolylinesRef.current.push(new google.maps.Polyline({ path, map, strokeColor: "#175cd3", strokeWeight: 3, strokeOpacity: 0.85 }));
    }
  }, [engine, ready, team, allTeams, task, incident, shelter]);

  useEffect(() => {
    return () => {
      roots.current.forEach((root) => root.unmount());
      roots.current = [];
    };
  }, []);

  return (
    <div className="team-operational-map" style={{ position: "relative" }}>
      <div ref={container} className="map-canvas" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải vị trí lực lượng…</div>}
      <div className="map-toolbar">
        <button onClick={() => zoomBy(1)} aria-label="Phóng to bản đồ"><Plus size={16} /></button>
        <span />
        <button onClick={() => zoomBy(-1)} aria-label="Thu nhỏ bản đồ"><Minus size={16} /></button>
        <span />
        <button aria-label="Đưa bản đồ về vị trí đội" onClick={() => flyTo(team.coordinates, 14)}>
          <Crosshair size={15} />
        </button>
      </div>
      <div className="team-map-legend">
        <span><i className="marker-key primary"><Navigation size={10} /></i>Đội hiện tại</span>
        <span><i className="marker-key other"><ShieldCheck size={10} /></i>Đội khác</span>
        <span><i className="marker-key incident"><Siren size={10} /></i>Sự cố</span>
        <span><i className="marker-key task"><ListTodo size={10} /></i>Nhiệm vụ</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
