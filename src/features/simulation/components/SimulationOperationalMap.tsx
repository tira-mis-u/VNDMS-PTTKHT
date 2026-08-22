import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Building2, LifeBuoy, MapPin, Radio } from "lucide-react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
import type { SosRequest } from "@/domain/sos/types";
import type { SimulationState } from "@/domain/simulation/types";
import {
  applyVietnameseMapLabels,
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
} from "@/infrastructure/gis/mapConfig";
function addMarker(
  map: MapLibreMap,
  coordinates: [number, number],
  className: string,
  title: string,
  node: React.ReactNode,
  roots: Root[],
) {
  const element = document.createElement("button");
  element.className = `simulation-map-marker ${className}`;
  element.title = title;
  const root = createRoot(element);
  root.render(node);
  roots.push(root);
  new Marker({ element, anchor: "center" }).setLngLat(coordinates).addTo(map);
}
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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const roots: Root[] = [];
    const map = new MapLibreMap({
      container: host.current,
      style: MAP_BASE_STYLE,
      center: [105.842, 21.06],
      zoom: 11.7,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      map.addSource("sim-red-river", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [105.79, 21.12],
              [105.81, 21.09],
              [105.84, 21.065],
              [105.86, 21.04],
              [105.89, 21.02],
            ],
          },
        },
      });
      map.addLayer({
        id: "sim-red-river",
        type: "line",
        source: "sim-red-river",
        paint: {
          "line-color": "#4a83d8",
          "line-width": 4,
          "line-opacity": 0.55,
        },
      });
      if (simulation.tick >= 3) {
        map.addSource("sim-risk-zone", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [105.805, 21.055],
                  [105.855, 21.052],
                  [105.87, 21.09],
                  [105.81, 21.098],
                  [105.805, 21.055],
                ],
              ],
            },
          },
        });
        map.addLayer({
          id: "sim-risk-fill",
          type: "fill",
          source: "sim-risk-zone",
          paint: {
            "fill-color":
              simulation.riskLevel === "Rất cao" ? "#d92d20" : "#f79009",
            "fill-opacity": 0.13,
          },
        });
        map.addLayer({
          id: "sim-risk-line",
          type: "line",
          source: "sim-risk-zone",
          paint: {
            "line-color":
              simulation.riskLevel === "Rất cao" ? "#b42318" : "#dc6803",
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });
      }
      if (simulation.blockedRoads.length) {
        map.addSource("sim-road-restriction", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [105.817, 21.082],
                [105.822, 21.073],
                [105.835, 21.062],
              ],
            },
          },
        });
        map.addLayer({
          id: "sim-road-restriction",
          type: "line",
          source: "sim-road-restriction",
          paint: {
            "line-color": "#b42318",
            "line-width": 4,
            "line-dasharray": [2, 2],
          },
        });
      }
      evacuations.forEach((operation, index) => {
        const source = `sim-evac-${index}`;
        map.addSource(source, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates:
                operation.route.status === "Đang dùng tuyến thay thế"
                  ? operation.route.alternativeCoordinates
                  : operation.route.coordinates,
            },
          },
        });
        map.addLayer({
          id: source,
          type: "line",
          source,
          paint: {
            "line-color": "#067647",
            "line-width": 2,
            "line-dasharray": [4, 2],
          },
        });
      });
      incidents
        .filter((item) => item.id === "INC-0241")
        .forEach((item) =>
          addMarker(
            map,
            item.location.coordinates,
            "incident",
            item.title,
            <MapPin size={14} />,
            roots,
          ),
        );
      shelters.forEach((item) =>
        addMarker(
          map,
          item.coordinates,
          item.status === "Quá tải" ? "shelter danger" : "shelter",
          `${item.code} — ${item.name}`,
          <Building2 size={13} />,
          roots,
        ),
      );
      teams
        .filter(
          (item) => item.currentIncident === "INC-0241" || item.id === "CH-05",
        )
        .forEach((item) =>
          addMarker(
            map,
            item.coordinates,
            "team",
            `${item.code} — ${item.name}`,
            <LifeBuoy size={13} />,
            roots,
          ),
        );
      sosRequests
        .filter((item) => item.linkedIncidentId === "INC-0241")
        .forEach((item) =>
          addMarker(
            map,
            item.location.coordinates,
            "sos",
            `${item.code} — ${item.description}`,
            <Radio size={12} />,
            roots,
          ),
        );
      addVietnamSeaLabels(map, "simulation");
    });
    return () => {
      roots.forEach((root) => root.unmount());
      map.remove();
    };
  }, [simulation, incidents, teams, shelters, evacuations, sosRequests]);
  return (
    <div className="simulation-map-wrap">
      <div ref={host} className="simulation-map" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải bản đồ mô phỏng…
        </div>
      )}
      <div className="simulation-map-notice">
        DỮ LIỆU MÔ PHỎNG · Seed 20240901
      </div>
      <div className="simulation-map-legend">
        <span>
          <i className="risk" />
          Vùng rủi ro mô phỏng
        </span>
        <span>
          <i className="route" />
          Tuyến sơ tán
        </span>
        <span>
          <i className="blocked" />
          Đường hạn chế
        </span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
