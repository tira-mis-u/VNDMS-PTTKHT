import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { Building2, Crosshair, Minus, Plus } from "lucide-react";
import type { Shelter } from "@/domain/shelters/types";
import type { EvacuationOperation } from "@/domain/evacuations/types";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

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

  const { engine, ready, gmapRef, zoomBy, flyTo } = useDualMapEngine(container, {
    center: shelter.coordinates,
    zoom: 11,
    seaLabelPrefix: "shelter",
    onMapLibreLoad(map) {
      const addMLMarker = (coords: [number, number], className: string, label: string) => {
        const el = document.createElement("div");
        el.className = `shelter-map-marker ${className}`;
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", label);
        el.innerHTML = "<span></span>";
        new Marker({ element: el }).setLngLat(coords).addTo(map);
      };

      addMLMarker(shelter.coordinates, "primary", shelter.name);
      shelters.filter((item) => item.id !== shelter.id).forEach((item) =>
        addMLMarker(item.coordinates, (item.status === "Quá tải" || item.status === "Không thể tiếp cận") ? "exception" : "other", item.name),
      );

      operations.forEach((operation, index) => {
        const inc = incidents.find((item) => item.id === operation.incidentId);
        const tm = teams.find((item) => item.id === operation.assignedTeamId);
        addMLMarker(operation.sourceCoordinates, "source", operation.sourceArea);
        if (inc) addMLMarker(inc.location.coordinates, "incident", inc.title);
        if (tm) addMLMarker(tm.coordinates, "team", tm.name);

        map.addSource(`route-${index}`, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: operation.route.coordinates }, properties: {} },
        });
        map.addLayer({
          id: `route-${index}`, type: "line", source: `route-${index}`,
          paint: { "line-color": operation.route.status === "Bị chặn" ? "#d92d20" : "#175cd3", "line-width": 4, "line-dasharray": operation.route.status === "Bị chặn" ? [2, 1] : [1, 0] },
        });

        if (operation.route.alternativeCoordinates.length) {
          map.addSource(`alternative-${index}`, {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: operation.route.alternativeCoordinates }, properties: {} },
          });
          map.addLayer({
            id: `alternative-${index}`, type: "line", source: `alternative-${index}`,
            paint: { "line-color": "#079455", "line-width": 3, "line-dasharray": [2, 2], "line-opacity": operation.route.status === "Đang dùng tuyến thay thế" ? 1 : 0.65 },
          });
        }
      });
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

    const addM = (coords: [number, number], color: string, title: string) => {
      const m = new google.maps.Marker({ position: { lat: coords[1], lng: coords[0] }, map, title, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      gmarkersRef.current.push(m);
    };

    addM(shelter.coordinates, "#079455", shelter.name);
    shelters.filter((s) => s.id !== shelter.id).forEach((s) =>
      addM(s.coordinates, (s.status === "Quá tải" || s.status === "Không thể tiếp cận") ? "#d92d20" : "#344054", s.name)
    );

    operations.forEach((op) => {
      const inc = incidents.find((i) => i.id === op.incidentId);
      const tm = teams.find((t) => t.id === op.assignedTeamId);
      addM(op.sourceCoordinates, "#667085", op.sourceArea);
      if (inc) addM(inc.location.coordinates, "#d92d20", inc.title);
      if (tm) addM(tm.coordinates, "#1570ef", tm.name);

      const path = op.route.coordinates.map(([lng, lat]) => ({ lat, lng }));
      gpolylinesRef.current.push(new google.maps.Polyline({ path, map, strokeColor: op.route.status === "Bị chặn" ? "#d92d20" : "#175cd3", strokeWeight: 4 }));
      if (op.route.alternativeCoordinates.length) {
        const altPath = op.route.alternativeCoordinates.map(([lng, lat]) => ({ lat, lng }));
        gpolylinesRef.current.push(new google.maps.Polyline({ path: altPath, map, strokeColor: "#079455", strokeWeight: 3, strokeOpacity: op.route.status === "Đang dùng tuyến thay thế" ? 1 : 0.65 }));
      }
    });
  }, [engine, ready, shelter, shelters, operations, incidents, teams]);

  return (
    <div className="shelter-operational-map" style={{ position: "relative" }}>
      <div ref={container} className="map-canvas" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải bản đồ sơ tán…</div>}
      <div className="map-toolbar">
        <button onClick={() => zoomBy(1)} aria-label="Phóng to bản đồ"><Plus size={16} /></button>
        <span />
        <button onClick={() => zoomBy(-1)} aria-label="Thu nhỏ bản đồ"><Minus size={16} /></button>
        <span />
        <button aria-label="Đưa bản đồ về vị trí điểm sơ tán" onClick={() => flyTo(shelter.coordinates, 13)}>
          <Crosshair size={15} />
        </button>
      </div>
      <div className="shelter-map-legend">
        <span><i className="shelter-key primary"><Building2 size={10} /></i>Điểm hiện tại</span>
        <span><i className="line-key current" />Tuyến sử dụng</span>
        <span><i className="line-key blocked" />Tuyến bị chặn</span>
        <span><i className="line-key alternative" />Tuyến thay thế</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
