import React from "react";
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Building2, LifeBuoy, MapPin, Radio } from "lucide-react";
import { Marker } from "maplibre-gl";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
import type { SosRequest } from "@/domain/sos/types";
import type { SimulationState } from "@/domain/simulation/types";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

export function SimulationOperationalMap({
  simulation,
  incidents,
  teams,
  shelters,
  evacuations,
  sosRequests,
}: {
  simulation: SimulationState;
  incidents: Incident[];
  teams: RescueTeam[];
  shelters: Shelter[];
  evacuations: EvacuationOperation[];
  sosRequests: SosRequest[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const roots = useRef<Root[]>([]);

  const { engine, ready, gmapRef } = useDualMapEngine(host, {
    center: [105.842, 21.06],
    zoom: 11.7,
    seaLabelPrefix: "simulation",
    onMapLibreLoad(map) {
      // Sông Hồng mô phỏng
      map.addSource("sim-red-river", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[105.79, 21.12], [105.81, 21.09], [105.84, 21.065], [105.86, 21.04], [105.89, 21.02]] } },
      });
      map.addLayer({ id: "sim-red-river", type: "line", source: "sim-red-river", paint: { "line-color": "#4a83d8", "line-width": 4, "line-opacity": 0.55 } });

      if (simulation.tick >= 3) {
        map.addSource("sim-risk-zone", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[105.805, 21.055], [105.855, 21.052], [105.87, 21.09], [105.81, 21.098], [105.805, 21.055]]] } },
        });
        map.addLayer({ id: "sim-risk-fill", type: "fill", source: "sim-risk-zone", paint: { "fill-color": simulation.riskLevel === "Rất cao" ? "#d92d20" : "#f79009", "fill-opacity": 0.13 } });
        map.addLayer({ id: "sim-risk-line", type: "line", source: "sim-risk-zone", paint: { "line-color": simulation.riskLevel === "Rất cao" ? "#b42318" : "#dc6803", "line-width": 2, "line-dasharray": [3, 2] } });
      }

      if (simulation.blockedRoads.length) {
        map.addSource("sim-road-restriction", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[105.817, 21.082], [105.822, 21.073], [105.835, 21.062]] } },
        });
        map.addLayer({ id: "sim-road-restriction", type: "line", source: "sim-road-restriction", paint: { "line-color": "#b42318", "line-width": 4, "line-dasharray": [2, 2] } });
      }

      evacuations.forEach((operation, index) => {
        const source = `sim-evac-${index}`;
        map.addSource(source, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: operation.route.status === "Đang dùng tuyến thay thế" ? operation.route.alternativeCoordinates : operation.route.coordinates } },
        });
        map.addLayer({ id: source, type: "line", source, paint: { "line-color": "#067647", "line-width": 2, "line-dasharray": [4, 2] } });
      });

      const addMLMarker = (coords: [number, number], className: string, title: string, node: React.ReactNode) => {
        const element = document.createElement("button");
        element.className = `simulation-map-marker ${className}`;
        element.title = title;
        const root = createRoot(element);
        root.render(node);
        roots.current.push(root);
        new Marker({ element, anchor: "center" }).setLngLat(coords).addTo(map);
      };

      incidents.filter((i) => i.id === "INC-0241").forEach((i) => addMLMarker(i.location.coordinates, "incident", i.title, <MapPin size={14} />));
      shelters.forEach((s) => addMLMarker(s.coordinates, s.status === "Quá tải" ? "shelter danger" : "shelter", `${s.code} — ${s.name}`, <Building2 size={13} />));
      teams.filter((t) => t.currentIncident === "INC-0241" || t.id === "CH-05").forEach((t) => addMLMarker(t.coordinates, "team", `${t.code} — ${t.name}`, <LifeBuoy size={13} />));
      sosRequests.filter((s) => s.linkedIncidentId === "INC-0241").forEach((s) => addMLMarker(s.location.coordinates, "sos", `${s.code} — ${s.description}`, <Radio size={12} />));
    },
  });

  const gmarkersRef = useRef<google.maps.Marker[]>([]);
  const gpolylinesRef = useRef<google.maps.Polyline[]>([]);
  const gpolygonsRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (engine !== "google" || !ready || !gmapRef.current || !window.google?.maps) return;
    const map = gmapRef.current;
    gmarkersRef.current.forEach((m) => m.setMap(null));
    gpolylinesRef.current.forEach((p) => p.setMap(null));
    gpolygonsRef.current.forEach((p) => p.setMap(null));
    gmarkersRef.current = [];
    gpolylinesRef.current = [];
    gpolygonsRef.current = [];

    // Sông Hồng
    gpolylinesRef.current.push(new google.maps.Polyline({ path: [{lat:21.12,lng:105.79},{lat:21.09,lng:105.81},{lat:21.065,lng:105.84},{lat:21.04,lng:105.86},{lat:21.02,lng:105.89}], map, strokeColor: "#4a83d8", strokeWeight: 4, strokeOpacity: 0.55 }));

    // Risk zone
    if (simulation.tick >= 3) {
      const riskPath = [{lat:21.055,lng:105.805},{lat:21.052,lng:105.855},{lat:21.09,lng:105.87},{lat:21.098,lng:105.81},{lat:21.055,lng:105.805}];
      gpolygonsRef.current.push(new google.maps.Polygon({ paths: riskPath, map, strokeColor: simulation.riskLevel === "Rất cao" ? "#b42318" : "#dc6803", strokeWeight: 2, fillColor: simulation.riskLevel === "Rất cao" ? "#d92d20" : "#f79009", fillOpacity: 0.13 }));
    }

    // Đường hạn chế
    if (simulation.blockedRoads.length) {
      gpolylinesRef.current.push(new google.maps.Polyline({ path: [{lat:21.082,lng:105.817},{lat:21.073,lng:105.822},{lat:21.062,lng:105.835}], map, strokeColor: "#b42318", strokeWeight: 4 }));
    }

    // Tuyến sơ tán
    evacuations.forEach((op) => {
      const coords = op.route.status === "Đang dùng tuyến thay thế" ? op.route.alternativeCoordinates : op.route.coordinates;
      const path = coords.map(([lng, lat]) => ({ lat, lng }));
      gpolylinesRef.current.push(new google.maps.Polyline({ path, map, strokeColor: "#067647", strokeWeight: 2, strokeOpacity: 0.85 }));
    });

    const addM = (coords: [number, number], color: string, title: string) => {
      gmarkersRef.current.push(new google.maps.Marker({ position: { lat: coords[1], lng: coords[0] }, map, title, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } }));
    };

    incidents.filter((i) => i.id === "INC-0241").forEach((i) => addM(i.location.coordinates, "#d92d20", i.title));
    shelters.forEach((s) => addM(s.coordinates, s.status === "Quá tải" ? "#d92d20" : "#079455", `${s.code} — ${s.name}`));
    teams.filter((t) => t.currentIncident === "INC-0241" || t.id === "CH-05").forEach((t) => addM(t.coordinates, "#1570ef", `${t.code} — ${t.name}`));
    sosRequests.filter((s) => s.linkedIncidentId === "INC-0241").forEach((s) => addM(s.location.coordinates, "#b42318", `${s.code} — ${s.description}`));
  }, [engine, ready, simulation, incidents, teams, shelters, evacuations, sosRequests]);

  useEffect(() => {
    return () => {
      roots.current.forEach((root) => root.unmount());
      roots.current = [];
    };
  }, []);

  return (
    <div className="simulation-map-wrap" style={{ position: "relative" }}>
      <div ref={host} className="simulation-map" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải bản đồ mô phỏng…</div>}
      <div className="simulation-map-notice">DỮ LIỆU MÔ PHỎNG · MÃ KỊCH BẢN 20240901</div>
      <div className="simulation-map-legend">
        <span><i className="risk" />Vùng rủi ro mô phỏng</span>
        <span><i className="route" />Tuyến sơ tán</span>
        <span><i className="blocked" />Đường hạn chế</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
