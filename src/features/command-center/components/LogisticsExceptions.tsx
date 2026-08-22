import { AlertTriangle, ChevronRight, PackageOpen, Truck } from "lucide-react";
import { calculateFulfillment, isReliefOverdue } from "@/domain/relief/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { Badge } from "@/components/ui";
export function LogisticsExceptions({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { reliefRequests, reservations, shipments } = useOperationalState();
  const requests = reliefRequests.filter(
    (item) =>
      !["Đã đóng", "Từ chối", "Hủy"].includes(item.status) &&
      (item.priority.startsWith("P1") ||
        isReliefOverdue(item) ||
        calculateFulfillment(item, reservations).some(
          (line) => line.shortage > 0,
        )),
  );
  const incidents = shipments.filter((item) => item.status === "Có sự cố");
  return (
    <section className="cc-panel logistics-exceptions">
      <div className="cc-panel-header">
        <div>
          <span>Ngoại lệ hậu cần</span>
          <small>Thiếu hàng, quá hạn và chuyến có sự cố</small>
        </div>
        <button onClick={() => navigate("/relief/requests")}>
          Mở hàng đợi
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="logistics-exception-list">
        {incidents.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/relief/requests/${item.reliefRequestId}`)}
          >
            <span className="exception-icon danger">
              <Truck size={15} />
            </span>
            <span>
              <b>{item.id} · Có sự cố vận chuyển</b>
              <small>
                {item.destination} · {item.trackingNote}
              </small>
            </span>
            <Badge tone="red">Cần xử lý</Badge>
          </button>
        ))}
        {requests.slice(0, 4).map((item) => {
          const missing = calculateFulfillment(item, reservations).filter(
            (line) => line.shortage > 0,
          );
          return (
            <button
              key={item.id}
              onClick={() => navigate(`/relief/requests/${item.id}`)}
            >
              <span className="exception-icon">
                <PackageOpen size={15} />
              </span>
              <span>
                <b>
                  {item.code} · {item.destination}
                </b>
                <small>
                  {missing.length
                    ? missing
                        .map((line) => `${line.name} thiếu ${line.shortage}`)
                        .join(" · ")
                    : "Yêu cầu đã quá thời hạn"}
                </small>
              </span>
              <Badge tone={item.priority.startsWith("P1") ? "red" : "amber"}>
                {isReliefOverdue(item) ? "Quá hạn" : "Thiếu hàng"}
              </Badge>
            </button>
          );
        })}
        {!incidents.length && !requests.length && (
          <p>
            <AlertTriangle size={15} />
            Không có ngoại lệ hậu cần cần xử lý.
          </p>
        )}
      </div>
    </section>
  );
}
