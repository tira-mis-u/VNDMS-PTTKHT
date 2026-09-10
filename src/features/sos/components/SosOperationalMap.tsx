import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { Crosshair, Minus, Plus } from "lucide-react";
import type { SosRequest } from "@/domain/sos/types";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

const KIND_COLORS: Record<string, string> = {
  sos: "#d92d20",
  incident: "#b42318",
  task: "#d97706",
  team: "#1570ef",
  shelter: "#079455",
};

export default function SosOperationalMap({
  sos,
  incident,
  task,
  team,
  shelter,
  navigate,
}: {
  sos: SosRequest;
  incident?: Incident;
  task?: IncidentTask;
  team?: RescueTeam;
  shelter?: Shelter;
  navigate: (path: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  const { engine, ready, mlMapRef, gmapRef, zoomBy, flyTo } = useDualMapEngine(container, {
    center: sos.location.coordinates,
    zoom: 13,
    seaLabelPrefix: "sos",
  });

  // Google Maps: markers
  const gmarkersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!ready) return;

    if (engine === "google" && gmapRef.current && window.google?.maps) {
      const map = gmapRef.current;
      gmarkersRef.current.forEach((m) => m.setMap(null));
      gmarkersRef.current = [];

      const addGMarker = (coords: [number, number], kind: string, title: string, onClick?: () => void) => {
        const m = new google.maps.Marker({
          position: { lat: coords[1], lng: coords[0] },
          map,
          title,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: KIND_COLORS[kind] ?? "#667085", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        });
        if (onClick) m.addListener("click", onClick);
        gmarkersRef.current.push(m);
      };

      addGMarker(sos.location.coordinates, "sos", sos.code);
      if (incident) addGMarker(incident.location.coordinates, "incident", incident.id, () => navigate(`/incidents/${incident.id}`));
      if (task) addGMarker(task.coordinates, "task", task.id, () => navigate(`/tasks/${task.id}`));
      if (team) addGMarker(team.coordinates, "team", team.id, () => navigate(`/teams/${team.id}`));
      if (shelter) addGMarker(shelter.coordinates, "shelter", shelter.id, () => navigate(`/shelters/${shelter.id}`));
    } else if (engine === "maplibre" && mlMapRef.current) {
      const map = mlMapRef.current;

      const addMLMarker = (coords: [number, number], kind: string, label: string, onClick?: () => void) => {
        const el = document.createElement("button");
        el.className = `sos-map-marker ${kind}`;
        el.title = label;
        el.setAttribute("aria-label", label);
        el.onclick = () => onClick?.();
        new Marker({ element: el, anchor: "center" }).setLngLat(coords).addTo(map);
      };

      const incId = incident?.id;
      const taskId = task?.id;
      const teamId = team?.id;
      const shelterId = shelter?.id;

      addMLMarker(sos.location.coordinates, "sos", sos.code);
      if (incident) addMLMarker(incident.location.coordinates, "incident", incident.id, () => { if (incId) navigate(`/incidents/${incId}`); });
      if (task) addMLMarker(task.coordinates, "task", task.id, () => { if (taskId) navigate(`/tasks/${taskId}`); });
      if (team) addMLMarker(team.coordinates, "team", team.id, () => { if (teamId) navigate(`/teams/${teamId}`); });
      if (shelter) addMLMarker(shelter.coordinates, "shelter", shelter.id, () => { if (shelterId) navigate(`/shelters/${shelterId}`); });
    }
  }, [ready, engine, sos, incident, task, team, shelter, navigate]);

  return (
    <div className="sos-operational-map" style={{ position: "relative" }}>
      <div ref={container} className="map-canvas" />
      <MapEngineBadge engine={engine} />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải bản đồ SOS…
        </div>
      )}
      <div className="map-toolbar">
        <button onClick={() => zoomBy(1)} aria-label="Phóng to bản đồ"><Plus size={16} /></button>
        <span />
        <button onClick={() => zoomBy(-1)} aria-label="Thu nhỏ bản đồ"><Minus size={16} /></button>
        <span />
        <button aria-label="Đưa bản đồ về vị trí SOS" onClick={() => flyTo(sos.location.coordinates, 14)}>
          <Crosshair size={15} />
        </button>
      </div>
      <div className="sos-map-legend">
        <span><i className="sos-key" />SOS</span>
        <span><i className="team-key" />Đội cứu hộ</span>
        <span><i className="shelter-key-dot" />Điểm sơ tán</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
