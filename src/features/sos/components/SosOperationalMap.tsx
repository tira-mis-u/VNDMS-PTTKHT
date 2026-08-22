import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { Crosshair, Minus, Plus } from "lucide-react";
import type { SosRequest } from "@/domain/sos/types";
import type { Incident } from "@/domain/incidents/types";
import type { IncidentTask } from "@/domain/tasks/types";
import type { RescueTeam } from "@/domain/teams/types";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
function addMarker(
  map: MapLibreMap,
  coordinates: [number, number],
  kind: string,
  label: string,
  onClick?: () => void,
) {
  const element = document.createElement("button");
  element.className = `sos-map-marker ${kind}`;
  element.title = label;
  element.setAttribute("aria-label", label);
  element.onclick = () => onClick?.();
  new Marker({ element, anchor: "center" }).setLngLat(coordinates).addTo(map);
}
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_BASE_STYLE,
      center: sos.location.coordinates,
      zoom: 13,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      addMarker(map, sos.location.coordinates, "sos", sos.code);
      if (incident)
        addMarker(
          map,
          incident.location.coordinates,
          "incident",
          incident.id,
          () => navigate(`/incidents/${incident.id}`),
        );
      if (task)
        addMarker(map, task.coordinates, "task", task.id, () =>
          navigate(`/tasks/${task.id}`),
        );
      if (team)
        addMarker(map, team.coordinates, "team", team.id, () =>
          navigate(`/teams/${team.id}`),
        );
      if (shelter)
        addMarker(map, shelter.coordinates, "shelter", shelter.id, () =>
          navigate(`/shelters/${shelter.id}`),
        );
      if (evacuation) {
        map.addSource("sos-evac-route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: evacuation.route.coordinates,
            },
            properties: {},
          },
        });
        map.addLayer({
          id: "sos-evac-route",
          type: "line",
          source: "sos-evac-route",
          paint: {
            "line-color":
              evacuation.route.status === "Bị chặn" ? "#d92d20" : "#175cd3",
            "line-width": 4,
            "line-dasharray":
              evacuation.route.status === "Bị chặn" ? [2, 1] : [1, 0],
          },
        });
        if (evacuation.route.alternativeCoordinates.length) {
          map.addSource("sos-alt-route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: evacuation.route.alternativeCoordinates,
              },
              properties: {},
            },
          });
          map.addLayer({
            id: "sos-alt-route",
            type: "line",
            source: "sos-alt-route",
            paint: {
              "line-color": "#079455",
              "line-width": 3,
              "line-dasharray": [2, 2],
            },
          });
        }
      }
      addVietnamSeaLabels(map, "sos");
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [sos, incident, task, team, shelter, evacuation, navigate]);
  const zoom = (amount: number) =>
    mapRef.current?.zoomTo((mapRef.current.getZoom() ?? 13) + amount, {
      duration: 200,
    });
  return (
    <div className="sos-operational-map">
      <div ref={container} className="map-canvas" />
      {!ready && (
        <div className="map-loading">
          <span className="spinner" />
          Đang tải bản đồ SOS…
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
          aria-label="Đưa bản đồ về vị trí SOS"
          onClick={() =>
            mapRef.current?.flyTo({
              center: sos.location.coordinates,
              zoom: 14,
            })
          }
        >
          <Crosshair size={15} />
        </button>
      </div>
      <div className="sos-map-legend">
        <span>
          <i className="sos-key" />
          SOS
        </span>
        <span>
          <i className="team-key" />
          Đội cứu hộ
        </span>
        <span>
          <i className="shelter-key-dot" />
          Điểm sơ tán
        </span>
        <span>
          <i className="blocked-key" />
          Tuyến bị chặn
        </span>
        <span>
          <i className="alternative-key" />
          Tuyến thay thế
        </span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
