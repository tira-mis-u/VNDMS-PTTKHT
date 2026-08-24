/** Nguồn danh tính duy nhất cho tài khoản và nhân sự dữ liệu trình diễn. */
export type PersonnelIdentity = {
  id: string;
  displayName: string;
  role: string;
  title: string;
  organization: string | null;
  contact: string | null;
  geographicScope: {
    level: "national" | "province" | "district" | "ward" | "facility" | "warehouse";
    code: string;
    name: string;
  } | null;
  roleLabel: string;
  kind: "account" | "personnel" | "citizen";
};

/**
 * Mọi danh tính đều có cùng schema. Giá trị chưa có trong hồ sơ nguồn được giữ
 * là `null`, không suy đoán đơn vị, liên hệ hoặc địa bàn.
 */
function personnel<const T extends Pick<PersonnelIdentity, "id" | "displayName" | "roleLabel" | "kind">>(
  identity: T & Partial<Pick<PersonnelIdentity, "role" | "title" | "organization" | "contact" | "geographicScope">>,
): T & PersonnelIdentity {
  return {
    role: identity.roleLabel,
    title: identity.roleLabel,
    organization: null,
    contact: null,
    geographicScope: null,
    ...identity,
  };
}

export const PERSONNEL = {
  COMMANDER: personnel({ id: "USR-CMD-001", displayName: "Trần Quốc Thuận", role: "commander", roleLabel: "Chỉ huy", title: "Chỉ huy điều hành", organization: "Ban Chỉ huy Phòng, chống thiên tai và Tìm kiếm cứu nạn", geographicScope: { level: "national", code: "VN", name: "Toàn quốc" }, kind: "account" }),
  OPERATOR: personnel({ id: "USR-OPS-001", displayName: "Nguyễn Quốc Trung", role: "operator", roleLabel: "Điều hành viên", title: "Điều hành viên tác nghiệp", organization: "Ban Chỉ huy Phòng, chống thiên tai và Tìm kiếm cứu nạn", geographicScope: { level: "national", code: "VN", name: "Toàn quốc" }, kind: "account" }),
  LOCAL_OFFICER: personnel({ id: "USR-LOC-001", displayName: "Phạm Văn Đam", role: "local_officer", roleLabel: "Cán bộ địa phương", title: "Cán bộ điều phối địa phương", organization: "UBND quận Tây Hồ", geographicScope: { level: "district", code: "HN-TAYHO", name: "Tây Hồ, Hà Nội" }, kind: "account" }),
  RESCUE_LEADER: personnel({ id: "USR-RSL-001", displayName: "Phạm Trung Hiếu", role: "rescue_leader", roleLabel: "Đội trưởng đội cứu hộ", title: "Đội trưởng cứu hộ", organization: "Lực lượng cứu hộ Hà Nội", geographicScope: { level: "province", code: "HN", name: "Hà Nội" }, kind: "account" }),
  RESCUE_MEMBER: personnel({ id: "USR-RSM-001", displayName: "Lê Nguyễn Minh Trí", role: "rescue_member", roleLabel: "Thành viên đội cứu hộ", title: "Thành viên cứu hộ", organization: "Lực lượng cứu hộ Hà Nội", geographicScope: { level: "province", code: "HN", name: "Hà Nội" }, kind: "account" }),
  WAREHOUSE_STAFF: personnel({ id: "USR-WHS-001", displayName: "Nguyễn Nam Anh", role: "warehouse_staff", roleLabel: "Nhân viên kho", title: "Nhân viên điều phối kho", organization: "Kho Trung tâm Hà Nội", geographicScope: { level: "warehouse", code: "KHO-01", name: "Hoàn Kiếm, Hà Nội" }, kind: "account" }),
  HOANG_VAN_KHOA: personnel({ id: "PERS-001", displayName: "Hoàng Văn Khoa", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  MAI_NAM_HAI: personnel({ id: "PERS-002", displayName: "Mai Nam Hải", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_HOANG_LONG: personnel({ id: "PERS-003", displayName: "Nguyễn Hoàng Long", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_HUU_DA: personnel({ id: "PERS-004", displayName: "Nguyễn Hữu Đa", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_DANG_AI: personnel({ id: "PERS-005", displayName: "Nguyễn Đăng Ái", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHAM_KHANH_SON: personnel({ id: "PERS-006", displayName: "Phạm Khánh Sơn", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHAM_LE_HONG_QUANG: personnel({ id: "PERS-007", displayName: "Phạm Lê Hồng Quang", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHAM_MANH_HUNG: personnel({ id: "PERS-008", displayName: "Phạm Mạnh Hùng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  TRUONG_DINH_HOANG: personnel({ id: "PERS-009", displayName: "Trương Đình Hoàng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  TRAN_HUYEN_MY: personnel({ id: "PERS-010", displayName: "Trần Huyền My", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  TRAN_THIEN_THANH_BAO: personnel({ id: "PERS-011", displayName: "Trần Thiện Thanh Bảo", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DANG_THU_HA: personnel({ id: "PERS-012", displayName: "Đặng Thu Hà", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DANG_TIEN_HOANG: personnel({ id: "PERS-013", displayName: "Đặng Tiến Hoàng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DONG_LE_QUYEN: personnel({ id: "PERS-014", displayName: "Đồng Lệ Quyên", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  LE_ANH_MINH: personnel({ id: "PERS-015", displayName: "Lê Anh Minh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DUONG_TUAN_KHOI: personnel({ id: "PERS-016", displayName: "Dương Tuấn Khôi", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  HOANG_VAN_NAM: personnel({ id: "PERS-017", displayName: "Hoàng Văn Nam", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGHIEM_VU_HOANG_LONG: personnel({ id: "PERS-018", displayName: "Nghiêm Vũ Hoàng Long", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_VAN_THANH_NAM: personnel({ id: "PERS-019", displayName: "Nguyễn Văn Thành Nam", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  VU_DINH_TRONG_THANG: personnel({ id: "PERS-020", displayName: "Vũ Đinh Trọng Thắng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  BUI_MINH: personnel({ id: "PERS-021", displayName: "Bùi Minh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  BUI_VAN_NGUYEN: personnel({ id: "PERS-022", displayName: "Bùi Văn Nguyện", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  BUI_XUAN_HUAN: personnel({ id: "PERS-023", displayName: "Bùi Xuân Huấn", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  CAO_VIET_HUNG: personnel({ id: "PERS-024", displayName: "Cao Việt Hưng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  CHU_XUAN_HUNG: personnel({ id: "PERS-025", displayName: "Chu Xuân Hưng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DU_PHONG_LINH: personnel({ id: "PERS-026", displayName: "Dư Phong Linh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  HUYNH_MINH_THU: personnel({ id: "PERS-027", displayName: "Huỳnh Minh Thư", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  HUYNH_TRAN_THANH: personnel({ id: "PERS-028", displayName: "Huỳnh Trấn Thành", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  HA_NHAT_LONG: personnel({ id: "PERS-029", displayName: "Hà Nhật Long", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  KHUC_THI_HUONG: personnel({ id: "PERS-030", displayName: "Khúc Thị Hương", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  KIEU_LUONG_TAM: personnel({ id: "PERS-031", displayName: "Kiều Lương Tâm", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  LE_HUY_HOANG: personnel({ id: "PERS-032", displayName: "Lê Huy Hoàng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  LUU_KY_ANH: personnel({ id: "PERS-033", displayName: "Lưu Kỳ Anh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  LUU_THI_THANH_TRUC: personnel({ id: "PERS-034", displayName: "Lưu Thị Thanh Trúc", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_ANH_DUNG: personnel({ id: "PERS-035", displayName: "Nguyễn Anh Dũng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_CONG_MINH: personnel({ id: "PERS-036", displayName: "Nguyễn Công Minh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_HOANG_ANH: personnel({ id: "PERS-037", displayName: "Nguyễn Hoàng Anh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_HUU_PHUONG_UYEN: personnel({ id: "PERS-038", displayName: "Nguyễn Hữu Phương Uyên", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_NGOC_LONG: personnel({ id: "PERS-039", displayName: "Nguyễn Ngọc Long", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_PHUONG_ANH: personnel({ id: "PERS-040", displayName: "Nguyễn Phương Anh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_THANH_TUNG: personnel({ id: "PERS-041", displayName: "Nguyễn Thanh Tùng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_THI_ANH_VIEN: personnel({ id: "PERS-042", displayName: "Nguyễn Thị Ánh Viên", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_TIEN_DAT: personnel({ id: "PERS-043", displayName: "Nguyễn Tiến Đạt", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_TRUNG_DUNG: personnel({ id: "PERS-044", displayName: "Nguyễn Trung Dũng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_TRAN_THANH_VAN: personnel({ id: "PERS-045", displayName: "Nguyễn Trần Thanh Vân", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_TUAN_HUNG: personnel({ id: "PERS-046", displayName: "Nguyễn Tuấn Hưng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGUYEN_XUAN_TU: personnel({ id: "PERS-047", displayName: "Nguyễn Xuân Tú", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGO_BA_KHA: personnel({ id: "PERS-048", displayName: "Ngô Bá Khá", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  NGO_NGOC_LY: personnel({ id: "PERS-049", displayName: "Ngô Ngọc Ly", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHUNG_THANH_DO: personnel({ id: "PERS-050", displayName: "Phùng Thanh Độ", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHUONG_HUU_DUONG: personnel({ id: "PERS-051", displayName: "Phương Hữu Dưỡng", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHAM_ANH_SON: personnel({ id: "PERS-052", displayName: "Phạm Anh Sơn", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  PHAM_DUC_TRUNG: personnel({ id: "PERS-053", displayName: "Phạm Đức Trung", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  TRAN_HA_LINH: personnel({ id: "PERS-054", displayName: "Trần Hà Linh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  VO_NGUYEN_HOAI_LINH: personnel({ id: "PERS-055", displayName: "Võ Nguyễn Hoài Linh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  VO_VAN_CUONG_QUOC: personnel({ id: "PERS-056", displayName: "Võ Văn Cường Quốc", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  VUONG_CUONG: personnel({ id: "PERS-057", displayName: "Vương Cường", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DAO_HONG_TRA: personnel({ id: "PERS-058", displayName: "Đào Hồng Trà", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DANG_CAO_BO: personnel({ id: "PERS-059", displayName: "Đặng Cao Bồ", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DONG_ANH_LINH: personnel({ id: "PERS-060", displayName: "Đồng Anh Linh", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
  DO_BACH_KHOA: personnel({ id: "PERS-061", displayName: "Đỗ Bách Khoa", roleLabel: "Nhân sự nghiệp vụ", kind: "personnel" }),
} as const satisfies Record<string, PersonnelIdentity>;

export type PersonnelId = (typeof PERSONNEL)[keyof typeof PERSONNEL]["id"];
const BY_ID = new Map<string, PersonnelIdentity>(
  Object.values(PERSONNEL).map((person) => [person.id, person]),
);
export function resolvePersonnel(id: PersonnelId | string) { return BY_ID.get(id); }
export function personName(id: PersonnelId | string, honorific?: string) {
  const name = resolvePersonnel(id)?.displayName ?? "Không xác định";
  return honorific ? `${honorific} ${name}` : name;
}
