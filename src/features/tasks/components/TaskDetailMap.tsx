import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

const KIND_COLOR: Record<string, string> = {
  task: "#d92d20",
  incident: "#f79009",
  team: "#1570ef",
  shelter: "#079455",
};

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
    shelters.find((item) => item.linkedIncidentIds.includes(task.incidentId)) ?? shelters[0];

  const container = useRef<HTMLDivElement>(null);
  const [lng, lat] = task.coordinates;

  const { engine, ready, gmapRef, zoomBy } = useDualMapEngine(container, {
    center: task.coordinates,
    zoom: 13,
    seaLabelPrefix: "task",
    onMapLibreLoad(map) {
      const features = [
        { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: task.coordinates }, properties: { kind: "task", label: task.id } },
        ...(incident ? [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: incident.location.coordinates }, properties: { kind: "incident", label: incident.id } }] : []),
        ...(team ? [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: team.coordinates }, properties: { kind: "team", label: team.id } }] : []),
        ...(nearest ? [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: nearest.coordinates }, properties: { kind: "shelter", label: nearest.id } }] : []),
      ];
      const points = { type: "FeatureCollection" as const, features };
      map.addSource("task-points", { type: "geojson", data: points });
      map.addLayer({
        id: "task-points", type: "circle", source: "task-points",
        paint: {
          "circle-radius": ["match", ["get", "kind"], "task", 8, 6],
          "circle-color": ["match", ["get", "kind"], "task", "#d92d20", "incident", "#f79009", "team", "#1570ef", "shelter", "#079455", "#667085"] as never,
          "circle-stroke-width": 2, "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "task-labels", type: "symbol", source: "task-points",
        layout: { "text-field": ["get", "label"], "text-size": 10, "text-offset": [0, 1.4], "text-anchor": "top" },
        paint: { "text-color": "#344054", "text-halo-color": "#fff", "text-halo-width": 1.5 },
      });

      const routeCoords = [
        team?.coordinates ?? [lng - 0.02, lat - 0.01],
        [lng - 0.01, lat - 0.004],
        [lng, lat],
      ];
      map.addSource("task-route", { type: "geojson", data: { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: routeCoords }, properties: {} } });
      map.addLayer({ id: "task-route", type: "line", source: "task-route", paint: { "line-color": "#175cd3", "line-width": 3, "line-dasharray": [2, 1] } });
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
      const m = new google.maps.Marker({ position: { lat: coords[1], lng: coords[0] }, map, title, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: KIND_COLOR[kind] ?? "#667085", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      gmarkersRef.current.push(m);
    };

    addM(task.coordinates, "task", task.id);
    if (incident) addM(incident.location.coordinates, "incident", incident.id);
    if (team) addM(team.coordinates, "team", team.id);
    if (nearest) addM(nearest.coordinates, "shelter", nearest.id);

    const routePath = [
      team ? { lat: team.coordinates[1], lng: team.coordinates[0] } : { lat: lat - 0.01, lng: lng - 0.02 },
      { lat: lat - 0.004, lng: lng - 0.01 },
      { lat, lng },
    ];
    gpolylinesRef.current.push(new google.maps.Polyline({ path: routePath, map, strokeColor: "#175cd3", strokeWeight: 3, strokeOpacity: 0.85 }));
  }, [engine, ready, task, incident, team, nearest]);

  return (
    <div className="task-detail-map" style={{ position: "relative" }}>
      <div ref={container} className="map-canvas" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải bản đồ nhiệm vụ…</div>}
      <div className="map-toolbar">
        <button onClick={() => zoomBy(1)} aria-label="Phóng to bản đồ"><Plus size={16} /></button>
        <span />
        <button onClick={() => zoomBy(-1)} aria-label="Thu nhỏ bản đồ"><Minus size={16} /></button>
      </div>
      <div className="task-map-legend">
        <span><i className="map-dot task" />Nhiệm vụ</span>
        <span><i className="map-dot incident" />Sự cố</span>
        <span><i className="map-dot team" />Đội</span>
        <span><i className="map-dot shelter" />Điểm sơ tán</span>
        <span><i className="map-line route" />Tuyến tác nghiệp</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
