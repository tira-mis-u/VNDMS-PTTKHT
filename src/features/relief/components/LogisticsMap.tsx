import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Building2, MapPin } from "lucide-react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import type {
  DistributionShipment,
  ReliefRequest,
  Warehouse,
} from "@/domain/relief/types";
import {
  MAP_BASE_STYLE,
  MAP_MIN_ZOOM,
  addVietnamSeaLabels,
  applyVietnameseMapLabels,
} from "@/infrastructure/gis/mapConfig";
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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const center = request?.destinationCoordinates ??
      warehouses[0]?.coordinates ?? [105.84, 21.03];
    const roots: Root[] = [];
    const map = new MapLibreMap({
      container: host.current,
      style: MAP_BASE_STYLE,
      center,
      zoom: request ? 10.7 : 10,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: 18,
      attributionControl: false,
    });
    map.on("load", () => {
      setReady(true);
      applyVietnameseMapLabels(map);
      warehouses.forEach((warehouse) => {
        const el = document.createElement("button");
        el.className = "map-marker map-marker-warehouse";
        el.title = warehouse.name;
        const root = createRoot(el);
        root.render(<Building2 size={14} />);
        roots.push(root);
        el.onclick = () => navigate(`/relief/warehouses/${warehouse.id}`);
        new Marker({ element: el, anchor: "center" })
          .setLngLat(warehouse.coordinates)
          .addTo(map);
      });
      if (request) {
        const el = document.createElement("button");
        el.className = "map-marker map-marker-request";
        el.title = request.destination;
        const root = createRoot(el);
        root.render(<MapPin size={12} />);
        roots.push(root);
        new Marker({ element: el, anchor: "center" })
          .setLngLat(request.destinationCoordinates)
          .addTo(map);
      }
      shipments.forEach((shipment) => {
        if (shipment.routeCoordinates.length < 2) return;
        const source = `route-${shipment.id}`;
        map.addSource(source, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: shipment.routeCoordinates,
            },
          },
        });
        map.addLayer({
          id: `line-${shipment.id}`,
          type: "line",
          source,
          paint: {
            "line-color":
              shipment.status === "Có sự cố" ? "#b42318" : "#285f89",
            "line-width": 3,
            "line-dasharray": [2, 1],
          },
        });
      });
      addVietnamSeaLabels(map, "relief");
    });
    return () => {
      roots.forEach((root) => root.unmount());
      map.remove();
    };
  }, [warehouses, request, shipments, navigate]);
  return (
    <div className="relief-map-wrap">
      <div ref={host} className="relief-map" aria-label="Bản đồ hậu cần" />
      {!ready && (
        <div className="relief-map-fallback">Đang tải bản đồ hậu cần…</div>
      )}
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
