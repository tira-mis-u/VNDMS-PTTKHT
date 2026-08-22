# Domain model — Rescue Team

`RescueTeam` là nguồn lực tác nghiệp, không phải mục danh bạ. Model tại `src/domain/teams/types.ts` gồm:

- identity: `id`, `code`, `name`, `type`;
- force: `leader`, `members`, `personnel` với role, responsibility/specialty, status, contact;
- readiness: `status`, `availability`, `communicationStatus`;
- assignment: `currentTask`, `currentIncident`;
- capability/equipment: `capabilities`, `capability`, `vehicles` (bao gồm phương tiện và thiết bị);
- geography: `location`, `coordinates`, `region`, `operatingScope`;
- operations: `lastLocationUpdate`, `lastOperationalUpdate`, `notes`, timestamps.

## Lifecycle

- Sẵn sàng → Đang điều động, Tạm nghỉ, Không khả dụng.
- Đang điều động → Đang thực hiện, Sẵn sàng, Mất liên lạc.
- Đang thực hiện → Sẵn sàng, Mất liên lạc, Không khả dụng.
- Tạm nghỉ/Mất liên lạc/Không khả dụng có các recovery transition giới hạn trong `rules.ts`.

UI dùng cách diễn đạt vận hành tương ứng: đang điều động là đội đang di chuyển/tiếp cận; đang thực hiện là đội đang nhiệm vụ; tạm nghỉ là nghỉ/kết thúc ca; không khả dụng là tạm thời không sẵn sàng.

## Invariants

- Không điều phối đội Mất liên lạc, Không khả dụng hoặc Tạm nghỉ.
- Đội có `currentTask` không thể chuyển thủ công về Sẵn sàng.
- Team availability và trạng thái nhân sự được suy ra từ lifecycle status, không đổi tùy ý ở UI.
- Hoàn thành/hủy/gỡ task phải tính lại assignment từ các task còn mở.
- Năng lực không được rỗng; thông tin nhận dạng quan trọng phải có giá trị.
- Team/Task/Incident relationship dùng ID hiện hữu, không thêm relationship model thứ hai.

`TeamEvent` ghi nhận điều phối, task status, vị trí, hồ sơ, năng lực và ngoại lệ liên lạc.
