import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { Building2, Crosshair, Minus, Plus } from "lucide-react";
import type { Shelter } from "@/domain/shelters/types";
import type { Incident } from "@/domain/incidents/types";
import type { RescueTeam } from "@/domain/teams/types";
import { useDualMapEngine } from "@/infrastructure/gis/useDualMapEngine";
import { attachDetailMapStationPills, attachDetailMapTemperature } from "@/infrastructure/weather/detailMapTemperature";
import { UNIFIED_MAP_KIND_COLORS } from "@/application/map/unifiedMapQueries";

/**
 * Bản đồ điểm sơ tán (danh mục tra cứu). V2 đã gỡ phân hệ Sơ tán nên bản đồ
 * chỉ còn: điểm hiện tại, các điểm khác, sự cố liên quan và đội đang ở gần.
 */
export default function ShelterOperationalMap({
  shelter,
  shelters,
  incidents,
  teams,
}: {
  shelter: Shelter;
  shelters: Shelter[];
  incidents: Incident[];
  teams: RescueTeam[];
}) {
  const container = useRef<HTMLDivElement>(null);

  const { engine, ready, gmapRef, zoomBy, flyTo } = useDualMapEngine(container, {
    center: shelter.coordinates,
    zoom: 11,
    seaLabelPrefix: "shelter",
    onMapLibreLoad(map) {
      // Nền nhiệt ECMWF như Bản đồ tác nghiệp.
      attachDetailMapTemperature(map);
      attachDetailMapStationPills(map, shelter.coordinates);
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
      incidents.forEach((inc) => addMLMarker(inc.location.coordinates, "incident", inc.title));
      teams.forEach((tm) => addMLMarker(tm.coordinates, "team", tm.name));
    },
  });

  const gmarkersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (engine !== "google" || !ready || !gmapRef.current || !window.google?.maps) return;
    const map = gmapRef.current;
    gmarkersRef.current.forEach((m) => m.setMap(null));
    gmarkersRef.current = [];

    const addM = (coords: [number, number], color: string, title: string) => {
      const m = new google.maps.Marker({ position: { lat: coords[1], lng: coords[0] }, map, title, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      gmarkersRef.current.push(m);
    };

    addM(shelter.coordinates, "#079455", shelter.name);
    shelters.filter((s) => s.id !== shelter.id).forEach((s) =>
      addM(s.coordinates, UNIFIED_MAP_KIND_COLORS.shelter, s.name)
    );
    incidents.forEach((inc) => addM(inc.location.coordinates, UNIFIED_MAP_KIND_COLORS.incident, inc.title));
    teams.forEach((tm) => addM(tm.coordinates, "#1570ef", tm.name));
  }, [engine, ready, shelter, shelters, incidents, teams]);

  return (
    <div className="shelter-operational-map" style={{ position: "relative" }}>
      <div ref={container} className="map-canvas" />
      {/* Huy hiệu thời tiết nổi đã gỡ: thời tiết + thương hiệu NDAMapVN hiển thị tĩnh trên dòng tiêu đề khối bản đồ. */}
      {!ready && <div className="map-loading"><span className="spinner" />Đang tải bản đồ điểm sơ tán…</div>}
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
        <span><i className="shelter-key exception" />Điểm quá tải / không tiếp cận</span>
        <span><i className="shelter-key incident" />Sự cố liên quan</span>
        <span><i className="shelter-key team" />Đội cứu hộ</span>
        <span><i className="wx-key" />Nền nhiệt ECMWF</span>
      </div>
      <div className="map-attribution">© OpenFreeMap · © OpenStreetMap</div>
    </div>
  );
}
