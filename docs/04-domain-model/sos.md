# Domain model — SOS

`SosRequest` gồm identity/timestamps, reporter/source/contact, geographic location/access/flood depth, description, affected/vulnerable population, severity, explicit P1–P4 priority + reasons, lifecycle/verification, Incident/Task/Team/Shelter/Evacuation links, communication and resolution.

## Lifecycle

Mới tiếp nhận → Đang xác minh → Đã xác minh → Đã điều phối → Đang cứu hộ → Đã xử lý → Đã đóng.

Từ chối/Hủy là terminal. Không liên lạc được có recovery giới hạn về xác minh hoặc cứu hộ. Transition matrix nằm ở `domain/sos/rules.ts`; arbitrary status update bị từ chối.

## Triage

Deterministic rule cộng trọng số có giải thích cho life threat, people at risk, injuries, missing, vulnerable groups, isolation/access and communication loss. Không dùng random/opaque score; UI hiển thị toàn bộ reasons. Manual priority override vẫn giữ kết quả rule trong audit explanation.

## Invariants

- Đã điều phối cần linked Task và assigned Team.
- Đang cứu hộ cần Team.
- Đóng cần resolution summary.
- Tạo Task cần SOS đã xác minh + Incident.
- Team/Shelter capacity/lifecycle dùng domain hiện hữu, không sao chép.
