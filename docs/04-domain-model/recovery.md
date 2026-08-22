# Domain model — Recovery

## DamageAssessment

Assessment có lifecycle `Nháp → Đã gửi → Đang thẩm định → Đã xác minh | Từ chối`. Entity lưu impact, estimated loss, location, polygon vùng ảnh hưởng, DamageItem, evidence, verification decision và revision chain.

`DamageItem` mô tả category, quantity/unit, damage level, cost, affected area/location và evidence. Mức độ: Nhẹ, Trung bình, Nghiêm trọng, Phá hủy.

Verification bắt buộc actor, timestamp, decision, evidence và note. Hồ sơ verified bất biến; revision là assessment mới.

## RecoveryProject

Lifecycle: `Đề xuất → Đã phê duyệt → Đang thực hiện ↔ Tạm dừng → Hoàn thành`; nhánh `Đề xuất → Từ chối`, `Đang thực hiện/Tạm dừng → Đã hủy`.

Project giữ assessment IDs, milestone, task IDs, team IDs, relief request IDs, budget, target date, location và completion verification. Không sở hữu bản sao entity liên module.

## RecoveryMilestone

`Chờ → Đang thực hiện → Hoàn thành`; milestone tùy chọn có thể `Chờ → Bỏ qua`.

## Budget và progress

`remaining = approvedBudget - spentBudget`. Chi vượt ngân sách cần explicit override note. Rủi ro khi sử dụng từ 85%. Progress không được nhập trực tiếp mà dẫn xuất từ milestone/Task canonical.
