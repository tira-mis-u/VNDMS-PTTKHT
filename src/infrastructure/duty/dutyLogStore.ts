/**
 * NHẬT KÝ TRỰC BAN & BÀN GIAO CA
 * ─────────────────────────────────────────────────────────────────────────
 * Mọi phòng chỉ huy PCTT đều phải có sổ trực ban: ai ghi nhận việc gì, ai ra
 * chỉ đạo gì, lúc mấy giờ, và ca sau nhận bàn giao những gì. VNDMS trước đây
 * chỉ có "Nhật ký bảo mật" (audit kỹ thuật: ai sửa bản ghi nào) — không thay
 * thế được sổ trực ban nghiệp vụ.
 *
 * Giới hạn của bản hiện tại — nói rõ để không tạo ảo giác về năng lực:
 * nhật ký lưu trong localStorage của chính máy đang dùng, phục vụ một điểm
 * trực. Khi có backend, thay hai hàm `readAll`/`persist` bằng API là xong,
 * phần còn lại của giao diện không phải sửa.
 */

export type DutyEntryKind = "Ghi nhận" | "Chỉ đạo" | "Bàn giao ca";

export interface DutyLogEntry {
  id: string;
  /** ISO timestamp lúc ghi. */
  at: string;
  actor: string;
  actorRole: string;
  kind: DutyEntryKind;
  text: string;
  /** Chỉ có ở bản ghi bàn giao ca. */
  handover?: {
    toName: string;
    pending: string;
  };
}

const STORAGE_KEY = "vndms_duty_log_v1";
const MAX_ENTRIES = 200;

const subscribers = new Set<(entries: DutyLogEntry[]) => void>();

function readAll(): DutyLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DutyLogEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: DutyLogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* hết quota: vẫn phát cho UI, chỉ mất tính bền vững */
  }
  subscribers.forEach((fn) => fn(entries));
}

export function getDutyLog(): DutyLogEntry[] {
  return readAll();
}

export function subscribeDutyLog(fn: (entries: DutyLogEntry[]) => void) {
  subscribers.add(fn);
  fn(readAll());
  return () => subscribers.delete(fn);
}

export function appendDutyEntry(entry: Omit<DutyLogEntry, "id" | "at">): DutyLogEntry {
  const record: DutyLogEntry = {
    ...entry,
    id: `DUTY-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
  };
  const next = [record, ...readAll()];
  persist(next);
  return record;
}

/** Xoá một bản ghi ghi nhầm (giữ lại dấu vết bằng cách ghi đè nội dung). */
export function retractDutyEntry(id: string, actor: string) {
  const next = readAll().map((entry) =>
    entry.id === id
      ? { ...entry, text: `[Đã thu hồi bởi ${actor}] ${entry.text}` }
      : entry,
  );
  persist(next);
}

export function formatDutyTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}
