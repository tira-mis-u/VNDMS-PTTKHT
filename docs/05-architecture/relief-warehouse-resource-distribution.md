# Kiến trúc — Cứu trợ, kho và phân phối

Module tuân thủ Presentation → Application → Domain và dùng Infrastructure adapters hiện hữu.

- Domain: `src/domain/relief` chứa entity, vòng đời, tồn khả dụng và fulfillment.
- Application: `src/application/relief` chứa use case và query hàng đợi; không phụ thuộc React.
- Infrastructure: repository in-memory clone dữ liệu kịch bản.
- State: `OperationalProvider` là chủ sở hữu canonical duy nhất; không có store/event bus mới.
- Presentation: các trang `/relief/**`, dialog mutation thật và MapLibre dùng `mapConfig` chung.

RBAC được mở rộng bằng permission `relief_*`, `warehouse_*`, `shipment_*`. `assertReliefScope` được gọi tại mutation boundary cho cán bộ địa phương. Team assignment tái sử dụng `assertTeamDispatchable`, `assignTeamToReliefShipment` và release hiện hữu.

Incident và Shelter chỉ lọc request theo khóa liên kết; Team chỉ tham chiếu `currentReliefShipment`. Không nhân bản vòng đời các module. Command Center chỉ tổng hợp ngoại lệ canonical.
