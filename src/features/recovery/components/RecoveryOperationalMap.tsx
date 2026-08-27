import React from "react";
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Building2, Hammer, MapPin, ShieldCheck } from "lucide-react";
import { Marker } from "maplibre-gl";
import type { DamageAssessment, RecoveryProject } from "@/domain/recovery/types";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

export default function RecoveryOperationalMap({
  assessments,
  projects = [],
  incident,
  teams = [],
}: {
  assessments: DamageAssessment[];
  projects?: RecoveryProject[];
  incident?: Incident;
  teams?: RescueTeam[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const roots = useRef<Root[]>([]);
  const center: [number, number] =
    projects[0]?.location.coordinates ??
    assessments[0]?.location.coordinates ??
    incident?.location.coordinates ??
    [105.84, 21.06];

  const { engine, ready, gmapRef } = useDualMapEngine(host, {
    center,
    zoom: 12,
    seaLabelPrefix: "recovery",
    onMapLibreLoad(map) {
      const addMLMarker = (coords: [number, number], className: string, title: string, node: React.ReactNode) => {
        const el = document.createElement("button");
        el.className = `recovery-map-marker ${className}`;
        el.title = title;
        const root = createRoot(el);
        root.render(node);
        roots.current.push(root);
        new Marker({ element: el, anchor: "center" }).setLngLat(coords).addTo(map);
      };

      assessments.forEach((item, index) => {
        const source = `damage-area-${index}`;
        map.addSource(source, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [item.affectedAreaCoordinates] } },
        });
        const isSevere = item.severity === "Phá hủy" || item.severity === "Nghiêm trọng";
        map.addLayer({ id: `damage-fill-${index}`, type: "fill", source, paint: { "fill-color": isSevere ? "#d92d20" : "#f79009", "fill-opacity": 0.12 } });
        map.addLayer({ id: `damage-line-${index}`, type: "line", source, paint: { "line-color": isSevere ? "#b42318" : "#dc6803", "line-width": 2, "line-dasharray": [3, 2] } });
        addMLMarker(item.location.coordinates, "assessment", `${item.code} — ${item.area}`, <MapPin size={13} />);
      });

      projects.forEach((item) => addMLMarker(item.location.coordinates, "project", `${item.code} — ${item.name}`, <Hammer size={13} />));
      if (incident) addMLMarker(incident.location.coordinates, "incident", incident.title, <Building2 size={13} />);
      teams.forEach((item) => addMLMarker(item.coordinates, "team", item.name, <ShieldCheck size={12} />));
    },
  });

  const gmarkersRef = useRef<google.maps.Marker[]>([]);
  const gpolygonsRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    if (engine !== "google" || !ready || !gmapRef.current || !window.google?.maps) return;
    const map = gmapRef.current;
    gmarkersRef.current.forEach((m) => m.setMap(null));
    gpolygonsRef.current.forEach((p) => p.setMap(null));
    gmarkersRef.current = [];
    gpolygonsRef.current = [];

    const addM = (coords: [number, number], color: string, title: string) => {
      const m = new google.maps.Marker({ position: { lat: coords[1], lng: coords[0] }, map, title, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      gmarkersRef.current.push(m);
    };

    assessments.forEach((item) => {
      const isSevere = item.severity === "Phá hủy" || item.severity === "Nghiêm trọng";
      const paths = item.affectedAreaCoordinates.map(([lng, lat]) => ({ lat, lng }));
      const polygon = new google.maps.Polygon({ paths, map, strokeColor: isSevere ? "#b42318" : "#dc6803", strokeWeight: 2, fillColor: isSevere ? "#d92d20" : "#f79009", fillOpacity: 0.12 });
      gpolygonsRef.current.push(polygon);
      addM(item.location.coordinates, "#667085", `${item.code} — ${item.area}`);
    });

    projects.forEach((item) => addM(item.location.coordinates, "#1570ef", `${item.code} — ${item.name}`));
    if (incident) addM(incident.location.coordinates, "#d92d20", incident.title);
    teams.forEach((item) => addM(item.coordinates, "#079455", item.name));
  }, [engine, ready, assessments, projects, incident, teams]);

  useEffect(() => {
    return () => {
      roots.current.forEach((root) => root.unmount());
      roots.current = [];
    };
  }, []);

  return (
    <div className="recovery-map-wrap" style={{ position: "relative" }}>
      <div ref={host} className="recovery-map" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải bản đồ thiệt hại…</div>}
      <div className="recovery-map-legend">
        <span><i className="damage-key" />Khu vực thiệt hại</span>
        <span><i className="project-key" />Dự án khôi phục</span>
        <span><i className="team-key" />Đội phụ trách</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
