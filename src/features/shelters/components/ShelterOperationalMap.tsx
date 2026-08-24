import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { Building2, Crosshair, Minus, Plus } from "lucide-react";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
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
  label: string,
) {
  const el = document.createElement("div");
  el.className = `shelter-map-marker ${className}`;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", label);
  el.innerHTML = "<span></span>";
  new Marker({ element: el }).setLngLat(coordinates).addTo(map);
}
export default function ShelterOperationalMap({
  shelter,
  shelters,
  operations,
  incidents,
  teams,
}: {
  shelter: Shelter;
  shelters: Shelter[];
  operations: EvacuationOperation[];
  incidents: Incident[];
  teams: RescueTeam[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: shelter.coordinates,
      zoom: 11.3,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      marker(map, shelter.coordinates, "primary", shelter.name);
      shelters
        .filter((item) => item.id !== shelter.id)
        .forEach((item) =>
          marker(
            map,
            item.coordinates,
            item.status === "Quá tải" || item.status === "Không thể tiếp cận"
              ? "exception"
              : "other",
            item.name,
          ),
        );
      operations.forEach((operation, index) => {
        const incident = incidents.find(
          (item) => item.id === operation.incidentId,
        );
        const team = teams.find((item) => item.id === operation.assignedTeamId);
        marker(
          map,
          operation.sourceCoordinates,
          "source",
          operation.sourceArea,
        );
        if (incident)
          marker(
            map,
            incident.location.coordinates,
            "incident",
            incident.title,
          );
        if (team) marker(map, team.coordinates, "team", team.name);
        map.addSource(`route-${index}`, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: operation.route.coordinates,
            },
            properties: {},
          },
        });
        map.addLayer({
          id: `route-${index}`,
          type: "line",
          source: `route-${index}`,
          paint: {
            "line-color":
              operation.route.status === "Bị chặn" ? "#d92d20" : "#175cd3",
            "line-width": 4,
            "line-dasharray":
              operation.route.status === "Bị chặn" ? [2, 1] : [1, 0],
          },
        });
        if (operation.route.alternativeCoordinates.length) {
          map.addSource(`alternative-${index}`, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: operation.route.alternativeCoordinates,
              },
              properties: {},
            },
          });
          map.addLayer({
            id: `alternative-${index}`,
            type: "line",
            source: `alternative-${index}`,
            paint: {
              "line-color": "#079455",
              "line-width": 3,
              "line-dasharray": [2, 2],
              "line-opacity":
                operation.route.status === "Đang dùng tuyến thay thế"
                  ? 1
                  : 0.65,
            },
          });
        }
      });
      addVietnamSeaLabels(map, "shelter");
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [shelter, shelters, operations, incidents, teams]);
  const zoom = (amount: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 11) + amount, {
      duration: 200,
    });
  return (
    <div className="shelter-operational-map">
      <div ref={container} className="map-canvas" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải bản đồ sơ tán…
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
          aria-label="Đưa bản đồ về vị trí điểm sơ tán"
          onClick={() =>
            mapRef.current?.flyTo({ center: shelter.coordinates, zoom: 13 })
          }
        >
          <Crosshair size={15} />
        </button>
      </div>
      <div className="shelter-map-legend">
        <span>
          <i className="shelter-key primary">
            <Building2 size={10} />
          </i>
          Điểm hiện tại
        </span>
        <span>
          <i className="line-key current" />
          Tuyến sử dụng
        </span>
        <span>
          <i className="line-key blocked" />
          Tuyến bị chặn
        </span>
        <span>
          <i className="line-key alternative" />
          Tuyến thay thế
        </span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
