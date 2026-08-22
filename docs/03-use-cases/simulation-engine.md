# Ca sử dụng — Simulation Engine

## Kịch bản

Chỉ huy chạy kịch bản deterministic “Lũ Sông Hồng — Hà Nội”, seed `20240901`, để trình diễn chuỗi mưa → thủy văn → BĐ III → rủi ro → Incident → giao thông → sơ tán → Shelter → SOS → Task → Team → Relief → ổn định → Recovery → Analytics.

## Điều khiển

Người có `simulation_control` được Play, Pause, Step, đổi tốc độ và Reset. Người có `simulation_view` chỉ quan sát. Step chỉ áp dụng tick kế tiếp; Play dùng cùng Step use case nên không có đường mutation riêng.

## Theo dõi

UI luôn hiển thị “DỮ LIỆU MÔ PHỎNG”, seed, tick, thời gian, stage, mưa, mực nước, tốc độ tăng, warning, risk, khu vực, đường hạn chế và event log. Mỗi operational mutation liên kết tới entity canonical.

## Reset

Reset dừng engine, tải lại deterministic baseline qua `inMemoryOperationalRepository.load()`, thay toàn bộ canonical collections tại `OperationalProvider` và tạo lại simulation state tick 0. Không reload trình duyệt, không để entity `*-SIM-*` hoặc assignment orphan.
