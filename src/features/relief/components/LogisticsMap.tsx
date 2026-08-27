import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Building2, MapPin } from "lucide-react";
import { Marker } from "maplibre-gl";
import type { DistributionShipment, ReliefRequest, Warehouse } from "@/domain/relief/types";
import { useDualMapEngine, MapEngineBadge } from "@/infrastructure/gis/useDualMapEngine";

export function LogisticsMap({
  warehouses,
  request,
  shipments = [],
  navigate,
}: {
  warehouses: Warehouse[];
  request?: ReliefRequest;
  shipments?: DistributionShipment[];
  navigate: (path: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const roots = useRef<Root[]>([]);
  const center: [number, number] = request?.destinationCoordinates ?? warehouses[0]?.coordinates ?? [105.84, 21.03];

  const { engine, ready, gmapRef } = useDualMapEngine(host, {
    center,
    zoom: request ? 11 : 10,
    seaLabelPrefix: "relief",
    onMapLibreLoad(map) {
      warehouses.forEach((warehouse) => {
        const el = document.createElement("button");
        el.className = "map-marker map-marker-warehouse";
        el.title = warehouse.name;
        const root = createRoot(el);
        root.render(<Building2 size={14} />);
        roots.current.push(root);
        el.onclick = () => navigate(`/relief/warehouses/${warehouse.id}`);
        new Marker({ element: el, anchor: "center" }).setLngLat(warehouse.coordinates).addTo(map);
      });

      if (request) {
        const el = document.createElement("button");
        el.className = "map-marker map-marker-request";
        el.title = request.destination;
        const root = createRoot(el);
        root.render(<MapPin size={12} />);
        roots.current.push(root);
        new Marker({ element: el, anchor: "center" }).setLngLat(request.destinationCoordinates).addTo(map);
      }

      shipments.forEach((shipment) => {
        if (shipment.routeCoordinates.length < 2) return;
        const source = `route-${shipment.id}`;
        map.addSource(source, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: shipment.routeCoordinates } },
        });
        map.addLayer({
          id: `line-${shipment.id}`, type: "line", source,
          paint: { "line-color": shipment.status === "Có sự cố" ? "#b42318" : "#285f89", "line-width": 3, "line-dasharray": [2, 1] },
        });
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

    warehouses.forEach((w) => {
      const m = new google.maps.Marker({
        position: { lat: w.coordinates[1], lng: w.coordinates[0] }, map, title: w.name,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#1570ef", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      m.addListener("click", () => navigate(`/relief/warehouses/${w.id}`));
      gmarkersRef.current.push(m);
    });

    if (request) {
      const m = new google.maps.Marker({
        position: { lat: request.destinationCoordinates[1], lng: request.destinationCoordinates[0] }, map, title: request.destination,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#079455", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
      });
      gmarkersRef.current.push(m);
    }

    shipments.forEach((shipment) => {
      if (shipment.routeCoordinates.length < 2) return;
      const path = shipment.routeCoordinates.map(([lng, lat]) => ({ lat, lng }));
      gpolylinesRef.current.push(new google.maps.Polyline({
        path, map,
        strokeColor: shipment.status === "Có sự cố" ? "#b42318" : "#285f89",
        strokeWeight: 3, strokeOpacity: 0.9,
      }));
    });
  }, [engine, ready, warehouses, request, shipments, navigate]);

  useEffect(() => {
    return () => {
      roots.current.forEach((root) => root.unmount());
      roots.current = [];
    };
  }, []);

  return (
    <div className="relief-map-wrap" style={{ position: "relative" }}>
      <div ref={host} className="relief-map" aria-label="Bản đồ hậu cần" />
      <MapEngineBadge engine={engine} />
      {!ready && <div className="relief-map-fallback">Đang tải bản đồ hậu cần…</div>}
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
