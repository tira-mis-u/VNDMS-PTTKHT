import type { GeographicScope } from "@/domain/auth/types";

/**
 * Khoanh vùng dropdown "Tất cả khu vực" theo địa bàn đã lưu trong hồ sơ
 * (user.geographicScope). Ví dụ: tài khoản đăng ký ở "Tây Hồ, Hà Nội" thì
 * dropdown chỉ liệt kê các khu vực thuộc Tây Hồ thay vì toàn quốc.
 */

/** Chuẩn hoá tên địa bàn để so khớp: chữ thường, bỏ dấu, gọn khoảng trắng. */
export function normalizeAreaName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

const NATIONAL_SCOPE_NAMES = ["toan quoc", "ca nuoc", "trung uong", "national"];

export function isNationalScope(scope: GeographicScope | null | undefined): boolean {
  if (!scope) return true;
  if (scope.level === "national") return true;
  return NATIONAL_SCOPE_NAMES.includes(normalizeAreaName(scope.name ?? ""));
}

/**
 * Lọc danh sách khu vực theo địa bàn hồ sơ:
 * - Phạm vi toàn quốc (hoặc không có hồ sơ) → giữ nguyên toàn bộ.
 * - Phạm vi tỉnh/huyện/xã/kho → chỉ giữ khu vực khớp tên địa bàn.
 * - Không khớp khu vực nào → giữ nguyên toàn bộ (không suy diễn sai dữ liệu,
 *   không khoá trắng dropdown khi cách đặt tên hai bên lệch nhau).
 */
export function scopeAreaOptions(
  allAreas: string[],
  scope: GeographicScope | null | undefined,
): string[] {
  if (isNationalScope(scope)) return allAreas;
  const parts = (scope?.name ?? "")
    .split(",")
    .map(normalizeAreaName)
    .filter(Boolean);
  if (!parts.length) return allAreas;
  const matched = allAreas.filter((area) => {
    const normalized = normalizeAreaName(area);
    return parts.some((part) => normalized.includes(part) || part.includes(normalized));
  });
  return matched.length ? matched : allAreas;
}

/**
 * Giá trị chọn sẵn của dropdown: khi địa bàn chỉ còn đúng 1 khu vực thì chọn
 * sẵn khu vực đó (lấy ngay dữ liệu địa bàn trong hồ sơ); còn nhiều khu vực
 * thì giữ "Tất cả khu vực" để người dùng tự thu hẹp.
 */
export function defaultScopedArea(scopedAreas: string[]): string {
  return scopedAreas.length === 1 ? scopedAreas[0] : "Tất cả khu vực";
}
