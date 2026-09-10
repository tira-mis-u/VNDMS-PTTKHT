# VNDMS — Hệ thống quản lý, giám sát và phòng chống thiên tai

VNDMS là một **ứng dụng web tác nghiệp** mô phỏng phòng điều hành phòng chống thiên tai của Việt Nam: từ lúc nhận tin cảnh báo và phản ánh của người dân, tiếp nhận SOS, điều động lực lượng cứu hộ, theo dõi nhiệm vụ đến khi cán bộ xác nhận kết quả, và công bố cảnh báo tới người dân. Phiên bản V2 thu gọn còn **4 vai trò**: `admin`, `disaster_officer`, `rescue_unit`, `citizen`. Toàn bộ nghiệp vụ chạy trên **một trạng thái tác nghiệp duy nhất** (canonical operational state) có phân quyền, có ranh giới ghi dữ liệu nguyên tử, và có bản đồ khí tượng dùng **dữ liệu thời tiết thật**.

> **Phạm vi trung thực:** đây là một **frontend modular-monolith**, không có backend riêng. Toàn bộ dữ liệu nghiệp vụ nằm trong bộ nhớ trình duyệt và được nạp từ kịch bản mẫu. Phân quyền được thực thi trong trình duyệt để chứng minh kiến trúc ứng dụng — **không phải ranh giới bảo mật thật**. Riêng phần khí tượng – thuỷ văn là dữ liệu thật, gọi trực tiếp từ dịch vụ mở.

---

## 1. Bài toán

Điều hành thiên tai hỏng vì dữ liệu rời rạc chứ hiếm khi vì thiếu màn hình: đội cứu hộ được giao ở hai nơi, SOS không khớp với nhiệm vụ, đơn vị báo "xong" nhưng chưa ai xác nhận, báo cáo tổng hợp lệch với hồ sơ gốc. VNDMS xử lý đúng chỗ đó:

- **Một nguồn dữ liệu tác nghiệp duy nhất** cho mọi phân hệ — không phân hệ nào có bộ dữ liệu riêng.
- **Một cửa ghi duy nhất**: mọi thay đổi đi qua `OperationalProvider`, kiểm quyền rồi mới vào `OperationalMutationBoundary`; hoặc **commit trọn vẹn**, hoặc **huỷ toàn bộ bản nháp**.
- **Đọc cũng bị lọc quyền**: giao diện và phân tích chỉ nhìn thấy phần dữ liệu tài khoản đang đăng nhập được phép thấy; công dân chỉ thấy SOS/phản ánh của chính mình.
- **Nói thật về dữ liệu**: cái gì là quan trắc, cái gì là dự báo, cái gì là ước tính, cái gì chưa có — đều được ghi rõ ngay trên giao diện.

---

## 2. Kiến trúc

```text
Presentation (src/features, src/components)
  → Application  (src/application)   use case · query · authorization
  → Domain       (src/domain)        quy tắc nghiệp vụ · kiểu dữ liệu thuần
  → Infrastructure (src/infrastructure) bản đồ · thời tiết · lưu trữ · phiên đăng nhập
```

Luồng ghi dữ liệu:

```text
Thao tác trên giao diện
  → lệnh của OperationalProvider
  → kiểm quyền: vai · phạm vi địa lý · quyền sở hữu bản ghi (ownerUserId) · trạng thái vòng đời
      · kiểm toàn bộ tài nguyên liên quan của lệnh đa tài nguyên
  → OperationalMutationBoundary tạo bản nháp
  → áp quy tắc domain/application + ghi dòng thời gian canonical
  → commit một lần, hoặc huỷ sạch bản nháp
```

Nguyên tắc bất biến của dự án:

| Nguyên tắc | Ý nghĩa |
| --- | --- |
| Một chủ sở hữu trạng thái | `OperationalProvider` là nơi duy nhất giữ và sửa dữ liệu tác nghiệp |
| Không có dataset song song | Trung tâm điều hành, Phân tích, Cổng công dân đều đọc cùng một state |
| Đọc đã lọc quyền | Presentation nhận *authorized canonical read view*, không nhận state thô |
| Rollback xác định | Bản nháp hỏng ở bước nào cũng bị huỷ toàn bộ, không để lại dữ liệu nửa vời |
| Không có nút chết | Vai không có quyền thì nút biến mất, không phải bấm rồi bị chặn |

Chi tiết: [`docs/05-architecture/ARCHITECTURE.md`](./docs/05-architecture/ARCHITECTURE.md).

---

## 3. Bản đồ phân hệ

Thanh điều hướng gom theo **nhịp công việc**, không theo sơ đồ tổ chức:

| Nhóm | Mục | Nội dung |
| --- | --- | --- |
| **Điều hành** | Trung tâm điều hành | Thao tác nhanh, tình hình chung, dải nguồn lực vượt ngưỡng, hàng đợi việc phải xử lý, dòng đếm cảnh báo, bản đồ thu gọn, sổ trực ban |
| | Bản đồ tác nghiệp | Bản đồ hợp nhất mọi đối tượng + lớp khí tượng + trục thời gian dự báo |
| | Cảnh báo | Cảnh báo **suy ra từ dữ liệu vận hành**, không phải bảng tin nhập tay |
| | Sự cố | Vòng đời sự cố, mức độ, nhiệm vụ/đội liên quan, điều kiện đóng sự cố |
| | Phân tích tác nghiệp | 4 tab: vận hành · nguồn lực · sự cố · báo cáo (có nút in) |
| **Ứng phó** | SOS | Tiếp nhận, xác minh, phân loại ưu tiên, sinh nhiệm vụ, điều đội, kết thúc |
| | Nhiệm vụ | Giao – nhận – bắt đầu – cập nhật hiện trường – **đơn vị báo xong** – **cán bộ xác nhận/từ chối**; phân công lại phải có lý do và lưu lịch sử |
| | Đội cứu hộ | Trạng thái, sẵn sàng, thành viên, vị trí |
| | Phản ánh | Phản ánh của người dân (ngập, sạt lở, hư hỏng…) → cán bộ tiếp nhận / chuyển SOS / trùng / từ chối |
| | Điểm sơ tán | Danh mục tra cứu điểm sơ tán (sức chứa, khả năng tiếp cận); không còn lệnh sơ tán |
| **Quản trị** | Phân quyền · Nhật ký bảo mật | Ma trận quyền theo 4 vai, nhật ký migration vai trò và vết kiểm tra bảo mật |

Ngoài sidebar còn có **Cổng công dân** (giao diện cho vai `citizen`: bản đồ, thời tiết, lấy vị trí, chạm SOS, theo dõi SOS của mình, gửi phản ánh, tra điểm sơ tán, cảnh báo đã công bố). Trang **Cảnh báo** có thêm khối **Cảnh báo công bố** (nháp → công bố → thu hồi) do cán bộ PCTT quản lý.

Các phân hệ **Cứu trợ/Kho/Chuyến hàng, Phương án ứng phó, Phục hồi & thẩm định, Mô phỏng, Trợ lý AI, Lệnh sơ tán** đã được **xóa thật** khỏi mã nguồn ở V2 (route, menu, form, command, seed, test), không chỉ ẩn.

---

## 4. Vòng đời nhiệm vụ V2 — đơn vị báo xong, cán bộ xác nhận

```text
Chờ giao → Đã giao → Đã tiếp nhận → Đang thực hiện → Chờ xác nhận → Hoàn thành
                                          ↑                 │
                                          └── từ chối (kèm lý do) ──┘
```

- Đơn vị cứu hộ (`rescue_unit`) chỉ **báo xong** (`task_report_done`), tạo bản ghi `TaskReview` kèm ghi chú bắt buộc; nhiệm vụ **không tự đóng**.
- Cán bộ PCTT (`disaster_officer`) **chấp nhận** → Hoàn thành, hoặc **từ chối** → quay lại Đang thực hiện; từ chối bắt buộc nêu lý do.
- **Phân công lại** đổi đội/người phụ trách, bắt buộc lý do, lưu `assignmentHistory`.
- SOS gắn `ownerUserId` người gửi; đơn vị cập nhật hiện trường nhưng chỉ cán bộ mới đóng SOS. Sự cố không đóng được khi còn nhiệm vụ "Chờ xác nhận" hoặc SOS chưa đóng.
- Báo cáo/phân tích đọc từ hồ sơ canonical: SOS chờ duyệt và nhiệm vụ chờ xác nhận **không** tính là kết thúc.

---

## 5. Bản đồ và dữ liệu khí tượng — phần dùng dữ liệu thật

Bản đồ nền là **NDAMapVN** (vector tile, nhãn tiếng Việt) hiển thị bằng **MapLibre GL JS**. Trên nền đó là các lớp tác nghiệp (sự cố, SOS, nhiệm vụ, đội, điểm sơ tán) và các lớp khí tượng — bộ công cụ bản đồ kiểu Windy (lớp, trục thời gian, panel) dùng chung cho cả 4 vai:

| Lớp | Nguồn | Ghi chú |
| --- | --- | --- |
| Trường nhiệt độ bề mặt | ECMWF-IFS qua Open-Meteo | Tô nền bằng WebGL shader |
| Vệt gió 10 m động | ECMWF-IFS | Lớp hạt gió theo kiểu Windy |
| Bão / áp thấp nhiệt đới | Tự dò từ trường khí áp mực biển ECMWF-IFS | Lưới 1°, miền **5–26 °N / 105–130 °E**, dự báo **10 ngày** |
| Mưa và dòng chảy sông | Open-Meteo Forecast + Flood API (GloFAS) | Lưu lượng m³/s, **không** suy ra cấp báo động |

**Bộ dò bão** tìm tâm áp thấp khép kín trên biển (loại tâm giả trên đất liền bằng cao độ), kiểm tra độ hụt khí áp so với môi trường và thành phần gió tiếp tuyến, rồi nối các tâm thành quỹ đạo theo tốc độ di chuyển hợp lý. Kết quả gồm quỹ đạo (đoạn đã qua vẽ liền, đoạn dự báo vẽ đứt), tâm bão xoay, vòng bán kính gió mạnh, **mốc đổ bộ** và **mốc tan**.

Trục thời gian nằm dưới bản đồ, kéo được tới **từng giờ** trong toàn bộ dải dữ liệu, và luôn ghi rõ số liệu lấy lúc nào, của mô hình nào.

**Chế độ xem lại bão lịch sử** nạp dữ liệu tái phân tích **ERA5** cho một cơn bão có thật (hiện có bão số 3 **Yagi, 09/2024**) và chạy qua **đúng thuật toán dò bão đang dùng cho dự báo**. Toàn giao diện đổi nhãn sang "tái phân tích ERA5" kèm dải cảnh báo **"DỮ LIỆU QUÁ KHỨ — KHÔNG PHẢI DỰ BÁO"**.

> Mọi con số khí tượng trên giao diện đều ghi nguồn và ghi rõ đây là kết quả dò tự động, **không thay thế bản tin chính thức của Trung tâm Dự báo KTTV Quốc gia**.

---

## 6. Phân quyền

Bốn vai: `admin`, `disaster_officer`, `rescue_unit`, `citizen`. Hệ thống kiểm **năm lớp**:

1. **RBAC** — một ma trận quyền duy nhất (`src/lib/permissions/permissions.ts`).
2. **Phạm vi địa lý** — quốc gia / tỉnh / quận-huyện / phường-xã.
3. **Quyền sở hữu bản ghi** — quyền `*_own` (SOS, phản ánh) chỉ áp dụng khi `ownerUserId` trùng tài khoản; quan hệ đội/kho trên tài khoản **không còn** hiệu lực cấp quyền.
4. **Trạng thái vòng đời** — không cho phép hành động sai pha (ví dụ giao việc cho đội đang mất liên lạc, chấp nhận kết quả khi chưa báo xong).
5. **Tài nguyên liên quan** — lệnh chạm nhiều đối tượng thì phải hợp lệ với **tất cả**, nếu không thì huỷ cả lệnh.

| Vai | Được | Không được |
| --- | --- | --- |
| `admin` | Quản lý người dùng, nhật ký bảo mật, xem toàn bộ dữ liệu tác nghiệp, quản lý đội/điểm sơ tán, gửi SOS/phản ánh | **Không mặc định** có quyền xác minh SOS, điều phối, chấp nhận kết quả nhiệm vụ, công bố cảnh báo |
| `disaster_officer` | Toàn bộ nghiệp vụ: tạo sự cố, xác minh/điều phối SOS, giao/phân công lại/xác nhận nhiệm vụ, duyệt phản ánh, công bố/thu hồi cảnh báo; xem nhật ký bảo mật (giữ từ vai `operator` cũ) | Quản lý người dùng |
| `rescue_unit` | Nhận/bắt đầu/cập nhật/báo xong nhiệm vụ, cập nhật trạng thái & vị trí mọi đội, cập nhật hiện trường SOS, xác nhận cảnh báo tác nghiệp | Giao việc, chấp nhận kết quả, đóng SOS, công bố cảnh báo |
| `citizen` | Gửi & theo dõi SOS của mình, gửi & theo dõi phản ánh của mình, xem cảnh báo công bố, điểm sơ tán, bản đồ/thời tiết/vị trí | Mọi dữ liệu tác nghiệp nội bộ |

Đọc dữ liệu đi qua *authorized read view*.

---

## 7. Migration mô hình vai trò V2

Khi tải ứng dụng, `LocalAuthenticationAdapter` kiểm tra `vndms.auth.roleModel.version`. Nếu chưa bằng `2`:

1. sao lưu danh sách người dùng hiện có vào `vndms.auth.users.v5.backup.r1`;
2. ánh xạ vai theo bảng dưới (giữ nguyên `id`, `username`, mật khẩu, phạm vi, trạng thái); gỡ `teamId`/`warehouseId` khỏi hiệu lực phân quyền; tài khoản ngoài bảng được ánh xạ theo vai cũ hoặc giữ nguyên và ghi vào danh sách ngoại lệ;
3. ghi nhật ký `vndms.auth.roleModel.migrationLog` và audit `ROLE_MODEL_MIGRATED`; **không tạo tài khoản mới**.

Chạy lại là **idempotent**. Rollback: `rollbackRoleModelMigration(storage)` khôi phục bản sao lưu và xóa version/log/phiên.

| Vai cũ | Vai V2 |
| --- | --- |
| `commander` | `admin` |
| `operator` | `disaster_officer` |
| `rescue_leader` | `rescue_unit` |
| `local_officer`, `rescue_member`, `warehouse_staff`, `relief_worker`, `citizen` | `citizen` |

---

## 8. Dữ liệu mẫu

Trạng thái khởi tạo lấy từ kịch bản **Bão Yagi 2024 — quy mô quốc gia** (`src/data/scenarios/yagi-2024-national`):

| Đối tượng | Số lượng | | Đối tượng | Số lượng |
| --- | ---: | --- | --- | ---: |
| Sự cố | 7 | | Yêu cầu SOS | 5 |
| Nhiệm vụ | 7 | | Cảnh báo công bố | 2 |
| Đội cứu hộ | 7 | | Phản ánh | 0 (tạo từ Cổng công dân) |
| Điểm sơ tán | 6 | | | |

Kịch bản **Lũ Sông Hồng** (`src/data/scenarios/red-river-flood`) hiện đóng vai trò *fixture cho test*, không nạp vào runtime.

---

## 9. Tài khoản demo

Mật khẩu dùng chung: **`VNDMS@2026`**.

| Tên đăng nhập | Họ tên | Vai trò | Phạm vi / ràng buộc |
| --- | --- | --- | --- |
| `thuantq` (`USR-CMD-001`) | Trần Quốc Thuận | `admin` — Quản trị hệ thống | Toàn quốc |
| `nguyentrung` (`USR-OPS-001`) | Nguyễn Quốc Trung | `disaster_officer` — Cán bộ PCTT | Toàn quốc |
| `phamhieu` (`USR-RSL-001`) | Phạm Trung Hiếu | `rescue_unit` — Đơn vị cứu hộ (chỉ huy toàn bộ các đội) | Toàn quốc |
| `phamdam` (`USR-LOC-001`) | Phạm Văn Đam | `citizen` — Công dân | Quận Tây Hồ, Hà Nội |
| `minhtri` (`USR-RSM-001`) | Lê Nguyễn Minh Trí | `citizen` — Công dân | Hà Nội |
| `namanh` (`USR-WHS-001`) | Nguyễn Nam Anh | `citizen` — Công dân | Quận Hoàn Kiếm, Hà Nội |
| `trantuan` (`USR-CTZ-001`) | Trần Thái Tuấn | `citizen` — Công dân | Toàn quốc |

Không có tài khoản seed/bootstrap nào khác. Đăng nhập bằng hai tài khoản khác nhau là cách nhanh nhất để thấy ranh giới phân quyền: cùng một màn hình nhưng khác dữ liệu, khác nút bấm.

---

## 10. Công nghệ

React 19 · TypeScript 6 · Vite 8 · MapLibre GL JS 6 · Lucide React · CSS design tokens (không dùng framework UI) · Node test runner chạy qua `tsx` · oxlint.

Thư viện hạ tầng tuỳ chọn: `@supabase/supabase-js` (đồng bộ người dùng), `@upstash/redis` (chia sẻ vị trí trực tiếp giữa các máy). **Cả hai đều không bắt buộc** — thiếu biến môi trường thì ứng dụng tự chạy ở chế độ cục bộ, không lỗi.

---

## 11. Chạy dự án

Yêu cầu Node.js 20 trở lên và npm.

```bash
npm install
npm run dev            # http://localhost:5173
```

Build và xem thử bản production:

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

Cấu hình tuỳ chọn — sao chép `.env.example` thành `.env` nếu cần:

| Biến | Dùng để làm gì | Thiếu thì sao |
| --- | --- | --- |
| `VITE_NDAMAPVN_API_KEY`, `VITE_NDAMAPVN_TILE_URL` | Bản đồ nền NDAMapVN | Dùng khoá và style mặc định đã nhúng sẵn |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Đồng bộ tài khoản | Dùng danh sách tài khoản demo cục bộ |
| `VITE_UPSTASH_REDIS_REST_URL`, `VITE_UPSTASH_REDIS_REST_TOKEN` | Chia sẻ vị trí trực tiếp | Tắt tính năng phát định vị, phần còn lại không đổi |

Dữ liệu khí tượng (Open-Meteo) **không cần khoá API**, nhưng có giới hạn tần suất: gọi quá nhiều sẽ nhận HTTP 429 và ứng dụng tự hạ nhiệt theo bậc 60 s → 120 s → 240 s. Bản đồ và lớp thời tiết đều cần kết nối mạng.

---

## 12. Kiểm thử và chất lượng

```bash
npm test            # toàn bộ: 27 tệp test, 190 kịch bản
npm run test:focused # đường găng: mutation boundary, phân quyền, migration vai trò, nhiệm vụ/phản ánh/cảnh báo công bố
npm run lint
npm run build
```

Suite tập trung vào giá trị kiến trúc chứ không chạy theo phần trăm coverage: quy tắc vòng đời domain; use case và truy vấn phân tích; phiên đăng nhập và phân quyền theo tài nguyên/chủ sở hữu; migration vai trò V2 (version, idempotent, backup/rollback); commit lồng nhau và rollback toàn phần; liên kết chéo SOS–Task–Team; vòng đời báo xong → xác nhận; phản ánh và cảnh báo công bố; quét tĩnh chống bypass cửa ghi.

**Trạng thái thật của suite:** **188 kịch bản đạt / 2 không đạt** trên tổng 190. Hai kịch bản không đạt nằm trong `ui-content-normalization` và là **nợ có sẵn từ trước V2** (một test phụ thuộc `scripts/audit-ui-content.mjs` đã bị xóa ở commit trước; một test kiểm cỡ chữ < 12,5 px trong CSS gốc). Chúng được giữ nguyên, không skip, không nới lỏng.

Chi tiết chiến lược: [`tests/README.md`](./tests/README.md).

---

## 13. Đường dẫn chính

```text
/login
/                                  Trung tâm điều hành
/workspace/Bản%20đồ%20tác%20nghiệp Bản đồ tác nghiệp
/alerts        /incidents     /tasks        /teams
/sos           /shelters      /reports      /analytics
/profile       /admin/audit   /workspace/Phân%20quyền
```

Trang chi tiết dùng đúng mã canonical, ví dụ `/incidents/INC-YAGI-01`, `/tasks/TSK-YAGI-01`, `/sos/SOS-YAGI-01`, `/teams/CH-HN-01`. Các đường dẫn `/relief/*`, `/playbooks`, `/recovery`, `/simulation`, `/ai-assistant`, `/evacuations` trả về trang không tìm thấy.

---

## 14. Lộ trình xem thử trong 10 phút

1. Đăng nhập `thuantq` → **Trung tâm điều hành**: đọc hàng đợi việc, dải nguồn lực vượt ngưỡng và sổ trực ban.
2. Mở **Bản đồ tác nghiệp**: xem lớp gió và nhiệt độ thật; nếu có xoáy thuận trong 10 ngày tới, dải phía trên sẽ nêu tên và mốc thời gian — bấm *Xem trên bản đồ*.
3. Bấm **Xem lại Bão số 3 Yagi — 09/2024** rồi kéo trục thời gian: quan sát bão vượt Biển Đông, mốc **đổ bộ** và mốc **tan** trong đất liền.
4. Đăng nhập `nguyentrung` (cán bộ PCTT): mở một **SOS**, xác minh và sinh nhiệm vụ, điều đội — rồi quay lại xem sự cố, đội và phân tích đã đổi theo. Vào **Cảnh báo → Cảnh báo công bố** để soạn nháp/công bố/thu hồi.
5. Đăng nhập `phamhieu` (đơn vị cứu hộ): nhận, bắt đầu và **báo xong** nhiệm vụ — trạng thái chuyển "Chờ xác nhận", không tự đóng.
6. Quay lại `nguyentrung`: **chấp nhận** hoặc **từ chối** kết quả (từ chối phải nêu lý do); thử **phân công lại** và xem lịch sử.
7. Đăng nhập `trantuan` hoặc `minhtri` (công dân): lấy vị trí, chạm SOS, gửi phản ánh, theo dõi SOS của mình, xem cảnh báo đã công bố.
8. Đăng nhập `thuantq` (admin): xem `/workspace/Phân%20quyền`, nhật ký migration vai trò và `/admin/audit`; để ý admin **không** có nút xác minh/điều phối/xác nhận kết quả.

---

## 15. Giới hạn — nói rõ để không hiểu nhầm năng lực

Dự án **chưa có**:

- backend, API và lưu trữ bền vững (mọi thay đổi mất khi tải lại trang);
- phân quyền phía máy chủ hoặc chính sách bảo mật ở tầng cơ sở dữ liệu;
- giao dịch cơ sở dữ liệu, kiểm soát tương tranh, đồng bộ nhiều máy;
- kênh truyền thời gian thực đúng nghĩa;
- nhật ký kiểm toán chống sửa đổi;
- phiên HttpOnly, xác thực đa yếu tố, chống CSRF, giới hạn tần suất, quản lý bí mật;
- giám sát, CI/CD và quy trình vận hành sản xuất;
- dịch vụ tile bản đồ do hệ thống tự kiểm soát.

Phiên đăng nhập, người dùng và nhật ký nằm trong bộ nhớ trình duyệt — người dùng có thể sửa bằng DevTools. **Không dùng frontend này làm ranh giới bảo mật thật.**

Ngoài ra, phần khí tượng có giới hạn khoa học phải nêu: bộ dò bão chạy trên lưới 1° nên **mốc đổ bộ là xấp xỉ theo nút lưới**, không phải toạ độ cắt bờ chính xác; GloFAS cho lưu lượng chứ không cho mực nước nên hệ thống **không suy ra cấp báo động I/II/III**.

---

## 16. Hướng phát triển tiếp

1. Backend với phân quyền phía máy chủ và giao dịch bền vững; đẩy toàn bộ ma trận quyền xuống tầng dữ liệu.
2. Nhà cung cấp định danh, phiên HttpOnly/MFA và nhật ký kiểm toán bất biến.
3. Truyền sự kiện thời gian thực, idempotency, kiểm soát tương tranh lạc quan, giám sát vận hành.
4. Đồng bộ schema Supabase (`supabase/schema.sql` còn ràng buộc CHECK theo vai cũ) sang 4 vai V2; hiện client ánh xạ vai cũ → mới khi đọc hồ sơ.
5. Dựng CI/CD, kiểm thử E2E trên trình duyệt, kiểm tra khả năng tiếp cận; dọn 2 kịch bản `ui-content-normalization` còn nợ.
6. Nguồn tile bản đồ có SLA cho môi trường vận hành thật.

---

## 17. Tài liệu kèm theo

| Tệp | Nội dung |
| --- | --- |
| [`docs/05-architecture/ARCHITECTURE.md`](./docs/05-architecture/ARCHITECTURE.md) | Kiến trúc chi tiết |
| [`docs/03-use-cases/`](./docs/03-use-cases) · [`docs/04-domain-model/`](./docs/04-domain-model) | Use case và mô hình domain từng phân hệ |
| [`tests/README.md`](./tests/README.md) | Chiến lược kiểm thử |
| [`THAY-DOI.md`](./THAY-DOI.md) | Nhật ký các đợt cải tiến, kèm số đo trước/sau |
| [`PHAN-TICH-UX-VA-PHAM-VI.md`](./PHAN-TICH-UX-VA-PHAM-VI.md) | Phân tích trải nghiệm và phạm vi |
| [`docs/03-use-cases/v2-use-cases-tg01-tg21.md`](./docs/03-use-cases/v2-use-cases-tg01-tg21.md) | 21 use case TG01–TG21 với actor V2 |
| [`BAO-CAO-REFACTOR-V2.md`](./BAO-CAO-REFACTOR-V2.md) | Báo cáo refactor V2 (mapping, ma trận tiện ích, Giữ/Sửa/Gộp/Xóa, kết quả build/lint/test, migration) |
