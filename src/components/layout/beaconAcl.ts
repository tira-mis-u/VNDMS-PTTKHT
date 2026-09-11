/**
 * Phạm vi chia sẻ định vị (beacon ACL) lưu trên thiết bị theo từng tài khoản:
 * - null = mọi người được phân quyền đều thấy (mặc định);
 * - mảng user ID = chỉ những người trong danh sách được thấy.
 */
const ACL_KEY_PREFIX = "vndms_beacon_acl_";

export function loadBeaconAcl(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(ACL_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return null;
  }
}

export function saveBeaconAcl(userId: string, scope: string[] | null): void {
  try {
    if (scope === null) localStorage.removeItem(ACL_KEY_PREFIX + userId);
    else localStorage.setItem(ACL_KEY_PREFIX + userId, JSON.stringify(scope));
  } catch {
    // Không lưu được (chế độ riêng tư…) thì beacon vẫn bật ở phạm vi mặc định.
  }
}
