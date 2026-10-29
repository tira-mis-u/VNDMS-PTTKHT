import { supabase, isSupabaseConfigured } from "../supabase/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * NHẬT KÝ TRỰC BAN & BÀN GIAO CA (DÙNG CHUNG NHIỀU ĐIỂM TRỰC)
 * ─────────────────────────────────────────────────────────────────────────
 * Mọi phòng chỉ huy PCTT đều phải có sổ trực ban: ai ghi nhận việc gì, ai ra
 * chỉ đạo gì, lúc mấy giờ, và ca sau nhận bàn giao những gì.
 *
 * Kiến trúc đồng bộ (cùng mô hình với định vị live):
 * - Nguồn dùng chung: `GET/POST /api/duty-log` (Vite dev server; lưu Redis
 *   khi có REDIS_URL, RAM tiến trình khi không).
 * - localStorage là bộ nhớ đệm ngoại tuyến: ghi mới lưu ngay vào máy để UI
 *   phản hồi tức thì và vẫn dùng được khi mất mạng, đồng thời đẩy nền lên
 *   máy chủ; mở lại trang sẽ hợp nhất (union-merge) bản đệm với máy chủ.
 * - Liên tab cùng trình duyệt: sự kiện `storage`.
 * - Liên máy: thăm dò (poll) máy chủ mỗi `POLL_INTERVAL_MS`.
 *
 * Xung đột duy nhất có thể xảy ra là thu hồi (retract) từ máy khác: bản đã
 * gắn dấu "[Đã thu hồi" luôn thắng khi hợp nhất.
 */

export type DutyEntryKind = "Ghi nhận" | "Chỉ đạo" | "Bàn giao ca";

/** Liên kết bản ghi tới một hồ sơ nghiệp vụ (sự cố / SOS / nhiệm vụ / đội / điểm sơ tán). */
export interface DutyLink {
  kind: "incident" | "sos" | "task" | "team" | "shelter";
  id: string;
  code: string;
}

export interface DutyLogEntry {
  id: string;
  /** ISO timestamp lúc ghi. */
  at: string;
  actor: string;
  actorRole: string;
  /** id tài khoản ghi (bản cũ thiếu → so tên hiển thị để tương thích). */
  actorId?: string;
  /**
   * Nguồn bản ghi: tay (người trực gõ) hay máy (thao tác nghiệp vụ tự ghi).
   * Bản cũ thiếu trường này → coi là "manual".
   */
  source?: "manual" | "system";
  kind: DutyEntryKind;
  text: string;
  /** Trạng thái xử lý của mục Chỉ đạo (mặc định "open" khi là chỉ đạo). */
  status?: "open" | "done";
  /** Nhiệm vụ được tạo từ mục Chỉ đạo (link 2 chiều duty↔task). */
  taskId?: string;
  /** Ca trực lúc ghi, vd "Ca 2 · 10/09/2026" (bản cũ thiếu → suy từ giờ). */
  shiftRef?: string;
  /** Đánh dấu chuyển sang ca sau theo dõi. */
  followUp?: boolean;
  /** Chỉ có ở bản ghi bàn giao ca. */
  handover?: {
    toName: string;
    pending: string;
    /** Người nhận ca xác nhận (ký nhận 2 chiều như sổ thật). */
    receivedBy?: string;
    receivedAt?: string;
  };
  /** Hồ sơ nghiệp vụ liên quan (gắn tự nguyện lúc ghi). */
  link?: DutyLink;
}

export type DutySyncState = "synced" | "local" | "error";

export interface DutySyncStatus {
  state: DutySyncState;
  /** ISO lúc đồng bộ thành công lần cuối; null nếu chưa từng. */
  lastSyncedAt: string | null;
}

const STORAGE_KEY = "vndms_duty_log_v1";
const PENDING_RETRACT_KEY = "vndms_duty_log_pending_retract_v1";
const DELETED_KEY = "vndms_duty_log_deleted_v1";
const MAX_ENTRIES = 200;
const POLL_INTERVAL_MS = 15000;
const RETRACT_MARK = "[Đã thu hồi";

const subscribers = new Set<(entries: DutyLogEntry[]) => void>();
const statusSubscribers = new Set<(status: DutySyncStatus) => void>();
let syncStatus: DutySyncStatus = { state: "local", lastSyncedAt: null };
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readDeletedIds(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function readAll(): DutyLogEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? (parsed as DutyLogEntry[]) : [];
    // Tombstone: bản ghi đã bị chủ bản ghi xóa cứng không bao giờ hiện lại,
    // kể cả khi hợp nhất với máy chủ đem bản cũ về.
    const deleted = readDeletedIds();
    return deleted.size ? list.filter((entry) => !deleted.has(entry.id)) : list;
  } catch {
    return [];
  }
}

function persist(entries: DutyLogEntry[]) {
  const capped = entries.slice(0, MAX_ENTRIES);
  if (isBrowser()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    } catch {
      /* hết quota: vẫn phát cho UI, chỉ mất tính bền vững */
    }
  }
  subscribers.forEach((fn) => fn(capped));
}

function setSyncStatus(patch: Partial<DutySyncStatus>) {
  syncStatus = { ...syncStatus, ...patch };
  statusSubscribers.forEach((fn) => fn(syncStatus));
}

function isRetracted(entry: DutyLogEntry) {
  return entry.text.startsWith(RETRACT_MARK);
}

/**
 * Hợp nhất bản đệm cục bộ với bản máy chủ: hợp theo id, mới nhất trước.
 * Bản đã thu hồi luôn thắng; còn lại hai bản giống nhau (cùng nguồn tạo)
 * nên giữ bản nào cũng được — ưu tiên bản máy chủ.
 */
export function mergeDutyEntries(
  local: DutyLogEntry[],
  remote: DutyLogEntry[],
): DutyLogEntry[] {
  const byId = new Map<string, DutyLogEntry>();
  for (const entry of local) {
    if (entry && typeof entry.id === "string") byId.set(entry.id, entry);
  }
  for (const entry of remote) {
    if (!entry || typeof entry.id !== "string") continue;
    const current = byId.get(entry.id);
    if (!current || isRetracted(entry) || !isRetracted(current)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function sameEntries(a: DutyLogEntry[], b: DutyLogEntry[]) {
  if (a.length !== b.length) return false;
  return a.every(
    (entry, index) =>
      entry.id === b[index]?.id && entry.text === b[index]?.text,
  );
}

export function dutyEntryToRow(entry: DutyLogEntry): Record<string, unknown> {
  return {
    id: entry.id,
    at: entry.at,
    actor: entry.actor,
    actor_role: entry.actorRole,
    actor_id: entry.actorId ?? null,
    source: entry.source ?? "manual",
    kind: entry.kind,
    text: entry.text,
    status: entry.status ?? null,
    task_id: entry.taskId ?? null,
    shift_ref: entry.shiftRef ?? null,
    follow_up: entry.followUp ?? false,
    handover: entry.handover ?? null,
    link: entry.link ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function rowToDutyEntry(row: any): DutyLogEntry {
  return {
    id: String(row.id),
    at: String(row.at),
    actor: String(row.actor || ""),
    actorRole: String(row.actor_role || ""),
    actorId: row.actor_id ? String(row.actor_id) : undefined,
    source: (row.source === "system" ? "system" : "manual") as "manual" | "system",
    kind: (row.kind || "Ghi nhận") as DutyEntryKind,
    text: String(row.text || ""),
    status: row.status ? (row.status as "open" | "done") : undefined,
    taskId: row.task_id ? String(row.task_id) : undefined,
    shiftRef: row.shift_ref ? String(row.shift_ref) : undefined,
    followUp: Boolean(row.follow_up),
    handover: row.handover && typeof row.handover === "object" ? row.handover : undefined,
    link: row.link && typeof row.link === "object" ? row.link : undefined,
  };
}

async function fetchRemote(): Promise<DutyLogEntry[] | null> {
  // 1. Kéo từ Supabase Cloud dùng chung
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("duty_logs")
        .select("*")
        .order("at", { ascending: false })
        .limit(MAX_ENTRIES);

      if (!error && Array.isArray(data)) {
        return data.map(rowToDutyEntry);
      }
    } catch {
      // Bảng chưa có hoặc mạng lỗi -> thử tiếp endpoint dự phòng
    }
  }

  // 2. Dự phòng: endpoint Vite dev server /api/duty-log (Redis/RAM)
  try {
    const response = await fetch("/api/duty-log");
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success: boolean;
      data?: DutyLogEntry[];
    };
    if (!payload.success || !Array.isArray(payload.data)) return null;
    return payload.data.filter(
      (entry): entry is DutyLogEntry =>
        !!entry && typeof entry.id === "string" && typeof entry.text === "string",
    );
  } catch {
    return null;
  }
}

/** Kéo bản máy chủ về và hợp nhất với bản đệm; trả về true nếu có thay đổi. */
export async function syncDutyLogFromServer(): Promise<boolean> {
  if (!isBrowser() || pollInFlight) return false;
  pollInFlight = true;
  try {
    const remote = await fetchRemote();
    if (!remote) {
      setSyncStatus({ state: syncStatus.lastSyncedAt ? "error" : "local" });
      return false;
    }
    const merged = mergeDutyEntries(readAll(), remote);
    const changed = !sameEntries(merged, readAll());
    // Đẩy bù các lượt thu hồi đã xếp hàng khi ngoại tuyến.
    const pendingRetracts = readPendingRetracts();
    for (const item of pendingRetracts) {
      const ok = await pushRetract(item.id, item.actor);
      if (ok && isBrowser()) {
        try {
          localStorage.setItem(
            PENDING_RETRACT_KEY,
            JSON.stringify(
              readPendingRetracts().filter((rest) => rest.id !== item.id),
            ),
          );
        } catch {
          /* bỏ qua */
        }
      }
    }
    // Đẩy ngược các bản chỉ có ở máy (ghi khi ngoại tuyến) lên máy chủ.
    const remoteIds = new Set(remote.map((entry) => entry.id));
    const onlyLocal = merged.filter((entry) => !remoteIds.has(entry.id));
    if (changed) persist(merged);
    setSyncStatus({ state: "synced", lastSyncedAt: new Date().toISOString() });
    for (const entry of onlyLocal) {
      void pushDutyEntry(entry);
    }
    return changed;
  } finally {
    pollInFlight = false;
  }
}

async function pushDutyEntry(entry: DutyLogEntry) {
  let ok = false;
  // 1. Supabase Cloud (chính)
  if (isSupabaseConfigured && supabase) {
    try {
      const row = dutyEntryToRow(entry);
      const { error } = await supabase.from("duty_logs").upsert(row, { onConflict: "id" });
      if (!error) {
        ok = true;
        setSyncStatus({ state: "synced", lastSyncedAt: new Date().toISOString() });
      }
    } catch {
      // Ngoại tuyến: giữ bản đệm localStorage
    }
  }

  // 2. Endpoint dev server /api/duty-log (dự phòng)
  try {
    const response = await fetch("/api/duty-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const payload = (await response.json()) as { success: boolean };
    if (response.ok && payload.success) {
      ok = true;
      setSyncStatus({ state: "synced", lastSyncedAt: new Date().toISOString() });
    }
  } catch {
    /* ignore */
  }

  if (!ok && !syncStatus.lastSyncedAt) {
    setSyncStatus({ state: "local" });
  }
}

function readPendingRetracts(): Array<{ id: string; actor: string }> {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_RETRACT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function queuePendingRetract(id: string, actor: string) {
  if (!isBrowser()) return;
  const pending = readPendingRetracts().filter((item) => item.id !== id);
  pending.push({ id, actor });
  try {
    localStorage.setItem(PENDING_RETRACT_KEY, JSON.stringify(pending));
  } catch {
    /* hết quota: chấp nhận mất lượt đẩy bù */
  }
}

async function pushRetract(id: string, actor: string): Promise<boolean> {
  let ok = false;
  // 1. Supabase Cloud
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.from("duty_logs").select("text").eq("id", id).maybeSingle();
      const currentText = data?.text ?? "";
      const retractedText = currentText.startsWith(RETRACT_MARK)
        ? currentText
        : `[Đã thu hồi bởi ${actor}] ${currentText}`;

      const { error } = await supabase
        .from("duty_logs")
        .update({ text: retractedText, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) ok = true;
    } catch {
      // ignore
    }
  }

  // 2. Dự phòng /api/duty-log/retract
  try {
    const response = await fetch("/api/duty-log/retract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, actor }),
    });
    const payload = (await response.json()) as { success: boolean };
    if (response.ok && payload.success) ok = true;
  } catch {
    // ignore
  }

  return ok;
}

async function sendRetract(id: string, actor: string) {
  const ok = await pushRetract(id, actor);
  // Ngoại tuyến: xếp hàng để lần đồng bộ sau đẩy bù; trong lúc chờ, bản
  // thu hồi cục bộ vẫn thắng khi hợp nhất nên không bị ghi đè.
  if (!ok) queuePendingRetract(id, actor);
}

export function getDutyLog(): DutyLogEntry[] {
  return readAll();
}

export function getDutySyncStatus(): DutySyncStatus {
  return syncStatus;
}

export function subscribeDutyLog(fn: (entries: DutyLogEntry[]) => void) {
  subscribers.add(fn);
  fn(readAll());
  // Kéo nền ngay khi có người nghe đầu tiên để bản dùng chung tới sớm.
  if (subscribers.size === 1) void syncDutyLogFromServer();
  return () => subscribers.delete(fn);
}

export function subscribeDutySync(fn: (status: DutySyncStatus) => void) {
  statusSubscribers.add(fn);
  fn(syncStatus);
  return () => statusSubscribers.delete(fn);
}

let realtimeChannel: RealtimeChannel | null = null;

/**
 * Đăng ký Supabase Realtime cho sổ trực ban — các phòng chỉ huy cập nhật
 * tức thì (sub-second) như một kênh chat trực tiếp không cần chờ poll.
 */
export function setupDutyLogRealtime(): void {
  if (!isBrowser() || !isSupabaseConfigured || !supabase || realtimeChannel) return;

  try {
    realtimeChannel = supabase
      .channel("vndms_duty_logs_realtime_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "duty_logs" },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const newEntry = rowToDutyEntry(payload.new);
            const current = readAll();
            if (!current.some((e) => e.id === newEntry.id)) {
              const merged = mergeDutyEntries(current, [newEntry]);
              persist(merged);
              setSyncStatus({ state: "synced", lastSyncedAt: new Date().toISOString() });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedEntry = rowToDutyEntry(payload.new);
            const current = readAll();
            const next = current.map((e) => (e.id === updatedEntry.id ? updatedEntry : e));
            persist(next);
            setSyncStatus({ state: "synced", lastSyncedAt: new Date().toISOString() });
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              const current = readAll();
              persist(current.filter((e) => e.id !== deletedId));
              setSyncStatus({ state: "synced", lastSyncedAt: new Date().toISOString() });
            }
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus({ state: "synced" });
        }
      });
  } catch (err) {
    console.warn("[VNDMS/DutyLog] Không thể kết nối Supabase Realtime:", err);
  }
}

export function teardownDutyLogRealtime(): void {
  if (realtimeChannel && supabase) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch {
      // ignore
    }
    realtimeChannel = null;
  }
}

let activeSyncCount = 0;

/** Bật/tắt đồng bộ Realtime & thăm dò máy chủ (gọi khi panel trực ban mount/unmount). */
export function startDutyLogSync() {
  if (!isBrowser()) return () => stopDutyLogSync();
  activeSyncCount++;

  setupDutyLogRealtime();
  void syncDutyLogFromServer();

  if (!pollTimer) {
    pollTimer = setInterval(() => void syncDutyLogFromServer(), POLL_INTERVAL_MS);
  }

  return () => {
    activeSyncCount = Math.max(0, activeSyncCount - 1);
    if (activeSyncCount === 0) {
      stopDutyLogSync();
      teardownDutyLogRealtime();
    }
  };
}

export function stopDutyLogSync() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Liên tab cùng trình duyệt: tab khác ghi → sự kiện storage → đọc lại.
if (isBrowser()) {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      subscribers.forEach((fn) => fn(readAll()));
    }
  });
}

/** Chuỗi tham chiếu ca trực cho bản ghi, vd "Ca 2 · 10/09/2026". */
export function dutyShiftRef(at: Date = new Date()): string {
  const shift = getDutyShift(at);
  const day = at.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${shift.name} · ${day}`;
}

export function appendDutyEntry(
  entry: Omit<DutyLogEntry, "id" | "at">,
): DutyLogEntry {
  const record: DutyLogEntry = {
    source: "manual",
    ...entry,
    shiftRef: entry.shiftRef ?? dutyShiftRef(),
    id: `DUTY-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
  };
  persist([record, ...readAll()]);
  void pushDutyEntry(record);
  return record;
}

/**
 * Máy tự ghi 1 dòng vào sổ sau mỗi thao tác nghiệp vụ lớn (tạo/giao/điều/
 * xác minh/đóng...). Nội dung là tóm tắt 1 dòng + link hồ sơ gốc (chi tiết
 * đọc ở hồ sơ gốc, không copy). Bản system không sửa/xóa/thu hồi.
 */
export function appendSystemDutyEntry(entry: {
  actor: string;
  actorRole: string;
  actorId?: string;
  text: string;
  link?: DutyLink;
}): DutyLogEntry {
  return appendDutyEntry({
    actor: entry.actor,
    actorRole: entry.actorRole,
    ...(entry.actorId ? { actorId: entry.actorId } : {}),
    source: "system",
    kind: "Ghi nhận",
    text: entry.text,
    ...(entry.link ? { link: entry.link } : {}),
  });
}

/** Cập nhật 1 trường của bản ghi rồi đẩy lên máy chủ (ký nhận dùng riêng). */
function patchDutyEntry(id: string, patch: Partial<DutyLogEntry>): DutyLogEntry | null {
  let updated: DutyLogEntry | null = null;
  const next = readAll().map((entry) => {
    if (entry.id !== id) return entry;
    updated = { ...entry, ...patch };
    return updated;
  });
  if (!updated) return null;
  persist(next);
  void pushDutyEntry(updated);
  return updated;
}

/** Gắn nhiệm vụ được tạo từ mục Chỉ đạo (link 2 chiều) + đánh dấu xong. */
export function linkDutyEntryToTask(entryId: string, taskId: string) {
  return patchDutyEntry(entryId, { taskId, status: "done" });
}

/** Đánh dấu mục Chỉ đạo đã hoàn tất (không qua nhiệm vụ). */
export function markDutyEntryDone(entryId: string) {
  return patchDutyEntry(entryId, { status: "done" });
}

/** Bật/tắt "chuyển ca sau theo dõi" cho một bản ghi. */
export function toggleDutyFollowUp(entryId: string) {
  const entry = readAll().find((item) => item.id === entryId);
  if (!entry) return null;
  return patchDutyEntry(entryId, { followUp: !entry.followUp });
}

/**
 * Người nhận ca ký xác nhận một bản bàn giao. Ghi đè lên đúng bản ghi cũ
 * (cùng id) rồi đẩy lên máy chủ — phía server upsert theo id nên các điểm
 * trực khác cũng thấy chữ ký nhận.
 */
export function confirmDutyHandover(id: string, actor: string): DutyLogEntry | null {
  let confirmed: DutyLogEntry | null = null;
  const next = readAll().map((entry) => {
    if (entry.id !== id || !entry.handover || entry.handover.receivedBy) return entry;
    confirmed = {
      ...entry,
      handover: {
        ...entry.handover,
        receivedBy: actor,
        receivedAt: new Date().toISOString(),
      },
    };
    return confirmed;
  });
  if (!confirmed) return null;
  persist(next);
  void pushDutyEntry(confirmed);
  return confirmed;
}

/** Xoá một bản ghi ghi nhầm (giữ lại dấu vết bằng cách ghi đè nội dung). */
export function retractDutyEntry(id: string, actor: string) {
  const next = readAll().map((entry) =>
    entry.id === id && !isRetracted(entry)
      ? { ...entry, text: `[Đã thu hồi bởi ${actor}] ${entry.text}` }
      : entry,
  );
  persist(next);
  void sendRetract(id, actor);
}

/**
 * Xóa cứng bản ghi do CHÍNH người thao tác tạo ra (ghi nhầm khi thử nghiệm…).
 * Chỉ xóa được bản ghi của mình — bản ghi người khác giữ nguyên để bảo toàn
 * tính nhật ký. Trên máy chủ (nếu có) gửi kèm lượt thu hồi để máy khác không
 * nhìn thấy nội dung cũ; cục bộ dùng tombstone để bản ghi không hợp nhất về lại.
 */
export function deleteDutyEntry(id: string, actorId: string): boolean {
  const all = readAll();
  const target = all.find((entry) => entry.id === id);
  if (!target) return false;
  const own = target.actorId
    ? target.actorId === actorId
    : false;
  if (!own) return false;
  persist(all.filter((entry) => entry.id !== id));
  try {
    const deleted = readDeletedIds();
    deleted.add(id);
    localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted]));
  } catch {
    /* vẫn xóa được trong phiên */
  }
  if (isSupabaseConfigured && supabase) {
    try {
      void (async () => {
        await supabase.from("duty_logs").delete().eq("id", id);
      })();
    } catch {
      // ignore
    }
  }
  void sendRetract(id, target.actor ?? actorId);
  return true;
}

export function formatDutyClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export interface DutyShift {
  name: string;
  range: string;
}

/**
 * Ca trực 8 tiếng của phòng chỉ huy: Ca 1 (6:00–14:00), Ca 2
 * (14:00–22:00), Ca 3 (22:00–6:00 hôm sau).
 */
export function getDutyShift(at: Date = new Date()): DutyShift {
  const hour = at.getHours();
  if (hour >= 6 && hour < 14) return { name: "Ca 1", range: "6:00–14:00" };
  if (hour >= 14 && hour < 22) return { name: "Ca 2", range: "14:00–22:00" };
  return { name: "Ca 3", range: "22:00–6:00" };
}

export interface DutyShiftWindow extends DutyShift {
  /** Mốc bắt đầu ca (giờ địa phương). */
  start: Date;
  /** Mốc kết thúc ca (Ca 3 sang ngày hôm sau). */
  end: Date;
}

/** Khung giờ của ca trực chứa thời điểm cho trước. */
export function getDutyShiftWindow(at: Date = new Date()): DutyShiftWindow {
  const hour = at.getHours();
  const start = new Date(at);
  start.setSeconds(0, 0);
  if (hour >= 6 && hour < 14) {
    start.setHours(6, 0);
    return { name: "Ca 1", range: "6:00–14:00", start, end: new Date(start.getTime() + 8 * 3600_000) };
  }
  if (hour >= 14 && hour < 22) {
    start.setHours(14, 0);
    return { name: "Ca 2", range: "14:00–22:00", start, end: new Date(start.getTime() + 8 * 3600_000) };
  }
  // Ca 3: 22:00 hôm trước – 6:00 hôm sau.
  start.setHours(22, 0);
  if (hour < 6) start.setDate(start.getDate() - 1);
  return { name: "Ca 3", range: "22:00–6:00", start, end: new Date(start.getTime() + 8 * 3600_000) };
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

/** "Hôm nay" / "Hôm qua" / dd/mm/yyyy để nhóm bản ghi theo ngày. */
export function formatDutyDay(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDay.getTime()) / 86400000,
  );
  if (diffDays <= 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
