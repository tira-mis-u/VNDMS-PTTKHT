# Kiến trúc Team Management

Module tiếp tục dùng kiến trúc VNDMS hiện hữu; không có `TeamContext` hoặc `TeamStore`.

## Luồng phụ thuộc

- Presentation: `src/features/teams` — list, detail, dialogs và operational map.
- Application: `application/teams/teamUseCases.ts`; assignment/release tái sử dụng `application/tasks/taskUseCases.ts`.
- Domain: `domain/teams` và các Task lifecycle rules độc lập React.
- State orchestration: `OperationalProvider`, canonical Incident/Task/Team state duy nhất.
- Infrastructure: in-memory repository clone deterministic seed; GIS dùng `infrastructure/gis/mapConfig.ts`.

## Synchronization

Team UI gọi contract của `OperationalStateContext`. Provider enforce RBAC, gọi use case, rồi cập nhật tập Task/Team/Incident, trạng thái nhân sự và event streams trong cùng orchestration boundary. Task completion cũng gọi logic tính lại Team availability, vì vậy hai feature không có assignment service riêng.

## GIS

`TeamOperationalMap` dùng MapLibre thật, shared OpenFreeMap style, minimum zoom, Vietnamese label policy và GeoJSON Quần Đảo Hoàng Sa/Quần Đảo Trường Sa. Map hiển thị đội hiện tại, lực lượng khác, task, incident, shelter và route tác nghiệp khi có assignment.

## Command Center

Situation Summary đọc canonical teams để hiển thị đội sẵn sàng, đang triển khai và ngoại lệ. Resource Exceptions và Operational Map điều hướng marker/row đội tới `/teams/:teamId`. Không thay đổi shell hoặc tạo dữ liệu Command Center song song.

## Phạm vi runtime

Persistence hiện in-memory theo phiên. GPS/user/role/scenario là deterministic local demo. API, database, identity provider, GPS streaming và multi-user synchronization là backend tương lai, chưa được triển khai.
