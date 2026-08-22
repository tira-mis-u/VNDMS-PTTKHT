import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Building2, Hammer, MapPin, ShieldCheck } from "lucide-react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import type {
  DamageAssessment,
  RecoveryProject,
} from "@/domain/recovery/types";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
function marker(
  map: MapLibreMap,
  coordinates: [number, number],
  className: string,
  title: string,
  node: React.ReactNode,
  roots: Root[],
) {
  const el = document.createElement("button");
  el.className = `recovery-map-marker ${className}`;
  el.title = title;
  const root = createRoot(el);
  root.render(node);
  roots.push(root);
  new Marker({ element: el, anchor: "center" })
    .setLngLat(coordinates)
    .addTo(map);
}
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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const roots: Root[] = [];
    const center = projects[0]?.location.coordinates ??
      assessments[0]?.location.coordinates ??
      incident?.location.coordinates ?? [105.84, 21.06];
    const map = new MapLibreMap({
      container: host.current,
      style: MAP_BASE_STYLE,
      center,
      zoom: 12.3,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      assessments.forEach((item, index) => {
        const source = `damage-area-${index}`;
        map.addSource(source, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [item.affectedAreaCoordinates],
            },
          },
        });
        map.addLayer({
          id: `damage-fill-${index}`,
          type: "fill",
          source,
          paint: {
            "fill-color":
              item.severity === "Phá hủy" || item.severity === "Nghiêm trọng"
                ? "#d92d20"
                : "#f79009",
            "fill-opacity": 0.12,
          },
        });
        map.addLayer({
          id: `damage-line-${index}`,
          type: "line",
          source,
          paint: {
            "line-color":
              item.severity === "Phá hủy" || item.severity === "Nghiêm trọng"
                ? "#b42318"
                : "#dc6803",
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });
        marker(
          map,
          item.location.coordinates,
          "assessment",
          `${item.code} — ${item.area}`,
          <MapPin size={13} />,
          roots,
        );
      });
      projects.forEach((item) =>
        marker(
          map,
          item.location.coordinates,
          "project",
          `${item.code} — ${item.name}`,
          <Hammer size={13} />,
          roots,
        ),
      );
      if (incident)
        marker(
          map,
          incident.location.coordinates,
          "incident",
          incident.title,
          <Building2 size={13} />,
          roots,
        );
      teams.forEach((item) =>
        marker(
          map,
          item.coordinates,
          "team",
          item.name,
          <ShieldCheck size={12} />,
          roots,
        ),
      );
      addVietnamSeaLabels(map, "recovery");
    });
    return () => {
      roots.forEach((root) => root.unmount());
      map.remove();
    };
  }, [assessments, projects, incident, teams]);
  return (
    <div className="recovery-map-wrap">
      <div ref={host} className="recovery-map" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải bản đồ thiệt hại…
        </div>
      )}
      <div className="recovery-map-legend">
        <span>
          <i className="damage-key" />
          Khu vực thiệt hại
        </span>
        <span>
          <i className="project-key" />
          Dự án khôi phục
        </span>
        <span>
          <i className="team-key" />
          Đội phụ trách
        </span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
