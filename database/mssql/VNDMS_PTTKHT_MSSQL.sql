-- =============================================================================
-- HỆ THỐNG QUẢN LÝ VÀ ĐIỀU PHỐI PHÒNG CHỐNG THIÊN TAI (VNDMS)
-- MÔN HỌC: PHÂN TÍCH THIẾT KẾ HỆ THỐNG THÔNG TIN (PTTKHT)
-- HỆ QUẢN TRỊ CSDL: MICROSOFT SQL SERVER (T-SQL)
-- DATABASE: VNDMS_PTTKHT
-- =============================================================================
-- ĐẶC TẢ:
-- - Tên bảng: Tiếng Việt không dấu viết liền (PascalCase) khớp 100% Class Diagram
-- - Tên thuộc tính / cột: Tiếng Việt không dấu viết liền (camelCase) khớp 100% Class Diagram
-- - Ràng buộc khóa chính (PK) & khóa ngoại (FK) chuẩn hóa để SSMS tự động sinh Database Diagram
-- =============================================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'VNDMS_PTTKHT')
BEGIN
    CREATE DATABASE VNDMS_PTTKHT;
END
GO

USE VNDMS_PTTKHT;
GO

-- XÓA TẤT CẢ KHÓA NGOẠI CŨ ĐỂ CHẠY LẠI AN TOÀN
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + 
               N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(13)
FROM sys.foreign_keys;
EXEC sp_executesql @sql;
GO

-- XÓA CÁC BẢNG NẾU ĐÃ TỒN TẠI
DROP TABLE IF EXISTS dbo.ThongTinBanGiao;
DROP TABLE IF EXISTS dbo.BanGhiTrucBan;
DROP TABLE IF EXISTS dbo.BanGhiTuongTacCanhBao;
DROP TABLE IF EXISTS dbo.CanhBaoTacNghiep;
DROP TABLE IF EXISTS dbo.CanhBaoCongBo;
DROP TABLE IF EXISTS dbo.BanPhanAnhHienTruong;
DROP TABLE IF EXISTS dbo.YeuCauCuuNan;
DROP TABLE IF EXISTS dbo.HoSoPhanCong;
DROP TABLE IF EXISTS dbo.HoSoNghiemThuNhiemVu;
DROP TABLE IF EXISTS dbo.BanCapNhatHienTruong;
DROP TABLE IF EXISTS dbo.NhiemVuCuuHo;
DROP TABLE IF EXISTS dbo.ViTriDoi;
DROP TABLE IF EXISTS dbo.PhuongTienDoi;
DROP TABLE IF EXISTS dbo.ThanhVienDoi;
DROP TABLE IF EXISTS dbo.DoiCuuHo;
DROP TABLE IF EXISTS dbo.NguoiBiHan;
DROP TABLE IF EXISTS dbo.CoSoVatChat;
DROP TABLE IF EXISTS dbo.CanBoPhuTrach;
DROP TABLE IF EXISTS dbo.DiemSoTan;
DROP TABLE IF EXISTS dbo.SuKienSuCo;
DROP TABLE IF EXISTS dbo.SuCoThienTai;
DROP TABLE IF EXISTS dbo.NhatKyBaoMat;
DROP TABLE IF EXISTS dbo.PhienDangNhap;
DROP TABLE IF EXISTS dbo.ThongTinXacThuc;
DROP TABLE IF EXISTS dbo.NguoiDung;
DROP TABLE IF EXISTS dbo.PhamViDiaBan;
GO

-- =============================================================================
-- 1. BẢNG PhamViDiaBan (Phạm vi địa bàn quản lý)
-- =============================================================================
CREATE TABLE dbo.PhamViDiaBan (
    maPhamViDiaBan VARCHAR(50) NOT NULL CONSTRAINT PK_PhamViDiaBan PRIMARY KEY,
    cap NVARCHAR(50) NOT NULL, -- Toàn quốc, Tỉnh/TP, Quận/Huyện, Phường/Xã
    ten NVARCHAR(255) NOT NULL,
    ma NVARCHAR(50) NOT NULL
);
GO

-- =============================================================================
-- 2. BẢNG NguoiDung (Người dùng hệ thống)
-- =============================================================================
CREATE TABLE dbo.NguoiDung (
    maNguoiDung VARCHAR(50) NOT NULL CONSTRAINT PK_NguoiDung PRIMARY KEY,
    tenHienThi NVARCHAR(255) NOT NULL,
    tenDangNhap NVARCHAR(100) NOT NULL CONSTRAINT UQ_NguoiDung_tenDangNhap UNIQUE,
    vaiTro NVARCHAR(50) NOT NULL, -- admin, disaster_officer, rescue_unit, citizen
    maPhamViDiaBan VARCHAR(50) NULL,
    dangHoatDong BIT NOT NULL CONSTRAINT DF_NguoiDung_dangHoatDong DEFAULT 1,
    toChuc NVARCHAR(255) NULL,
    soDienThoai NVARCHAR(50) NULL,
    email NVARCHAR(255) NULL,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_NguoiDung_ngayTao DEFAULT SYSDATETIME(),
    ngayCapNhat DATETIME2 NOT NULL CONSTRAINT DF_NguoiDung_ngayCapNhat DEFAULT SYSDATETIME(),
    CONSTRAINT FK_NguoiDung_PhamViDiaBan FOREIGN KEY (maPhamViDiaBan) REFERENCES dbo.PhamViDiaBan(maPhamViDiaBan)
);
GO

-- =============================================================================
-- 3. BẢNG ThongTinXacThuc (Thông tin xác thực & mật khẩu băm)
-- =============================================================================
CREATE TABLE dbo.ThongTinXacThuc (
    maNguoiDung VARCHAR(50) NOT NULL CONSTRAINT PK_ThongTinXacThuc PRIMARY KEY,
    matKhauBam NVARCHAR(255) NOT NULL,
    ngayDoiMatKhau DATETIME2 NOT NULL CONSTRAINT DF_ThongTinXacThuc_ngayDoi DEFAULT SYSDATETIME(),
    CONSTRAINT FK_ThongTinXacThuc_NguoiDung FOREIGN KEY (maNguoiDung) REFERENCES dbo.NguoiDung(maNguoiDung) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 4. BẢNG PhienDangNhap (Phiên đăng nhập người dùng)
-- =============================================================================
CREATE TABLE dbo.PhienDangNhap (
    maPhien VARCHAR(100) NOT NULL CONSTRAINT PK_PhienDangNhap PRIMARY KEY,
    maNguoiDung VARCHAR(50) NOT NULL,
    token NVARCHAR(500) NOT NULL,
    thoiDiemPhat DATETIME2 NOT NULL CONSTRAINT DF_PhienDangNhap_thoiDiemPhat DEFAULT SYSDATETIME(),
    thoiDiemHetHan DATETIME2 NOT NULL,
    lanKiemTraGanNhat DATETIME2 NOT NULL CONSTRAINT DF_PhienDangNhap_lanKiemTra DEFAULT SYSDATETIME(),
    CONSTRAINT FK_PhienDangNhap_NguoiDung FOREIGN KEY (maNguoiDung) REFERENCES dbo.NguoiDung(maNguoiDung) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 5. BẢNG NhatKyBaoMat (Nhật ký kiểm tra an toàn & hành vi)
-- =============================================================================
CREATE TABLE dbo.NhatKyBaoMat (
    maSuKien BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NhatKyBaoMat PRIMARY KEY,
    hanhVi NVARCHAR(100) NOT NULL,
    maNguoiThucHien VARCHAR(50) NULL,
    vaiTro NVARCHAR(50) NULL,
    thoiDiem DATETIME2 NOT NULL CONSTRAINT DF_NhatKyBaoMat_thoiDiem DEFAULT SYSDATETIME(),
    loaiTaiNguyen NVARCHAR(100) NULL,
    maTaiNguyen NVARCHAR(100) NULL,
    phamViApDung NVARCHAR(255) NULL,
    ketQua NVARCHAR(50) NOT NULL, -- SUCCESS / FAILED / DENIED
    lyDo NVARCHAR(MAX) NULL,
    quyenLienQuan NVARCHAR(100) NULL,
    CONSTRAINT FK_NhatKyBaoMat_NguoiDung FOREIGN KEY (maNguoiThucHien) REFERENCES dbo.NguoiDung(maNguoiDung)
);
GO

-- =============================================================================
-- 6. BẢNG SuCoThienTai (Sự cố thiên tai)
-- =============================================================================
CREATE TABLE dbo.SuCoThienTai (
    maSuCo VARCHAR(50) NOT NULL CONSTRAINT PK_SuCoThienTai PRIMARY KEY,
    maSo NVARCHAR(50) NOT NULL CONSTRAINT UQ_SuCoThienTai_maSo UNIQUE,
    tieuDe NVARCHAR(255) NOT NULL,
    loaiSuCo NVARCHAR(100) NOT NULL, -- Ngập lụt, Sạt lở, Bão, Lũ quét...
    mucDo NVARCHAR(50) NOT NULL, -- Khẩn cấp, Nghiêm trọng, Cảnh báo...
    trangThai NVARCHAR(50) NOT NULL, -- Mới tiếp nhận, Đang xử lý, Đã khống chế, Đã đóng
    tenViTri NVARCHAR(255) NOT NULL,
    diaChi NVARCHAR(500) NOT NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    dienTichHectare FLOAT NOT NULL CONSTRAINT DF_SuCoThienTai_dienTich DEFAULT 0,
    soHoAnhHuong INT NOT NULL CONSTRAINT DF_SuCoThienTai_soHo DEFAULT 0,
    soNguoiAnhHuong INT NOT NULL CONSTRAINT DF_SuCoThienTai_soNguoi DEFAULT 0,
    soNguoiBiThuong INT NOT NULL CONSTRAINT DF_SuCoThienTai_soBiThuong DEFAULT 0,
    soNguoiSoTan INT NOT NULL CONSTRAINT DF_SuCoThienTai_soSoTan DEFAULT 0,
    nguoiChiHuy NVARCHAR(255) NULL,
    maDoiPhuTrach VARCHAR(50) NULL,
    moTa NVARCHAR(MAX) NULL,
    nguon NVARCHAR(100) NULL,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_SuCoThienTai_ngayTao DEFAULT SYSDATETIME(),
    ngayCapNhat DATETIME2 NOT NULL CONSTRAINT DF_SuCoThienTai_ngayCapNhat DEFAULT SYSDATETIME()
);
GO

-- =============================================================================
-- 7. BẢNG SuKienSuCo (Diễn biến chi tiết sự cố)
-- =============================================================================
CREATE TABLE dbo.SuKienSuCo (
    maSuKien VARCHAR(50) NOT NULL CONSTRAINT PK_SuKienSuCo PRIMARY KEY,
    maSuCo VARCHAR(50) NOT NULL,
    loaiSuKien NVARCHAR(100) NOT NULL,
    thongDiep NVARCHAR(MAX) NOT NULL,
    nguoiGhi NVARCHAR(255) NOT NULL,
    thoiGian DATETIME2 NOT NULL CONSTRAINT DF_SuKienSuCo_thoiGian DEFAULT SYSDATETIME(),
    nguon NVARCHAR(100) NULL,
    CONSTRAINT FK_SuKienSuCo_SuCoThienTai FOREIGN KEY (maSuCo) REFERENCES dbo.SuCoThienTai(maSuCo) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 8. BẢNG CanBoPhuTrach (Cán bộ phụ trách điểm sơ tán)
-- =============================================================================
CREATE TABLE dbo.CanBoPhuTrach (
    maCanBo VARCHAR(50) NOT NULL CONSTRAINT PK_CanBoPhuTrach PRIMARY KEY,
    ten NVARCHAR(255) NOT NULL,
    vaiTro NVARCHAR(100) NOT NULL,
    donVi NVARCHAR(255) NOT NULL,
    dienThoai NVARCHAR(50) NOT NULL
);
GO

-- =============================================================================
-- 9. BẢNG DiemSoTan (Điểm sơ tán nhân dân)
-- =============================================================================
CREATE TABLE dbo.DiemSoTan (
    maDiem VARCHAR(50) NOT NULL CONSTRAINT PK_DiemSoTan PRIMARY KEY,
    maSo NVARCHAR(50) NOT NULL CONSTRAINT UQ_DiemSoTan_maSo UNIQUE,
    tenDiem NVARCHAR(255) NOT NULL,
    loaiDiem NVARCHAR(100) NOT NULL, -- Nhà văn hóa, Trường học, Trụ sở...
    diaChi NVARCHAR(500) NOT NULL,
    phamViHanhChinh NVARCHAR(255) NOT NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    sucChua INT NOT NULL,
    soNguoiHienTai INT NOT NULL CONSTRAINT DF_DiemSoTan_soNguoiHienTai DEFAULT 0,
    trangThai NVARCHAR(50) NOT NULL,
    mucDoSanSang NVARCHAR(50) NOT NULL,
    khaNangTiepCan NVARCHAR(255) NULL,
    maCanBoPhuTrach VARCHAR(50) NULL,
    dienThoaiLienHe NVARCHAR(50) NULL,
    ghiChu NVARCHAR(MAX) NULL,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_DiemSoTan_ngayTao DEFAULT SYSDATETIME(),
    ngayCapNhat DATETIME2 NOT NULL CONSTRAINT DF_DiemSoTan_ngayCapNhat DEFAULT SYSDATETIME(),
    CONSTRAINT FK_DiemSoTan_CanBoPhuTrach FOREIGN KEY (maCanBoPhuTrach) REFERENCES dbo.CanBoPhuTrach(maCanBo)
);
GO

-- =============================================================================
-- 10. BẢNG CoSoVatChat (Cơ sở vật chất điểm sơ tán)
-- =============================================================================
CREATE TABLE dbo.CoSoVatChat (
    maCoSo VARCHAR(50) NOT NULL CONSTRAINT PK_CoSoVatChat PRIMARY KEY,
    maDiemSoTan VARCHAR(50) NOT NULL,
    ten NVARCHAR(255) NOT NULL,
    danhMuc NVARCHAR(100) NOT NULL, -- Nhu yếu phẩm, Y tế, Nước sạch...
    soLuong INT NOT NULL,
    donViTinh NVARCHAR(50) NOT NULL,
    trangThai NVARCHAR(100) NOT NULL,
    CONSTRAINT FK_CoSoVatChat_DiemSoTan FOREIGN KEY (maDiemSoTan) REFERENCES dbo.DiemSoTan(maDiem) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 11. BẢNG NguoiBiHan (Danh sách người dân tại điểm sơ tán)
-- =============================================================================
CREATE TABLE dbo.NguoiBiHan (
    maNguoiBiHan VARCHAR(50) NOT NULL CONSTRAINT PK_NguoiBiHan PRIMARY KEY,
    maDiemSoTan VARCHAR(50) NOT NULL,
    ten NVARCHAR(255) NOT NULL,
    tinhTrang NVARCHAR(100) NOT NULL,
    nhomDeBiTonThuong NVARCHAR(100) NULL, -- Người già, Trẻ em, Phụ nữ mang thai...
    CONSTRAINT FK_NguoiBiHan_DiemSoTan FOREIGN KEY (maDiemSoTan) REFERENCES dbo.DiemSoTan(maDiem) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 12. BẢNG DoiCuuHo (Đội cứu nạn cứu hộ)
-- =============================================================================
CREATE TABLE dbo.DoiCuuHo (
    maDoi VARCHAR(50) NOT NULL CONSTRAINT PK_DoiCuuHo PRIMARY KEY,
    maSo NVARCHAR(50) NOT NULL CONSTRAINT UQ_DoiCuuHo_maSo UNIQUE,
    tenDoi NVARCHAR(255) NOT NULL,
    loaiDoi NVARCHAR(100) NOT NULL,
    trangThai NVARCHAR(50) NOT NULL, -- Sẵn sàng, Đang làm nhiệm vụ, Nghỉ ca...
    doiTruong NVARCHAR(255) NOT NULL,
    soDienThoai NVARCHAR(50) NOT NULL,
    soThanhVien INT NOT NULL CONSTRAINT DF_DoiCuuHo_soThanhVien DEFAULT 0,
    danhSachNangLuc NVARCHAR(MAX) NULL,
    nangLucChinh NVARCHAR(MAX) NULL,
    maNhiemVuHienTai VARCHAR(50) NULL,
    maSuCoHienTai VARCHAR(50) NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    khuVuc NVARCHAR(255) NULL,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_DoiCuuHo_ngayTao DEFAULT SYSDATETIME(),
    ngayCapNhat DATETIME2 NOT NULL CONSTRAINT DF_DoiCuuHo_ngayCapNhat DEFAULT SYSDATETIME(),
    CONSTRAINT FK_DoiCuuHo_SuCoThienTai FOREIGN KEY (maSuCoHienTai) REFERENCES dbo.SuCoThienTai(maSuCo)
);
GO

-- Khóa ngoại ngược từ SuCoThienTai sang DoiCuuHo
ALTER TABLE dbo.SuCoThienTai
ADD CONSTRAINT FK_SuCoThienTai_DoiCuuHo FOREIGN KEY (maDoiPhuTrach) REFERENCES dbo.DoiCuuHo(maDoi);
GO

-- =============================================================================
-- 13. BẢNG ThanhVienDoi (Thành viên đội cứu hộ)
-- =============================================================================
CREATE TABLE dbo.ThanhVienDoi (
    maThanhVien VARCHAR(50) NOT NULL CONSTRAINT PK_ThanhVienDoi PRIMARY KEY,
    maDoi VARCHAR(50) NOT NULL,
    ten NVARCHAR(255) NOT NULL,
    vaiTroTrongDoi NVARCHAR(100) NOT NULL,
    nhiemVuDamNhan NVARCHAR(255) NULL,
    lienHe NVARCHAR(50) NULL,
    CONSTRAINT FK_ThanhVienDoi_DoiCuuHo FOREIGN KEY (maDoi) REFERENCES dbo.DoiCuuHo(maDoi) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 14. BẢNG PhuongTienDoi (Phương tiện trang thiết bị đội cứu hộ)
-- =============================================================================
CREATE TABLE dbo.PhuongTienDoi (
    maPhuongTien VARCHAR(50) NOT NULL CONSTRAINT PK_PhuongTienDoi PRIMARY KEY,
    maDoi VARCHAR(50) NOT NULL,
    ten NVARCHAR(255) NOT NULL,
    loai NVARCHAR(100) NOT NULL,
    bienSo NVARCHAR(50) NULL,
    trangThai NVARCHAR(50) NOT NULL,
    CONSTRAINT FK_PhuongTienDoi_DoiCuuHo FOREIGN KEY (maDoi) REFERENCES dbo.DoiCuuHo(maDoi) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 15. BẢNG ViTriDoi (Lịch sử định vị hiện trường - Telemetry GPS)
-- =============================================================================
CREATE TABLE dbo.ViTriDoi (
    maViTri BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ViTriDoi PRIMARY KEY,
    maDoi VARCHAR(50) NOT NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    doChinhXac FLOAT NULL,
    thoiGian DATETIME2 NOT NULL CONSTRAINT DF_ViTriDoi_thoiGian DEFAULT SYSDATETIME(),
    tocDo FLOAT NULL,
    huongDi FLOAT NULL,
    nguon NVARCHAR(100) NULL,
    trangThaiLienLac NVARCHAR(50) NULL,
    CONSTRAINT FK_ViTriDoi_DoiCuuHo FOREIGN KEY (maDoi) REFERENCES dbo.DoiCuuHo(maDoi) ON DELETE CASCADE
);
GO

-- =============================================================================
-- 16. BẢNG NhiemVuCuuHo (Nhiệm vụ cứu hộ cứu nạn)
-- =============================================================================
CREATE TABLE dbo.NhiemVuCuuHo (
    maNhiemVu VARCHAR(50) NOT NULL CONSTRAINT PK_NhiemVuCuuHo PRIMARY KEY,
    maSuCo VARCHAR(50) NOT NULL,
    tieuDe NVARCHAR(255) NOT NULL,
    loaiNhiemVu NVARCHAR(100) NOT NULL,
    mucDoUuTien NVARCHAR(50) NOT NULL,
    maDoi VARCHAR(50) NULL,
    doiTruong NVARCHAR(255) NULL,
    nguoiThucHien NVARCHAR(255) NULL,
    diaDiem NVARCHAR(500) NOT NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    hanHoanThanh DATETIME2 NULL,
    moTa NVARCHAR(MAX) NULL,
    trangThai NVARCHAR(50) NOT NULL, -- Chờ giao, Đang thực hiện, Chờ xác nhận, Hoàn thành, Đã hủy
    tienDo INT NOT NULL CONSTRAINT DF_NhiemVuCuuHo_tienDo DEFAULT 0,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_NhiemVuCuuHo_ngayTao DEFAULT SYSDATETIME(),
    thoiDiemHoanThanh DATETIME2 NULL,
    CONSTRAINT FK_NhiemVuCuuHo_SuCoThienTai FOREIGN KEY (maSuCo) REFERENCES dbo.SuCoThienTai(maSuCo),
    CONSTRAINT FK_NhiemVuCuuHo_DoiCuuHo FOREIGN KEY (maDoi) REFERENCES dbo.DoiCuuHo(maDoi)
);
GO

-- =============================================================================
-- 17. BẢNG BanCapNhatHienTruong (Bản cập nhật tiến độ hiện trường)
-- =============================================================================
CREATE TABLE dbo.BanCapNhatHienTruong (
    maCapNhat VARCHAR(50) NOT NULL CONSTRAINT PK_BanCapNhatHienTruong PRIMARY KEY,
    maNhiemVu VARCHAR(50) NOT NULL,
    maSuCo VARCHAR(50) NOT NULL,
    maDoi VARCHAR(50) NULL,
    thoiGian DATETIME2 NOT NULL CONSTRAINT DF_BanCapNhatHienTruong_thoiGian DEFAULT SYSDATETIME(),
    nguoiThucHien NVARCHAR(255) NOT NULL,
    noiDung NVARCHAR(MAX) NOT NULL,
    diaDiem NVARCHAR(500) NULL,
    nguon NVARCHAR(100) NULL,
    trangThaiDongBo NVARCHAR(50) NULL,
    CONSTRAINT FK_BanCapNhatHienTruong_NhiemVuCuuHo FOREIGN KEY (maNhiemVu) REFERENCES dbo.NhiemVuCuuHo(maNhiemVu) ON DELETE CASCADE,
    CONSTRAINT FK_BanCapNhatHienTruong_SuCoThienTai FOREIGN KEY (maSuCo) REFERENCES dbo.SuCoThienTai(maSuCo),
    CONSTRAINT FK_BanCapNhatHienTruong_DoiCuuHo FOREIGN KEY (maDoi) REFERENCES dbo.DoiCuuHo(maDoi)
);
GO

-- =============================================================================
-- 18. BẢNG HoSoNghiemThuNhiemVu (Hồ sơ nghiệm thu & duyệt kết quả nhiệm vụ)
-- =============================================================================
CREATE TABLE dbo.HoSoNghiemThuNhiemVu (
    maHoSo VARCHAR(50) NOT NULL CONSTRAINT PK_HoSoNghiemThuNhiemVu PRIMARY KEY,
    maNhiemVu VARCHAR(50) NOT NULL,
    maSuCo VARCHAR(50) NOT NULL,
    nguoiBaoCao NVARCHAR(255) NOT NULL,
    thoiDiemBaoCao DATETIME2 NOT NULL CONSTRAINT DF_HoSoNghiemThu_thoiDiemBaoCao DEFAULT SYSDATETIME(),
    ghiChuBaoCao NVARCHAR(MAX) NULL,
    quyetDinh NVARCHAR(50) NOT NULL, -- Chờ xác nhận, Chấp nhận, Từ chối
    nguoiDuyet NVARCHAR(255) NULL,
    thoiDiemDuyet DATETIME2 NULL,
    ghiChuDuyet NVARCHAR(MAX) NULL,
    CONSTRAINT FK_HoSoNghiemThu_NhiemVuCuuHo FOREIGN KEY (maNhiemVu) REFERENCES dbo.NhiemVuCuuHo(maNhiemVu) ON DELETE CASCADE,
    CONSTRAINT FK_HoSoNghiemThu_SuCoThienTai FOREIGN KEY (maSuCo) REFERENCES dbo.SuCoThienTai(maSuCo)
);
GO

-- =============================================================================
-- 19. BẢNG HoSoPhanCong (Lịch sử bàn giao / phân công lại nhiệm vụ)
-- =============================================================================
CREATE TABLE dbo.HoSoPhanCong (
    maPhanCong VARCHAR(50) NOT NULL CONSTRAINT PK_HoSoPhanCong PRIMARY KEY,
    maNhiemVu VARCHAR(50) NOT NULL,
    thoiGian DATETIME2 NOT NULL CONSTRAINT DF_HoSoPhanCong_thoiGian DEFAULT SYSDATETIME(),
    tuDoiId VARCHAR(50) NULL,
    denDoiId VARCHAR(50) NOT NULL,
    nguoiGiao NVARCHAR(255) NOT NULL,
    lyDo NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_HoSoPhanCong_NhiemVuCuuHo FOREIGN KEY (maNhiemVu) REFERENCES dbo.NhiemVuCuuHo(maNhiemVu) ON DELETE CASCADE,
    CONSTRAINT FK_HoSoPhanCong_TuDoi FOREIGN KEY (tuDoiId) REFERENCES dbo.DoiCuuHo(maDoi),
    CONSTRAINT FK_HoSoPhanCong_DenDoi FOREIGN KEY (denDoiId) REFERENCES dbo.DoiCuuHo(maDoi)
);
GO

-- =============================================================================
-- 20. BẢNG YeuCauCuuNan (Yêu cầu cứu nạn SOS từ nhân dân)
-- =============================================================================
CREATE TABLE dbo.YeuCauCuuNan (
    maYeuCau VARCHAR(50) NOT NULL CONSTRAINT PK_YeuCauCuuNan PRIMARY KEY,
    maSo NVARCHAR(50) NOT NULL CONSTRAINT UQ_YeuCauCuuNan_maSo UNIQUE,
    maNguoiDung VARCHAR(50) NULL,
    tenNguoiBao NVARCHAR(255) NOT NULL,
    soDienThoai NVARCHAR(50) NOT NULL,
    nguonGoi NVARCHAR(100) NULL, -- App, 112, Trực tiếp...
    coGPS BIT NOT NULL CONSTRAINT DF_YeuCauCuuNan_coGPS DEFAULT 0,
    moTa NVARCHAR(MAX) NOT NULL,
    diaChi NVARCHAR(500) NOT NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    soNguoiGapNguyHiem INT NOT NULL CONSTRAINT DF_YeuCauCuuNan_soNguoi DEFAULT 1,
    soNguoiBiThuong INT NOT NULL CONSTRAINT DF_YeuCauCuuNan_soBiThuong DEFAULT 0,
    soNguoiMatTich INT NOT NULL CONSTRAINT DF_YeuCauCuuNan_soMatTich DEFAULT 0,
    soTreEm INT NOT NULL CONSTRAINT DF_YeuCauCuuNan_soTreEm DEFAULT 0,
    soNguoiCaoTuoi INT NOT NULL CONSTRAINT DF_YeuCauCuuNan_soCaoTuoi DEFAULT 0,
    soNguoiKhuyetTat INT NOT NULL CONSTRAINT DF_YeuCauCuuNan_soKhuyetTat DEFAULT 0,
    mucDoNghiemTrong NVARCHAR(50) NOT NULL,
    mucDoUuTien NVARCHAR(50) NOT NULL,
    trangThai NVARCHAR(50) NOT NULL, -- Mới tiếp nhận, Đang điều phối, Đã xử lý, Đã hủy
    trangThaiXacMinh NVARCHAR(50) NOT NULL,
    trangThaiLienLac NVARCHAR(50) NULL,
    maSuCoLienKet VARCHAR(50) NULL,
    maDoiDuocGan VARCHAR(50) NULL,
    maNhiemVuLienKet VARCHAR(50) NULL,
    maDiemSoTanDen VARCHAR(50) NULL,
    thoiDiemGui DATETIME2 NOT NULL CONSTRAINT DF_YeuCauCuuNan_thoiDiemGui DEFAULT SYSDATETIME(),
    tomTatXuLy NVARCHAR(MAX) NULL,
    thoiDiemDong DATETIME2 NULL,
    CONSTRAINT FK_YeuCauCuuNan_NguoiDung FOREIGN KEY (maNguoiDung) REFERENCES dbo.NguoiDung(maNguoiDung),
    CONSTRAINT FK_YeuCauCuuNan_SuCoThienTai FOREIGN KEY (maSuCoLienKet) REFERENCES dbo.SuCoThienTai(maSuCo),
    CONSTRAINT FK_YeuCauCuuNan_DoiCuuHo FOREIGN KEY (maDoiDuocGan) REFERENCES dbo.DoiCuuHo(maDoi),
    CONSTRAINT FK_YeuCauCuuNan_NhiemVuCuuHo FOREIGN KEY (maNhiemVuLienKet) REFERENCES dbo.NhiemVuCuuHo(maNhiemVu),
    CONSTRAINT FK_YeuCauCuuNan_DiemSoTan FOREIGN KEY (maDiemSoTanDen) REFERENCES dbo.DiemSoTan(maDiem)
);
GO

-- =============================================================================
-- 21. BẢNG BanPhanAnhHienTruong (Phản ánh hiện trường của công dân)
-- =============================================================================
CREATE TABLE dbo.BanPhanAnhHienTruong (
    maPhanAnh VARCHAR(50) NOT NULL CONSTRAINT PK_BanPhanAnhHienTruong PRIMARY KEY,
    maSo NVARCHAR(50) NOT NULL CONSTRAINT UQ_BanPhanAnhHienTruong_maSo UNIQUE,
    maNguoiDung VARCHAR(50) NULL,
    tenNguoiBao NVARCHAR(255) NOT NULL,
    soDienThoai NVARCHAR(50) NOT NULL,
    danhMuc NVARCHAR(100) NOT NULL, -- Ngập lụt, Sạt lở, Thiệt hại tài sản...
    moTa NVARCHAR(MAX) NOT NULL,
    diaChi NVARCHAR(500) NOT NULL,
    phamViHanhChinh NVARCHAR(255) NOT NULL,
    kinhDo FLOAT NOT NULL,
    viDo FLOAT NOT NULL,
    trangThai NVARCHAR(50) NOT NULL, -- Mới, Hợp lệ, Không hợp lệ, Đã xử lý
    ghiChuDanhGia NVARCHAR(MAX) NULL,
    nguoiDanhGia NVARCHAR(255) NULL,
    thoiDiemDanhGia DATETIME2 NULL,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_BanPhanAnh_ngayTao DEFAULT SYSDATETIME(),
    ngayCapNhat DATETIME2 NOT NULL CONSTRAINT DF_BanPhanAnh_ngayCapNhat DEFAULT SYSDATETIME(),
    CONSTRAINT FK_BanPhanAnh_NguoiDung FOREIGN KEY (maNguoiDung) REFERENCES dbo.NguoiDung(maNguoiDung)
);
GO

-- =============================================================================
-- 22. BẢNG CanhBaoCongBo (Bản tin cảnh báo thiên tai công bố ra công chúng)
-- =============================================================================
CREATE TABLE dbo.CanhBaoCongBo (
    maCanhBao VARCHAR(50) NOT NULL CONSTRAINT PK_CanhBaoCongBo PRIMARY KEY,
    maSo NVARCHAR(50) NOT NULL CONSTRAINT UQ_CanhBaoCongBo_maSo UNIQUE,
    tieuDe NVARCHAR(255) NOT NULL,
    noiDung NVARCHAR(MAX) NOT NULL,
    mucDo NVARCHAR(50) NOT NULL, -- Tin báo, Cảnh báo, Khẩn cấp
    tenKhuVuc NVARCHAR(255) NOT NULL,
    trangThai NVARCHAR(50) NOT NULL, -- Nháp, Đã công bố, Đã thu hồi
    lanSuaDoi INT NOT NULL CONSTRAINT DF_CanhBaoCongBo_lanSuaDoi DEFAULT 1,
    nguoiTao NVARCHAR(255) NOT NULL,
    ngayTao DATETIME2 NOT NULL CONSTRAINT DF_CanhBaoCongBo_ngayTao DEFAULT SYSDATETIME(),
    thoiDiemCongBo DATETIME2 NULL,
    ngayCapNhat DATETIME2 NOT NULL CONSTRAINT DF_CanhBaoCongBo_ngayCapNhat DEFAULT SYSDATETIME()
);
GO

-- =============================================================================
-- 23. BẢNG CanhBaoTacNghiep (Cảnh báo tác nghiệp thời gian thực)
-- =============================================================================
CREATE TABLE dbo.CanhBaoTacNghiep (
    maCanhBaoTacNghiep VARCHAR(50) NOT NULL CONSTRAINT PK_CanhBaoTacNghiep PRIMARY KEY,
    khoaCanhBao NVARCHAR(100) NOT NULL,
    danhMucCanhBao NVARCHAR(100) NOT NULL,
    dieuKienCanhBao NVARCHAR(255) NOT NULL,
    mucDo NVARCHAR(50) NOT NULL,
    tieuDe NVARCHAR(255) NOT NULL,
    thongDiep NVARCHAR(MAX) NOT NULL,
    phamViApDung NVARCHAR(255) NOT NULL,
    trangThai NVARCHAR(50) NOT NULL, -- Mới phát hiện, Đang theo dõi, Đã đóng
    thoiDiemPhatHien DATETIME2 NOT NULL CONSTRAINT DF_CanhBaoTacNghiep_thoiDiem DEFAULT SYSDATETIME()
);
GO

-- =============================================================================
-- 24. BẢNG BanGhiTuongTacCanhBao (Ghi nhận xác nhận cảnh báo tác nghiệp)
-- =============================================================================
CREATE TABLE dbo.BanGhiTuongTacCanhBao (
    maTuongTac BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BanGhiTuongTacCanhBao PRIMARY KEY,
    maCanhBaoTacNghiep VARCHAR(50) NOT NULL,
    maNguoiDung VARCHAR(50) NOT NULL,
    thoiDiemXacNhan DATETIME2 NOT NULL CONSTRAINT DF_BanGhiTuongTac_thoiDiem DEFAULT SYSDATETIME(),
    daXacNhan BIT NOT NULL CONSTRAINT DF_BanGhiTuongTac_daXacNhan DEFAULT 1,
    tomTatXuLy NVARCHAR(MAX) NULL,
    CONSTRAINT FK_TuongTac_CanhBaoTacNghiep FOREIGN KEY (maCanhBaoTacNghiep) REFERENCES dbo.CanhBaoTacNghiep(maCanhBaoTacNghiep) ON DELETE CASCADE,
    CONSTRAINT FK_TuongTac_NguoiDung FOREIGN KEY (maNguoiDung) REFERENCES dbo.NguoiDung(maNguoiDung)
);
GO

-- =============================================================================
-- 25. BẢNG BanGhiTrucBan (Nhật ký sổ trực ban phòng chỉ huy)
-- =============================================================================
CREATE TABLE dbo.BanGhiTrucBan (
    maBanGhi VARCHAR(50) NOT NULL CONSTRAINT PK_BanGhiTrucBan PRIMARY KEY,
    thoiDiem DATETIME2 NOT NULL CONSTRAINT DF_BanGhiTrucBan_thoiDiem DEFAULT SYSDATETIME(),
    nguoiGhi NVARCHAR(255) NOT NULL,
    vaiTroNguoiGhi NVARCHAR(100) NOT NULL,
    maNguoiGhi VARCHAR(50) NULL,
    loaiBanGhiTrucBan NVARCHAR(50) NOT NULL, -- Ghi nhận, Chỉ đạo, Bàn giao ca
    noiDung NVARCHAR(MAX) NOT NULL,
    trangThaiChiDao NVARCHAR(50) NULL, -- open / done
    maNhiemVu VARCHAR(50) NULL,
    maSuCo VARCHAR(50) NULL,
    theoDoiCaSau BIT NOT NULL CONSTRAINT DF_BanGhiTrucBan_theoDoiCaSau DEFAULT 0,
    CONSTRAINT FK_BanGhiTrucBan_NguoiDung FOREIGN KEY (maNguoiGhi) REFERENCES dbo.NguoiDung(maNguoiDung),
    CONSTRAINT FK_BanGhiTrucBan_NhiemVuCuuHo FOREIGN KEY (maNhiemVu) REFERENCES dbo.NhiemVuCuuHo(maNhiemVu),
    CONSTRAINT FK_BanGhiTrucBan_SuCoThienTai FOREIGN KEY (maSuCo) REFERENCES dbo.SuCoThienTai(maSuCo)
);
GO

-- =============================================================================
-- 26. BẢNG ThongTinBanGiao (Thông tin ký nhận bàn giao ca trực)
-- =============================================================================
CREATE TABLE dbo.ThongTinBanGiao (
    maBanGiao VARCHAR(50) NOT NULL CONSTRAINT PK_ThongTinBanGiao PRIMARY KEY,
    maBanGhi VARCHAR(50) NOT NULL,
    nguoiNhanCa NVARCHAR(255) NOT NULL,
    congViecTonDong NVARCHAR(MAX) NOT NULL,
    nguoiKyNhan NVARCHAR(255) NULL,
    thoiDiemKy DATETIME2 NULL,
    CONSTRAINT FK_ThongTinBanGiao_BanGhiTrucBan FOREIGN KEY (maBanGhi) REFERENCES dbo.BanGhiTrucBan(maBanGhi) ON DELETE CASCADE
);
GO

-- =============================================================================
-- NẠP DỮ LIỆU MẪU TIẾNG VIỆT CHUẨN XÁC ĐỂ TRÌNH BÀY BÁO CÁO PTTKHT
-- =============================================================================

-- 1. Phạm vi địa bàn
INSERT INTO dbo.PhamViDiaBan (maPhamViDiaBan, cap, ten, ma)
VALUES
('DB-VN', N'Toàn quốc', N'Toàn quốc Việt Nam', 'VN'),
('DB-HN', N'Tỉnh/TP', N'Thành phố Hà Nội', 'HN'),
('DB-CG', N'Quận/Huyện', N'Quận Cầu Giấy', 'CG'),
('DB-YH', N'Phường/Xã', N'Phường Yên Hòa', 'YH');

-- 2. Người dùng
INSERT INTO dbo.NguoiDung (maNguoiDung, tenHienThi, tenDangNhap, vaiTro, maPhamViDiaBan, dangHoatDong, toChuc, soDienThoai, email)
VALUES
('ND-01', N'Trần Văn Dũng', 'chihuy_hanoi', 'disaster_officer', 'DB-HN', 1, N'Ban Chỉ huy PCTT Hà Nội', '0912345678', 'chihuy_hn@vndms.gov.vn'),
('ND-02', N'Nguyễn Minh An', 'cuuho_caugiay', 'rescue_unit', 'DB-CG', 1, N'Đội PCCC & CNCH Cầu Giấy', '0923456789', 'cuuho_cg@vndms.gov.vn'),
('ND-03', N'Quản trị viên Hệ thống', 'admin', 'admin', 'DB-VN', 1, N'Cục Quản lý Đê điều và PCTT', '0901234567', 'admin@vndms.gov.vn'),
('ND-04', N'Nguyễn Văn A', 'nguyenvana', 'citizen', 'DB-YH', 1, N'Người dân Yên Hòa', '0934567890', 'vana@gmail.com');

-- 3. Thông tin xác thực
INSERT INTO dbo.ThongTinXacThuc (maNguoiDung, matKhauBam)
VALUES
('ND-01', N'$2a$12$e8YgN1k9J8hK9X0w1Q2r3e4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9'),
('ND-02', N'$2a$12$e8YgN1k9J8hK9X0w1Q2r3e4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9'),
('ND-03', N'$2a$12$e8YgN1k9J8hK9X0w1Q2r3e4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9'),
('ND-04', N'$2a$12$e8YgN1k9J8hK9X0w1Q2r3e4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9');

-- 4. Sự cố thiên tai
INSERT INTO dbo.SuCoThienTai (maSuCo, maSo, tieuDe, loaiSuCo, mucDo, trangThai, tenViTri, diaChi, kinhDo, viDo, dienTichHectare, soHoAnhHuong, soNguoiAnhHuong, soNguoiBiThuong, soNguoiSoTan, nguoiChiHuy, moTa, nguon)
VALUES
('SC-01', 'STG-INC-20261012-01', N'Ngập úng đô thị nghiêm trọng do mưa lớn kéo dài', N'Ngập lụt', N'Khẩn cấp', N'Đang xử lý', N'Khu đô thị Yên Hòa', N'Đường Dương Đình Nghệ, Cầu Giấy, Hà Nội', 105.7918, 21.0292, 15.5, 120, 450, 2, 85, N'Trần Văn Dũng', N'Nước dâng nhanh 0.8m ngập cục bộ tại khu vực trũng thấp, ảnh hưởng giao thông và người dân.', N'Trung tâm chỉ huy');

-- 5. Diễn biến sự cố
INSERT INTO dbo.SuKienSuCo (maSuKien, maSuCo, loaiSuKien, thongDiep, nguoiGhi, nguon)
VALUES
('SK-01', 'SC-01', N'Phát hiện sự cố', N'Mưa to kéo dài làm nước tràn vào tầng một các khu nhà trũng thấp.', N'Trần Văn Dũng', N'Cảm biến ngập lụt'),
('SK-02', 'SC-01', N'Điều phối lực lượng', N'Điều động Đội phản ứng nhanh tiếp cận hiện trường hỗ trợ người già và trẻ nhỏ sơ tán.', N'Trần Văn Dũng', N'Trung tâm chỉ huy');

-- 6. Cán bộ phụ trách
INSERT INTO dbo.CanBoPhuTrach (maCanBo, ten, vaiTro, donVi, dienThoai)
VALUES
('CB-01', N'Lê Thị Mai', N'Trưởng điểm sơ tán', N'UBND Phường Yên Hòa', '0903456789');

-- 7. Điểm sơ tán
INSERT INTO dbo.DiemSoTan (maDiem, maSo, tenDiem, loaiDiem, diaChi, phamViHanhChinh, kinhDo, viDo, sucChua, soNguoiHienTai, trangThai, mucDoSanSang, khaNangTiepCan, maCanBoPhuTrach, dienThoaiLienHe, ghiChu)
VALUES
('ST-01', 'STG-SHT-20261012-01', N'Nhà văn hóa phường Yên Hòa', N'Nhà văn hóa', N'Số 12 phố Hạ Yên Quyết, Cầu Giấy, Hà Nội', N'Phường Yên Hòa, Cầu Giấy, Hà Nội', 105.7925, 21.0287, 200, 48, N'Sẵn sàng', N'Sẵn sàng đón người', N'Đường ô tô cứu trợ tiếp cận tốt', 'CB-01', '0243123456', N'Đã chuẩn bị 100 chăn màn và nước sạch dự phòng.');

-- 8. Cơ sở vật chất
INSERT INTO dbo.CoSoVatChat (maCoSo, maDiemSoTan, ten, danhMuc, soLuong, donViTinh, trangThai)
VALUES
('CS-01', 'ST-01', N'Chăn màn ấm', N'Nhu yếu phẩm', 120, N'Bộ', N'Đầy đủ'),
('CS-02', 'ST-01', N'Nước uống đóng chai', N'Thực phẩm', 500, N'Thùng', N'Đầy đủ');

-- 9. Người bị nạn
INSERT INTO dbo.NguoiBiHan (maNguoiBiHan, maDiemSoTan, ten, tinhTrang, nhomDeBiTonThuong)
VALUES
('BH-01', 'ST-01', N'Bà Phạm Thị Lan', N'Sức khỏe ổn định', N'Người cao tuổi'),
('BH-02', 'ST-01', N'Cháu Trần Gia Huy', N'Sức khỏe tốt', N'Trẻ em');

-- 10. Đội cứu hộ
INSERT INTO dbo.DoiCuuHo (maDoi, maSo, tenDoi, loaiDoi, trangThai, doiTruong, soDienThoai, soThanhVien, danhSachNangLuc, nangLucChinh, maSuCoHienTai, kinhDo, viDo, khuVuc)
VALUES
('DOI-01', 'STG-TEAM-20261012-01', N'Đội cứu nạn phản ứng nhanh Cầu Giấy', N'Lực lượng cứu hộ địa phương', N'Đang làm nhiệm vụ', N'Nguyễn Minh An', '0923456789', 12, N'Xuồng cao su, phao cứu sinh, máy bơm nước', N'Sơ tán ngập lụt, cứu nạn trên nước', 'SC-01', 105.7915, 21.0295, N'Quận Cầu Giấy');

-- Cập nhật đội phụ trách sự cố
UPDATE dbo.SuCoThienTai SET maDoiPhuTrach = 'DOI-01' WHERE maSuCo = 'SC-01';

-- 11. Thành viên đội
INSERT INTO dbo.ThanhVienDoi (maThanhVien, maDoi, ten, vaiTroTrongDoi, nhiemVuDamNhan, lienHe)
VALUES
('TV-01', 'DOI-01', N'Nguyễn Minh An', N'Đội trưởng', N'Chỉ huy hiện trường', '0923456789'),
('TV-02', 'DOI-01', N'Hoàng Đức Long', N'Cứu hộ viên', N'Lái xuồng máy', '0923456790');

-- 12. Phương tiện đội
INSERT INTO dbo.PhuongTienDoi (maPhuongTien, maDoi, ten, loai, bienSo, trangThai)
VALUES
('PT-01', 'DOI-01', N'Xuồng máy cứu hộ Zodiac', N'Xuồng cao su động cơ', N'X-29-01', N'Hoạt động tốt'),
('PT-02', 'DOI-01', N'Xe chuyên dụng cứu nạn bán tải', N'Xe ô tô địa hình', N'29A-999.88', N'Hoạt động tốt');

-- 13. Vị trí đội (Telemetry GPS)
INSERT INTO dbo.ViTriDoi (maDoi, kinhDo, viDo, doChinhXac, tocDo, huongDi, nguon, trangThaiLienLac)
VALUES
('DOI-01', 105.7918, 21.0292, 2.5, 12.5, 45.0, N'GPS Thiết bị', N'Tốt'),
('DOI-01', 105.7915, 21.0295, 1.8, 10.0, 60.0, N'GPS Thiết bị', N'Tốt');

-- 14. Nhiệm vụ cứu hộ
INSERT INTO dbo.NhiemVuCuuHo (maNhiemVu, maSuCo, tieuDe, loaiNhiemVu, mucDoUuTien, maDoi, doiTruong, nguoiThucHien, diaDiem, kinhDo, viDo, hanHoanThanh, moTa, trangThai, tienDo)
VALUES
('NV-01', 'SC-01', N'Khảo sát và hỗ trợ sơ tán tuyến phố Dương Đình Nghệ', N'Khảo sát hiện trường', N'Khẩn cấp', 'DOI-01', N'Nguyễn Minh An', N'Đội cứu nạn phản ứng nhanh Cầu Giấy', N'Phường Yên Hòa, Cầu Giấy, Hà Nội', 105.7920, 21.0291, DATEADD(HOUR, 4, SYSDATETIME()), N'Khảo sát mức độ ngập lụt, đưa các hộ dân vùng trũng đến Nhà văn hóa.', N'Đang thực hiện', 60);

-- Cập nhật nhiệm vụ cho đội
UPDATE dbo.DoiCuuHo SET maNhiemVuHienTai = 'NV-01' WHERE maDoi = 'DOI-01';

-- 15. Bản cập nhật hiện trường
INSERT INTO dbo.BanCapNhatHienTruong (maCapNhat, maNhiemVu, maSuCo, maDoi, nguoiThucHien, noiDung, diaDiem, nguon, trangThaiDongBo)
VALUES
('CN-01', 'NV-01', 'SC-01', 'DOI-01', N'Nguyễn Minh An', N'Đã khảo sát xong đợt 1, tiếp cận và đưa an toàn 12 hộ gia đình sang điểm sơ tán Nhà văn hóa.', N'Đường Dương Đình Nghệ', N'App hiện trường', N'Đã đồng bộ');

-- 16. Hồ sơ nghiệm thu nhiệm vụ
INSERT INTO dbo.HoSoNghiemThuNhiemVu (maHoSo, maNhiemVu, maSuCo, nguoiBaoCao, ghiChuBaoCao, quyetDinh, nguoiDuyet)
VALUES
('NT-01', 'NV-01', 'SC-01', N'Nguyễn Minh An', N'Báo cáo sơ tán hoàn tất đợt 1, tiếp tục theo dõi diễn biến đợt 2.', N'Chờ xác nhận', N'Trần Văn Dũng');

-- 17. Hồ sơ phân công
INSERT INTO dbo.HoSoPhanCong (maPhanCong, maNhiemVu, tuDoiId, denDoiId, nguoiGiao, lyDo)
VALUES
('PC-01', 'NV-01', NULL, 'DOI-01', N'Trần Văn Dũng', N'Giao đội phản ứng nhanh phụ trách khu vực Yên Hòa.');

-- 18. Yêu cầu cứu nạn SOS
INSERT INTO dbo.YeuCauCuuNan (maYeuCau, maSo, maNguoiDung, tenNguoiBao, soDienThoai, nguonGoi, coGPS, moTa, diaChi, kinhDo, viDo, soNguoiGapNguyHiem, soNguoiBiThuong, soNguoiMatTich, soTreEm, soNguoiCaoTuoi, soNguoiKhuyetTat, mucDoNghiemTrong, mucDoUuTien, trangThai, trangThaiXacMinh, trangThaiLienLac, maSuCoLienKet, maDoiDuocGan, maNhiemVuLienKet, maDiemSoTanDen, tomTatXuLy)
VALUES
('SOS-01', 'STG-SOS-20261012-01', 'ND-04', N'Bà Phạm Thị Lan', '0987654321', N'App VNDMS', 1, N'Nước tràn vào nhà ngập 0.8m, có người già khó đi lại cần hỗ trợ đưa đi sơ tán gấp.', N'Ngõ 148 Dương Đình Nghệ, Yên Hòa, Hà Nội', 105.7910, 21.0298, 3, 0, 0, 1, 1, 0, N'Nghiêm trọng', N'P1 — Khẩn cấp', N'Đang điều phối', N'Đã xác minh', N'Đã liên lạc qua điện thoại', 'SC-01', 'DOI-01', 'NV-01', 'ST-01', N'Đội cứu hộ đang trên xuồng tiếp cận nhà dân.');

-- 19. Bản phản ánh hiện trường
INSERT INTO dbo.BanPhanAnhHienTruong (maPhanAnh, maSo, maNguoiDung, tenNguoiBao, soDienThoai, danhMuc, moTa, diaChi, phamViHanhChinh, kinhDo, viDo, trangThai, ghiChuDanhGia, nguoiDanhGia, thoiDiemDanhGia)
VALUES
('PA-01', 'STG-REP-20261012-01', 'ND-04', N'Nguyễn Văn A', '0934567890', N'Ngập lụt', N'Nước tràn vào tầng hầm tòa chung cư, cống thoát nước bị nghẽn rác.', N'Tòa nhà E2, Phố Dương Đình Nghệ, Hà Nội', N'Phường Yên Hòa, Cầu Giấy, Hà Nội', 105.7914, 21.0294, N'Hợp lệ', N'Đã tiếp nhận và giao Đội phản ứng nhanh kiểm tra xử lý.', N'Trần Văn Dũng', SYSDATETIME());

-- 20. Cảnh báo công bố
INSERT INTO dbo.CanhBaoCongBo (maCanhBao, maSo, tieuDe, noiDung, mucDo, tenKhuVuc, trangThai, lanSuaDoi, nguoiTao, thoiDiemCongBo)
VALUES
('CB-01', 'STG-ALT-20261012-01', N'Cảnh báo ngập úng cục bộ và mưa lớn diện rộng khu vực Yên Hòa', N'Người dân hạn chế di chuyển qua các tuyến đường trũng thấp, chủ động kê cao tài sản và liên hệ Nhà văn hóa sơ tán khi cần thiết.', N'Cảnh báo', N'Phường Yên Hòa, Cầu Giấy, Hà Nội', N'Đã công bố', 1, N'Ban Chỉ huy PCTT Hà Nội', SYSDATETIME());

-- 21. Cảnh báo tác nghiệp
INSERT INTO dbo.CanhBaoTacNghiep (maCanhBaoTacNghiep, khoaCanhBao, danhMucCanhBao, dieuKienCanhBao, mucDo, tieuDe, thongDiep, phamViApDung, trangThai)
VALUES
('CBTN-01', 'ALERT-WATER-RISE-YH', N'Mực nước dâng', N'Mực nước vượt ngưỡng 0.7m tại Yên Hòa', N'Khẩn cấp', N'Báo động ngập úng diện rộng', N'Mực nước tại ngõ 148 Dương Đình Nghệ đang dâng 10cm/giờ.', N'Phường Yên Hòa', N'Mới phát hiện');

-- 22. Tương tác cảnh báo
INSERT INTO dbo.BanGhiTuongTacCanhBao (maCanhBaoTacNghiep, maNguoiDung, daXacNhan, tomTatXuLy)
VALUES
('CBTN-01', 'ND-01', 1, N'Cán bộ chỉ huy đã xác nhận và điều động thêm máy bơm di động.');

-- 23. Nhật ký trực ban
INSERT INTO dbo.BanGhiTrucBan (maBanGhi, nguoiGhi, vaiTroNguoiGhi, maNguoiGhi, loaiBanGhiTrucBan, noiDung, trangThaiChiDao, maNhiemVu, maSuCo, theoDoiCaSau)
VALUES
('TB-01', N'Trần Văn Dũng', N'Cán bộ chỉ huy', 'ND-01', N'Bàn giao ca', N'Bàn giao ca trực sáng: Sự cố ngập úng Yên Hòa đang được đội cứu hộ xử lý tốt, có 1 điểm sơ tán Nhà văn hóa đang hoạt động đón 48 người.', N'done', 'NV-01', 'SC-01', 1);

-- 24. Thông tin bàn giao ca
INSERT INTO dbo.ThongTinBanGiao (maBanGiao, maBanGhi, nguoiNhanCa, congViecTonDong, nguoiKyNhan, thoiDiemKy)
VALUES
('BG-01', 'TB-01', N'Nguyễn Minh An', N'Theo dõi diễn biến mực nước đến 14h chiều và hỗ trợ cấp phát nhu yếu phẩm.', N'Nguyễn Minh An', SYSDATETIME());
GO

-- =============================================================================
-- TRUY VẤN KIỂM CHỨNG TOÀN BỘ CƠ SỞ DỮ LIỆU
-- =============================================================================
SELECT 'PhamViDiaBan' AS TenBang, COUNT(*) AS TongSoDong FROM dbo.PhamViDiaBan
UNION ALL SELECT 'NguoiDung', COUNT(*) FROM dbo.NguoiDung
UNION ALL SELECT 'ThongTinXacThuc', COUNT(*) FROM dbo.ThongTinXacThuc
UNION ALL SELECT 'PhienDangNhap', COUNT(*) FROM dbo.PhienDangNhap
UNION ALL SELECT 'NhatKyBaoMat', COUNT(*) FROM dbo.NhatKyBaoMat
UNION ALL SELECT 'SuCoThienTai', COUNT(*) FROM dbo.SuCoThienTai
UNION ALL SELECT 'SuKienSuCo', COUNT(*) FROM dbo.SuKienSuCo
UNION ALL SELECT 'CanBoPhuTrach', COUNT(*) FROM dbo.CanBoPhuTrach
UNION ALL SELECT 'DiemSoTan', COUNT(*) FROM dbo.DiemSoTan
UNION ALL SELECT 'CoSoVatChat', COUNT(*) FROM dbo.CoSoVatChat
UNION ALL SELECT 'NguoiBiHan', COUNT(*) FROM dbo.NguoiBiHan
UNION ALL SELECT 'DoiCuuHo', COUNT(*) FROM dbo.DoiCuuHo
UNION ALL SELECT 'ThanhVienDoi', COUNT(*) FROM dbo.ThanhVienDoi
UNION ALL SELECT 'PhuongTienDoi', COUNT(*) FROM dbo.PhuongTienDoi
UNION ALL SELECT 'ViTriDoi', COUNT(*) FROM dbo.ViTriDoi
UNION ALL SELECT 'NhiemVuCuuHo', COUNT(*) FROM dbo.NhiemVuCuuHo
UNION ALL SELECT 'BanCapNhatHienTruong', COUNT(*) FROM dbo.BanCapNhatHienTruong
UNION ALL SELECT 'HoSoNghiemThuNhiemVu', COUNT(*) FROM dbo.HoSoNghiemThuNhiemVu
UNION ALL SELECT 'HoSoPhanCong', COUNT(*) FROM dbo.HoSoPhanCong
UNION ALL SELECT 'YeuCauCuuNan', COUNT(*) FROM dbo.YeuCauCuuNan
UNION ALL SELECT 'BanPhanAnhHienTruong', COUNT(*) FROM dbo.BanPhanAnhHienTruong
UNION ALL SELECT 'CanhBaoCongBo', COUNT(*) FROM dbo.CanhBaoCongBo
UNION ALL SELECT 'CanhBaoTacNghiep', COUNT(*) FROM dbo.CanhBaoTacNghiep
UNION ALL SELECT 'BanGhiTuongTacCanhBao', COUNT(*) FROM dbo.BanGhiTuongTacCanhBao
UNION ALL SELECT 'BanGhiTrucBan', COUNT(*) FROM dbo.BanGhiTrucBan
UNION ALL SELECT 'ThongTinBanGiao', COUNT(*) FROM dbo.ThongTinBanGiao;
GO
