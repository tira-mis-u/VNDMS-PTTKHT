import { useEffect, useMemo, useRef } from "react";
import { Layers3, Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

const KIND_COLOR: Record<string, string> = {
  incident: "#d92d20",
  sos: "#b42318",
  team: "#1570ef",
  shelter: "#079455",
};

export default function IncidentDetailMap({
  incident,
  team,
}: {
  incident: Incident;
  team?: RescueTeam;
}) {
  const { shelters, sosRequests } = useOperationalState();
  const [legend, setLegend] = useState(true);

  const relatedShelters = useMemo(
    () => shelters.filter((item) => item.linkedIncidentIds.includes(incident.id)),
    [shelters, incident.id],
  );
  const relatedSos = useMemo(
    () => sosRequests.filter((item) => item.linkedIncidentId === incident.id),
    [sosRequests, incident.id],
  );

  const container = useRef<HTMLDivElement>(null);
  const [lng, lat] = incident.location.coordinates;

  const { engine, ready, gmapRef, zoomBy } = useDualMapEngine(container, {
    center: incident.location.coordinates,
    zoom: 13,
    seaLabelPrefix: "incident",
    onMapLibreLoad(map) {
      // Khu vực ảnh hưởng
      const affected = {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [[[lng - 0.018, lat - 0.009], [lng + 0.011, lat - 0.011], [lng + 0.019, lat + 0.005], [lng + 0.006, lat + 0.014], [lng - 0.015, lat + 0.009], [lng - 0.018, lat - 0.009]]],
        },
        properties: {},
      };
      map.addSource("affected-area", { type: "geojson", data: affected });
      map.addLayer({ id: "affected-fill", type: "fill", source: "affected-area", paint: { "fill-color": "#f79009", "fill-opacity": 0.14 } });
      map.addLayer({ id: "affected-line", type: "line", source: "affected-area", paint: { "line-color": "#dc6803", "line-width": 2, "line-dasharray": [3, 2] } });

      const features = [
        { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [lng, lat] }, properties: { kind: "incident", label: incident.id } },
        ...(team ? [{ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: team.coordinates }, properties: { kind: "team", label: team.id } }] : []),
        ...relatedShelters.slice(0, 2).map((s) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: s.coordinates }, properties: { kind: "shelter", label: s.id } })),
        ...relatedSos.map((s) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: s.location.coordinates }, properties: { kind: "sos", label: s.id } })),
      ];

      const points = { type: "FeatureCollection" as const, features };
      map.addSource("incident-points", { type: "geojson", data: points });
      map.addLayer({
        id: "incident-points", type: "circle", source: "incident-points",
        paint: {
          "circle-radius": ["match", ["get", "kind"], "incident", 8, "sos", 7, 6],
          "circle-color": ["match", ["get", "kind"], "incident", "#d92d20", "sos", "#b42318", "team", "#1570ef", "shelter", "#079455", "#667085"] as never,
          "circle-stroke-color": "#fff", "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "incident-labels", type: "symbol", source: "incident-points",
        layout: { "text-field": ["get", "label"], "text-size": 10, "text-offset": [0, 1.4], "text-anchor": "top" },
        paint: { "text-color": "#344054", "text-halo-color": "#fff", "text-halo-width": 1.5 },
      });

      const route = { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [[lng - 0.025, lat - 0.015], [lng - 0.012, lat - 0.004], [lng, lat], [lng + 0.016, lat + 0.009]] }, properties: {} };
      map.addSource("evacuation-route", { type: "geojson", data: route });
      map.addLayer({ id: "evacuation-route", type: "line", source: "evacuation-route", paint: { "line-color": "#175cd3", "line-width": 3, "line-dasharray": [2, 1] } });

      const blocked = { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [[lng - 0.012, lat + 0.005], [lng - 0.002, lat + 0.001]] }, properties: {} };
      map.addSource("blocked-road", { type: "geojson", data: blocked });
      map.addLayer({ id: "blocked-road", type: "line", source: "blocked-road", paint: { "line-color": "#d92d20", "line-width": 4 } });
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

    const addM = (coords: [number, number], kind: string, label: string) => {
      const m = new google.maps.Marker({
        position: { lat: coords[1], lng: coords[0] }, map, title: label,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: KIND_COLOR[kind] ?? "#667085", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      gmarkersRef.current.push(m);
    };

    addM(incident.location.coordinates, "incident", incident.id);
    if (team) addM(team.coordinates, "team", team.id);
    relatedShelters.slice(0, 2).forEach((s) => addM(s.coordinates, "shelter", s.id));
    relatedSos.forEach((s) => addM(s.location.coordinates, "sos", s.id));

    // Tuyến sơ tán
    const routePath = [{ lat: lat - 0.015, lng: lng - 0.025 }, { lat: lat - 0.004, lng: lng - 0.012 }, { lat, lng }, { lat: lat + 0.009, lng: lng + 0.016 }];
    gpolylinesRef.current.push(new google.maps.Polyline({ path: routePath, map, strokeColor: "#175cd3", strokeWeight: 3, strokeOpacity: 0.8 }));
    gpolylinesRef.current.push(new google.maps.Polyline({ path: [{ lat: lat + 0.005, lng: lng - 0.012 }, { lat: lat + 0.001, lng: lng - 0.002 }], map, strokeColor: "#d92d20", strokeWeight: 4 }));
  }, [engine, ready, incident, team, relatedShelters, relatedSos]);

  return (
    <div className="incident-detail-map" style={{ position: "relative" }}>
      <div ref={container} className="map-canvas" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải dữ liệu bản đồ…</div>}
      <div className="map-toolbar">
        <button onClick={() => zoomBy(1)} title="Phóng to"><Plus size={16} /></button>
        <span />
        <button onClick={() => zoomBy(-1)} title="Thu nhỏ"><Minus size={16} /></button>
      </div>
      <button className="incident-map-layers" onClick={() => setLegend(!legend)}>
        <Layers3 size={14} />Lớp hiển thị
      </button>
      {legend && (
        <div className="incident-map-legend">
          <span><i className="map-dot incident" />Sự cố</span>
          <span><i className="map-dot sos" />SOS</span>
          <span><i className="map-dot team" />Đội cứu hộ</span>
          <span><i className="map-dot shelter" />Điểm sơ tán</span>
          <span><i className="map-line route" />Tuyến sơ tán</span>
          <span><i className="map-line blocked" />Đường hạn chế</span>
        </div>
      )}
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
