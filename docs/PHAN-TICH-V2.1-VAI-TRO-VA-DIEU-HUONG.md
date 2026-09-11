# Phân tích V2.1 — Vai trò, gộp danh mục, bản đồ cho công dân, phát định vị & SOS realtime

> Tài liệu phân tích, **chưa code**. Mỗi mục kết thúc bằng "Đề xuất" và "Cần bạn chốt".

---

## 1. Nghiệp vụ của 4 vai trò

### 1.1 Cách nhìn tổng quát

Bốn vai không phải 4 "cấp bậc" mà là 4 **vị trí trong vòng đời một tình huống thiên tai**:

```
Người dân phát hiện ──▶ Cán bộ PCTT quyết định ──▶ Đơn vị cứu hộ thực thi ──▶ Cán bộ PCTT xác nhận
    (citizen)              (disaster_officer)           (rescue_unit)              (disaster_officer)
                                    ▲
                                    │ vận hành nền tảng, không can thiệp nghiệp vụ
                              Quản trị viên (admin)
```

Nguyên tắc phân tách: **ai tạo tín hiệu / ai ra quyết định / ai thực thi / ai giữ hệ thống chạy**. Không vai nào vừa ra quyết định vừa tự xác nhận kết quả của mình.

### 1.2 Quản trị viên (`admin`) — "giữ hệ thống chạy"

| Khía cạnh | Nội dung |
| --- | --- |
| Trách nhiệm cốt lõi | Tài khoản, vai trò, phạm vi địa lý; nhật ký bảo mật & migration; danh mục nền (đội cứu hộ, điểm sơ tán) |
| Được xem | Toàn bộ dữ liệu tác nghiệp (để hỗ trợ, đối soát, xử lý sự cố hệ thống) |
| **Không** được làm | Xác minh SOS, điều phối đội, giao/xác nhận nhiệm vụ, duyệt phản ánh, công bố cảnh báo |
| Lý do tách | Tránh "siêu tài khoản" — người quản trị kỹ thuật không chịu trách nhiệm pháp lý về quyết định ứng phó. Nếu admin cũng là cán bộ PCTT thì cấp **2 tài khoản** hoặc đổi vai, không gộp quyền |
| Tiện ích chung | Vẫn gửi SOS / phản ánh / xem cảnh báo như một người dùng bình thường (admin cũng có thể gặp nạn) |
| Câu hỏi thường gặp | *"Admin có cần vào Trung tâm điều hành không?"* — Có, ở chế độ **xem**: giúp phát hiện dữ liệu bất thường, tài khoản dùng sai. Nút hành động bị ẩn theo nguyên tắc "không có nút chết" |

### 1.3 Cán bộ phòng chống thiên tai (`disaster_officer`) — "ra quyết định"

| Khía cạnh | Nội dung |
| --- | --- |
| Trách nhiệm cốt lõi | Tiếp nhận & xác minh tín hiệu (SOS, phản ánh) → mở sự cố → tạo nhiệm vụ → điều phối đội → **xác nhận kết quả** → đóng SOS/sự cố → công bố/thu hồi cảnh báo → báo cáo |
| Điểm khác V1 | Là vai **duy nhất** được đóng vòng (chấp nhận kết quả, đóng SOS, đóng sự cố). Đây là "cửa kiểm soát" để số liệu báo cáo không bị đơn vị tự khai |
| Phạm vi | Theo `geographicScope` (national/province/district). Cán bộ tỉnh chỉ thấy & thao tác trong tỉnh |
| Rủi ro nghiệp vụ | Tắc nghẽn ở khâu xác nhận nếu ít cán bộ, nhiều nhiệm vụ → UI phải có hàng đợi "Chờ xác nhận" nổi bật (đã có tab, nên đưa lên Trung tâm điều hành) |
| Nhật ký bảo mật | Giữ `audit_view` (thừa kế từ `operator`) — hợp lý vì cán bộ cần truy vết ai điều đội lúc nào |

### 1.4 Đơn vị cứu hộ (`rescue_unit`) — "thực thi tại hiện trường"

| Khía cạnh | Nội dung |
| --- | --- |
| Trách nhiệm cốt lõi | Nhận nhiệm vụ → bắt đầu → cập nhật tiến độ/hiện trường → **báo xong**; cập nhật trạng thái/vị trí/nhân sự đội; cập nhật hiện trường SOS; xác nhận đã đọc cảnh báo tác nghiệp |
| **Không** được làm | Tự đóng nhiệm vụ/SOS, tự giao việc cho mình, tạo sự cố |
| Mô hình hiện tại | Một tài khoản (`phamhieu`) chỉ huy **mọi đội** — theo quyết định của bạn. Hệ quả: không có ranh giới "đội mình / đội khác" |
| Điểm cần lưu ý | Khi triển khai thật sẽ có **nhiều** tài khoản `rescue_unit` (mỗi đội/đơn vị một tài khoản). Khi đó cần bật lại ownership theo đội (`assignedTeamIds`) — mã đã sẵn field này, chỉ tắt ở ma trận. **Không phải việc bây giờ**, nhưng nên ghi vào roadmap |
| Landing | `/tasks` — vì đơn vị vào app để xem "việc của tôi" chứ không phải bức tranh toàn cục |

### 1.5 Công dân (`citizen`) — "phát hiện & được bảo vệ"

| Khía cạnh | Nội dung |
| --- | --- |
| Trách nhiệm cốt lõi | Gửi SOS (1 chạm/biểu mẫu), gửi phản ánh, theo dõi SOS/phản ánh của mình, xem cảnh báo công bố, tra điểm sơ tán, xem bản đồ & thời tiết |
| Chỉ thấy của mình | SOS, phản ánh (`ownerUserId`) |
| Không thấy | Danh sách sự cố nội bộ, nhiệm vụ, chi tiết đội, cảnh báo tác nghiệp (chưa công bố), phân tích |
| Vấn đề hiện tại | **Không xem được Bản đồ tác nghiệp** → xem mục 3 dưới đây |
| 4 tài khoản citizen | `phamdam`, `minhtri`, `namanh`, `trantuan` — chỉ khác phạm vi địa lý (ảnh hưởng địa bàn mặc định, không ảnh hưởng quyền) |

### 1.6 Ma trận "ai làm gì trong một tình huống"

| Bước | citizen | rescue_unit | disaster_officer | admin |
| --- | :-: | :-: | :-: | :-: |
| Phát hiện: SOS / phản ánh | **Tạo** | Tạo | Tạo | Tạo |
| Xác minh / từ chối SOS, duyệt phản ánh | — | — | **Quyết định** | xem |
| Mở sự cố, tạo nhiệm vụ, điều đội | — | — | **Quyết định** | xem |
| Nhận / bắt đầu / cập nhật / báo xong | — | **Thực thi** | xem | xem |
| Phân công lại (có lý do) | — | — | **Quyết định** | xem |
| Xác nhận kết quả, đóng SOS, đóng sự cố | — | — | **Quyết định** | xem |
| Công bố / thu hồi cảnh báo | xem bản công bố | xem | **Quyết định** | xem |
| Báo cáo / phân tích | — | — | Xem | Xem |
| Tài khoản, vai, nhật ký | — | — | nhật ký | **Quyết định** |

---

## 2. Có nên gộp các mục con trong danh mục? Gộp thế nào?

### 2.1 Hiện trạng sidebar (vai nội bộ)

```
Điều hành:  Trung tâm điều hành · Bản đồ tác nghiệp · Cảnh báo · Sự cố · Phân tích tác nghiệp
Ứng phó:    SOS · Nhiệm vụ · Đội cứu hộ · Phản ánh · Điểm sơ tán
Quản trị:   Phân quyền · Nhật ký bảo mật
```

10 mục cho cán bộ; đơn vị cứu hộ thấy 8; admin thấy 10.

### 2.2 Phân tích từng cặp có thể gộp

| Ứng viên gộp | Lập luận gộp | Lập luận giữ riêng | Kết luận |
| --- | --- | --- | --- |
| **SOS + Phản ánh** → "Tiếp nhận" | Cùng bản chất: **tín hiệu từ dân** chờ cán bộ xử lý; cùng thao tác (xác minh/từ chối/chuyển); phản ánh có thể được "nâng" thành SOS | SOS là khẩn cấp (đe dọa tính mạng, SLA phút), phản ánh là không khẩn (ngập đường, cây đổ, SLA giờ/ngày). Trộn danh sách làm loãng độ khẩn | **Gộp thành 1 mục "Tiếp nhận" với 2 tab (SOS \| Phản ánh)**. Tab SOS mặc định. Đếm badge riêng từng tab. Giảm 1 mục sidebar, giữ nguyên trang/route bên trong (chỉ đổi cách vào) |
| **Nhiệm vụ + Đội cứu hộ** → "Lực lượng" | Đội và nhiệm vụ luôn đi cùng nhau (điều đội = giao nhiệm vụ) | Đối tượng khác hẳn: một cái là *việc*, một cái là *người/phương tiện*. Đơn vị cứu hộ vào "Nhiệm vụ" hàng chục lần/ngày, vào "Đội" chỉ khi cập nhật trạng thái. Đội cũng là **danh mục nền** admin quản lý | **Giữ riêng.** Thay vào đó tăng liên kết chéo (đã có: chi tiết nhiệm vụ → đội, chi tiết đội → nhiệm vụ đang làm) |
| **Điểm sơ tán** → chuyển sang nhóm khác | Điểm sơ tán ở V2 là **danh mục tra cứu**, không phải quy trình ứng phó | Nằm trong "Ứng phó" vì cán bộ dùng khi điều phối | **Chuyển sang cuối nhóm "Điều hành" hoặc gộp vào Bản đồ tác nghiệp dưới dạng lớp + panel danh sách.** Đề xuất: giữ route `/shelters` nhưng đưa mục ra khỏi "Ứng phó" để nhóm này chỉ còn quy trình |
| **Sự cố + Cảnh báo** | Cảnh báo tác nghiệp phần lớn suy ra từ sự cố/nhiệm vụ/đội | Cảnh báo là *lớp thông báo xuyên module*, có cả cảnh báo công bố cho dân | **Giữ riêng** |
| **Cảnh báo tác nghiệp + Cảnh báo công bố** (trong trang Cảnh báo) | Đã cùng trang | Đối tượng đọc khác nhau (nội bộ vs dân) | **Giữ 2 khối trên cùng trang** như hiện tại, nhưng nên đổi thành 2 tab thay vì xếp dọc |
| **Phân tích tác nghiệp** (4 tab) | Đã gộp | — | Giữ |
| **Phân quyền + Nhật ký bảo mật** | Cùng nhóm Quản trị | Cán bộ có nhật ký nhưng không có phân quyền | Giữ riêng |

### 2.3 Sidebar đề xuất

```
Điều hành:  Trung tâm điều hành · Bản đồ tác nghiệp · Cảnh báo · Sự cố · Phân tích tác nghiệp · Điểm sơ tán
Ứng phó:    Tiếp nhận (SOS | Phản ánh) · Nhiệm vụ · Đội cứu hộ
Quản trị:   Phân quyền · Nhật ký bảo mật
```

- Cán bộ PCTT: 10 → 9 mục; nhóm "Ứng phó" đúng nghĩa là **quy trình 3 bước: tiếp nhận → giao việc → lực lượng**.
- Đơn vị cứu hộ: Tiếp nhận (chỉ tab SOS, vì không có `report_view`) · Nhiệm vụ · Đội cứu hộ.
- Không đổi route: `/sos`, `/reports` giữ nguyên; "Tiếp nhận" là mục sidebar trỏ `/sos`, tab trong trang chuyển sang `/reports` (đã có pattern `GroupedSectionTabs`).

### 2.4 Nguyên tắc để quyết định gộp/không gộp (dùng cho sau này)

1. Gộp khi **cùng người dùng, cùng nhịp, cùng thao tác** (SOS/phản ánh ✔; nhiệm vụ/đội ✘).
2. Không gộp chỉ vì "liên quan" — liên quan thì dùng liên kết chéo.
3. Một nhóm sidebar không quá 5 mục; một trang không quá 4 tab.
4. Đổi cách vào, không đổi route — tránh phá bookmark/test.

---

## 3. Vì sao công dân chưa xem được Bản đồ tác nghiệp — và nên mở thế nào

### 3.1 Nguyên nhân hiện tại

- Route `operational-map` yêu cầu quyền `view` (`App.tsx → requiredPermission`), mà `citizen` không có `view`.
- Bản đồ tác nghiệp (`UnifiedMapCanvas`) vẽ **mọi lớp nghiệp vụ**: sự cố, SOS của người khác, nhiệm vụ, vị trí đội, tín hiệu định vị realtime của mọi người → không thể mở nguyên trạng cho dân.
- Cổng công dân đã có bản đồ riêng nhưng là bản **rút gọn** (MapLibre + marker điểm sơ tán/sự cố/SOS của mình), **không có** lớp gió Windy, lớp nhiệt, trục thời gian dự báo, dò bão, xem lại ERA5.

Bạn đúng: dân cần "tổng quan như Windy". Đây là **tiện ích chung** theo đúng tinh thần V2, không phải dữ liệu nghiệp vụ.

### 3.2 Hai phương án

| | A. Mở `/workspace/Bản đồ tác nghiệp` cho citizen với bộ lọc lớp theo quyền | B. Nâng bản đồ trong Cổng công dân lên dùng `UnifiedMapCanvas` ở "chế độ công khai" |
| --- | --- | --- |
| Cách làm | Đổi quyền route sang `published_alert_view`; `unifiedMapQueries` đã lọc theo authorized view (citizen: incidents/tasks/teams = []) nên lớp nghiệp vụ tự rỗng; ẩn chip lớp rỗng; ẩn tín hiệu định vị của người khác | Cổng công dân nhúng cùng canvas với prop `mode="public"`; bỏ bản đồ rút gọn hiện tại |
| Ưu | Ít code; dân được đúng công cụ Windy đầy đủ; một canvas duy nhất | Trải nghiệm liền mạch trong Cổng công dân, không nhảy sang khung "tác nghiệp" |
| Nhược | Tiêu đề/ngôn ngữ "tác nghiệp" không hợp với dân; thanh lọc mức độ/sự cố vô nghĩa với dân | Nhiều code hơn; hai nơi cấu hình canvas |
| Rủi ro lộ dữ liệu | Thấp nếu **lọc ở query** (đã có) + chặn live ping của người khác | Như A |

**Đề xuất: A trước, B sau nếu cần.** Cụ thể cho A:
- Citizen vào bản đồ thấy: nền NDAMapVN, **gió Windy, nhiệt độ, trục thời gian, dò bão, xem lại bão lịch sử, điểm sơ tán, SOS của mình, cảnh báo công bố (lớp mới, tùy chọn)**; không thấy chip "Sự cố/Nhiệm vụ/Đội" (rỗng → ẩn).
- Tín hiệu định vị realtime của người khác: **không hiển thị** cho citizen, trừ **SOS 1 chạm** (xem mục 5).
- Đổi tên mục sidebar công dân "Trang chủ & Bản đồ" → giữ, thêm mục "Bản đồ thời tiết" trỏ tới route bản đồ.

### 3.3 Điều gì vẫn KHÔNG được lộ cho dân
Sự cố nội bộ chưa công bố, nhiệm vụ, vị trí đội, vị trí người dùng khác (định vị thường), cảnh báo tác nghiệp. Cơ chế đảm bảo: lọc ở `createAuthorizedOperationalView` (đã có) + lọc live ping theo vai (cần thêm khi code).

---

## 4. Phát định vị có chọn người nhận (modal chọn vai / tìm username)

### 4.1 Hiện trạng
- Nút "Phát định vị" bật/tắt beacon: đẩy `LiveLocationPing {id, role, name, coords, isPanicSOS:false}` lên Redis/localStorage; **mọi ai mở Bản đồ tác nghiệp đều thấy** (không có khái niệm người nhận).
- Không có modal, không có lựa chọn phạm vi chia sẻ.

### 4.2 Yêu cầu của bạn (diễn giải lại để xác nhận)
Bấm "Phát định vị" → mở modal:
1. Chọn **vai trò nhận** (ô vuông chọn nhiều: Cán bộ PCTT / Đơn vị cứu hộ / Quản trị / Công dân), **và/hoặc**
2. Ô tìm kiếm **username / họ tên**; kết quả dạng ô vuông chọn nhiều; **mục vừa chọn nhảy lên đầu danh sách** và giữ trạng thái đã chọn (chip/checkbox), có thể bỏ chọn.
3. Xác nhận → bắt đầu phát; thanh nhanh hiển thị "Đang phát cho: 2 vai · 3 người".

### 4.3 Thiết kế dữ liệu đề xuất (không đổi backend)
- Thêm vào `LiveLocationPing`: `audience: { roles: UserRole[]; userIds: string[] } | "all"`.
- Phía đọc (`fetchLiveLocations` → canvas): lọc `ping.audience === "all" || roles∋myRole || userIds∋myId || ping.id === myId`.
- Lưu lựa chọn gần nhất vào localStorage (`vndms.beacon.audience`) để lần sau mở modal đã tick sẵn.
- **Mặc định** khi chưa chọn gì: gợi ý tick sẵn "Cán bộ PCTT + Đơn vị cứu hộ" (đúng mục đích định vị: để lực lượng tìm thấy mình). Không mặc định "Công dân".

### 4.4 UX modal (dùng pattern dialog sẵn có `incident-form-dialog`)
```
┌ Phát định vị cho ai? ─────────────────────────── × ┐
│ Vai trò                                             │
│ [✔ Cán bộ PCTT] [✔ Đơn vị cứu hộ] [  Quản trị] [  Công dân] │
│                                                     │
│ Người cụ thể (tìm theo tên đăng nhập hoặc họ tên)   │
│ [🔍 nguyen…                                    ]    │
│ ┌─────────────────────────────────────────────┐     │
│ │ ✔ nguyentrung · Nguyễn Quốc Trung · Cán bộ  │ ← đã chọn, ghim đầu │
│ │ ✔ phamhieu · Phạm Trung Hiếu · Đơn vị CH    │     │
│ │   trantuan · Trần Thái Tuấn · Công dân      │     │
│ │   …                                         │     │
│ └─────────────────────────────────────────────┘     │
│ Tần suất: mỗi 8 giây · dừng khi tắt hoặc đăng xuất  │
│                        [Hủy]  [Bắt đầu phát ▶]      │
└─────────────────────────────────────────────────────┘
```
- Ô "đã chọn ghim đầu": danh sách = `[...selected (theo thứ tự chọn)] + [...matched không selected]`.
- Nguồn danh sách người: `authGateway.listUsers()` (đã có, 7 tài khoản) — citizen có được thấy danh sách toàn bộ user không? → xem "cần chốt".
- Trên mobile modal full-height; chip vai xếp 2 cột.

### 4.5 Ràng buộc nghiệp vụ
- Phát định vị **thường** không tạo SOS, không ghi audit nghiệp vụ (chỉ audit bảo mật nếu bật/tắt).
- Không có GPS → không phát (giữ nguyên quy tắc V2).
- Người nhận không thể "bắt buộc" người khác phát — chỉ chiều chủ động.

---

## 5. Cảnh báo 1 chạm ≠ Phát định vị 1 chạm — SOS realtime thấy được bởi mọi người

### 5.1 Hiện trạng và chỗ chưa đúng
- Hai nút cạnh nhau trong `LiveTrackingQuickBar`; SOS 1 chạm = push ping `isPanicSOS:true` + tạo SOS canonical + tự bật beacon.
- Ping SOS chỉ hiển thị trên **Bản đồ tác nghiệp** → **công dân không thấy** (họ không vào được bản đồ đó); Cổng công dân không đọc live ping.
- Về hình thức, ping SOS chỉ khác ping thường ở màu marker.

### 5.2 Khác biệt cần có (bảng đối chiếu)

| | Phát định vị | Cảnh báo SOS 1 chạm |
| --- | --- | --- |
| Mục đích | "Tôi ở đây" cho người tôi chọn | "Tôi gặp nguy hiểm" cho **tất cả** |
| Người thấy | Theo `audience` (mục 4) | **Mọi người đăng nhập**, mọi vai, kể cả công dân; không lọc theo audience, **không lọc theo phạm vi địa lý** |
| Dữ liệu tạo | Chỉ live ping | Live ping `isPanicSOS` **+** SOS canonical (`ownerUserId`) + audit `PANIC_ALERT_TRIGGERED` |
| Vòng đời | Tắt khi người dùng tắt / đăng xuất / hết TTL 10 phút | Kéo dài tới khi cán bộ **xác minh hoặc đóng** SOS; TTL ping SOS dài hơn (ví dụ 60 phút, tự gia hạn khi còn beacon) |
| Hiển thị bản đồ | Chấm xanh nhỏ | Marker đỏ nhấp nháy, luôn trên cùng, có vòng lan; nhấn → thẻ có "Gọi", "Chỉ đường", (cán bộ) "Xác minh" |
| Hiển thị ngoài bản đồ | Không | **Dải đỏ toàn app** "Có N SOS khẩn cấp đang phát" (mọi vai) + mục trong Cổng công dân "SOS gần bạn" |
| Xác nhận trước khi gửi | Không | Giữ 1 chạm nhưng có **hoàn tác 5 giây** (đếm ngược) để tránh bấm nhầm; sau 5 s mới đẩy |
| Người khác được làm gì | Không | Công dân: xem, gọi, chỉ đường; Đơn vị: cập nhật hiện trường; Cán bộ: xác minh/điều đội/đóng |
| Tắt | Người phát tự tắt | Người phát **có thể** hủy trong 5 s; sau đó chỉ cán bộ đóng (hoặc người phát báo "an toàn" → SOS chuyển trạng thái chờ cán bộ đóng) |

### 5.3 Kênh realtime hiện có đủ không?
- Hiện dùng Upstash Redis REST (poll 8 s) + `window` event trong cùng tab + localStorage. **Không** có pub/sub thật, nên "realtime" = độ trễ ≤ 8 s giữa máy khác nhau. Chấp nhận được cho demo; ghi rõ trong UI "cập nhật mỗi 8 giây".
- Không đổi backend (theo ràng buộc). Nếu cần nhanh hơn: giảm chu kỳ poll riêng cho ping SOS xuống 3 s.

### 5.4 Quyền hiển thị SOS 1 chạm cho công dân — rủi ro và cách xử lý
- Rủi ro: lộ vị trí người gặp nạn cho người lạ. Cân bằng: đây là **hành vi chủ động** của người phát (như bật đèn khẩn), và mục tiêu là được cứu nhanh nhất — người gần nhất có thể là hàng xóm.
- Giảm rủi ro: công dân chỉ thấy **tên rút gọn + khoảng cách + nút gọi**, không thấy số điện thoại đầy đủ trừ khi người phát bật "cho phép liên hệ". Cán bộ/đơn vị thấy đầy đủ.

---

## 6. Tóm tắt đề xuất và các điểm cần bạn chốt trước khi code

| # | Đề xuất | Cần bạn chốt |
| --- | --- | --- |
| 2 | Gộp SOS + Phản ánh thành mục "Tiếp nhận" (2 tab); chuyển "Điểm sơ tán" ra khỏi nhóm Ứng phó; trang Cảnh báo dùng 2 tab thay vì 2 khối dọc | Đồng ý gộp SOS+Phản ánh? Điểm sơ tán đặt ở "Điều hành" hay gộp vào Bản đồ? |
| 3 | Mở Bản đồ tác nghiệp cho citizen (phương án A): lớp thời tiết đầy đủ, lớp nghiệp vụ tự rỗng, ẩn chip rỗng, không thấy định vị người khác | Chọn A (mở route hiện có) hay B (nhúng vào Cổng công dân)? Dân có được thấy lớp "Cảnh báo công bố" trên bản đồ không? |
| 4 | Modal chọn người nhận khi phát định vị: chip vai + tìm user, mục đã chọn ghim đầu; lưu lựa chọn; mặc định tick Cán bộ + Đơn vị | Công dân có được thấy **toàn bộ** danh sách người dùng để chọn không, hay chỉ vai nội bộ + người đã từng chọn? Có cho chọn "Tất cả" không? |
| 5 | SOS 1 chạm: hiển thị cho **mọi vai** (kể cả citizen) trên bản đồ + dải đỏ toàn app + mục "SOS gần bạn" ở Cổng công dân; hoàn tác 5 s; TTL dài hơn; chỉ cán bộ đóng | Đồng ý hoàn tác 5 s? Công dân thấy số điện thoại người phát hay chỉ nút "Gọi" khi người phát cho phép? Sau khi cán bộ đóng SOS thì marker biến mất ngay? |
| Chung | Bốn thay đổi trên **không** đổi backend/DB, không thêm dependency, dùng dialog/chip/CSS sẵn có | Thứ tự làm: đề xuất 5 → 3 → 4 → 2 (an toàn tính mạng trước, điều hướng sau) |
