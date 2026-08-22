# Domain model — Simulation

## SimulationState

State riêng của scenario gồm scenarioId, seed, tick/maxTick, simulationTime, status, speed, stage, rainfall, riverLevel/rate, warningLevel, riskLevel, affectedAreas, blockedRoads, hazards, thresholds, event history và applied event IDs. State này mô tả kịch bản, không thay thế Incident/Task/Team/SOS canonical.

## Deterministic model

Seed duy nhất `20240901`; baseline bắt đầu `21/08/2026 08:30`. 16 TickDefinition cố định tạo cùng kết quả từ cùng baseline. Không dùng random.

## Hydrology

Mô hình đơn giản hóa dùng mưa tích lũy theo tick và đường mực nước xác định. Threshold scenario: BĐ I 9,5 m, BĐ II 10,5 m, BĐ III 11,5 m. River-level rate là chênh lệch với tick trước.

## Event/idempotency

ID `SIM-20240901-Txx` ổn định. Event ghi kind, reason, consequence, mutation và entity route. `appliedEventIds` ngăn tick trùng; application propagation kiểm tra event IDs trong canonical audit collections trước khi mutation.

## Stages

Bình thường → Cảnh báo → Nguy hiểm → Ứng phó → Sơ tán → Cứu hộ → Ổn định → Phục hồi.
