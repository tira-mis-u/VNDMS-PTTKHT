# Domain model — Analytics & Operational Reporting

Analytics là read model dẫn xuất, không sở hữu operational entity.

## AnalyticsPeriod

Bộ lọc gồm `from`, `to`, `geographicScope`, `incidentId` và `referenceTime`. Ngày vận hành dùng định dạng `DD/MM/YYYY HH:mm`.

## Metric semantics

`MetricBasis` phân biệt:

- `Ghi nhận`: giá trị lưu trên entity canonical.
- `Dẫn xuất`: kết quả tính từ nhiều trường/entity/timeline.

Các read model: `OperationalSummary`, `IncidentAnalytics`, `TaskAnalytics`, `TeamAnalytics`, `ShelterAnalytics`, `EvacuationAnalytics`, `SosAnalytics`, `ReliefAnalytics`, `RecoveryAnalytics` và `OperationalException`.

## OperationalReport

Báo cáo chứa type, period/scope, situation summary, findings, response statistics, resource utilization, exceptions, actions, recovery status và audit metadata. Báo cáo không được ghi ngược hoặc thay đổi trạng thái entity nguồn.

## Quy ước dẫn xuất

Incident quá hạn dùng ngưỡng báo cáo 120 phút; không thay đổi lifecycle. Tồn khả dụng bằng on-hand trừ reserved. Relief shortage bằng approved trừ reservation chưa giải phóng. Shelter utilization bằng occupancy/capacity. Team utilization dựa trên assignment canonical. Recovery budget/progress chỉ đọc kết quả nghiệp vụ Recovery.
