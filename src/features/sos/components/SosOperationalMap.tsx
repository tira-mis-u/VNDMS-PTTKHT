import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { Crosshair, Minus, Plus } from "lucide-react";
import type { SosRequest } from "@/domain/sos/types";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
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
  evacuation,
  navigate,
}: {
  sos: SosRequest;
  incident?: Incident;
  task?: IncidentTask;
  team?: RescueTeam;
  shelter?: Shelter;
  evacuation?: EvacuationOperation;
  navigate: (path: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  const { engine, ready, mlMapRef, gmapRef, zoomBy, flyTo } = useDualMapEngine(container, {
    center: sos.location.coordinates,
    zoom: 13,
    seaLabelPrefix: "sos",
  });

  // Google Maps: markers & polylines
  const gmarkersRef = useRef<google.maps.Marker[]>([]);
  const gpolylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!ready) return;

    if (engine === "google" && gmapRef.current && window.google?.maps) {
      const map = gmapRef.current;
      gmarkersRef.current.forEach((m) => m.setMap(null));
      gpolylinesRef.current.forEach((p) => p.setMap(null));
      gmarkersRef.current = [];
      gpolylinesRef.current = [];

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

      if (evacuation) {
        const path = evacuation.route.coordinates.map(([lng, lat]) => ({ lat, lng }));
        const polyline = new google.maps.Polyline({
          path, map,
          strokeColor: evacuation.route.status === "Bị chặn" ? "#d92d20" : "#175cd3",
          strokeWeight: 4,
          strokeOpacity: 0.9,
        });
        gpolylinesRef.current.push(polyline);

        if (evacuation.route.alternativeCoordinates.length) {
          const altPath = evacuation.route.alternativeCoordinates.map(([lng, lat]) => ({ lat, lng }));
          const altLine = new google.maps.Polyline({ path: altPath, map, strokeColor: "#079455", strokeWeight: 3, strokeOpacity: 0.8 });
          gpolylinesRef.current.push(altLine);
        }
      }
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

      if (evacuation) {
        if (!map.getSource("sos-evac-route")) {
          map.addSource("sos-evac-route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: evacuation.route.coordinates }, properties: {} },
          });
          map.addLayer({
            id: "sos-evac-route", type: "line", source: "sos-evac-route",
            paint: {
              "line-color": evacuation.route.status === "Bị chặn" ? "#d92d20" : "#175cd3",
              "line-width": 4,
              "line-dasharray": evacuation.route.status === "Bị chặn" ? [2, 1] : [1, 0],
            },
          });
        }
        if (evacuation.route.alternativeCoordinates.length && !map.getSource("sos-alt-route")) {
          map.addSource("sos-alt-route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: evacuation.route.alternativeCoordinates }, properties: {} },
          });
          map.addLayer({ id: "sos-alt-route", type: "line", source: "sos-alt-route", paint: { "line-color": "#079455", "line-width": 3, "line-dasharray": [2, 2] } });
        }
      }
    }
  }, [ready, engine, sos, incident, task, team, shelter, evacuation, navigate]);

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
        <span><i className="blocked-key" />Tuyến bị chặn</span>
        <span><i className="alternative-key" />Tuyến thay thế</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
