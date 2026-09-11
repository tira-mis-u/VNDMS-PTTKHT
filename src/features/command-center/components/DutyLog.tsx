import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, ClipboardList, Download, Eye, EyeOff, Flag, Link2, ListTodo, LogIn, PenLine, Printer, Trash2, Undo2, X } from "lucide-react";
import {
  appendDutyEntry,
  confirmDutyHandover,
  deleteDutyEntry,
  formatDutyClock,
  formatDutyDay,
  formatDutyTime,
  getDutyShiftWindow,
  getDutySyncStatus,
  markDutyEntryDone,
  retractDutyEntry,
  startDutyLogSync,
  subscribeDutyLog,
  subscribeDutySync,
  toggleDutyFollowUp,
  type DutyEntryKind,
  type DutyLink,
  type DutyLogEntry,
  type DutySyncStatus,
} from "@/infrastructure/duty/dutyLogStore";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { roleLabels } from "@/domain/auth/labels";
import { parseOperationalDate } from "@/application/analytics/analyticsQueries";

const KINDS: DutyEntryKind[] = ["Ghi nhận", "Chỉ đạo"];
const FILTERS: Array<"Tất cả" | "Ca này" | DutyEntryKind> = ["Tất cả", "Ca này", "Ghi nhận", "Chỉ đạo", "Bàn giao ca"];
const COLLAPSED_LIMIT = 8;
const EXPANDED_LIMIT = 60;

const kindClass = (kind: DutyEntryKind) =>
  kind === "Chỉ đạo" ? "order" : kind === "Bàn giao ca" ? "handover" : "note";

const linkPath = (link: DutyLink) =>
  link.kind === "incident"
    ? `/incidents/${link.id}`
    : link.kind === "sos"
      ? `/sos/${link.id}`
      : link.kind === "team"
        ? `/teams/${link.id}`
        : link.kind === "shelter"
          ? `/shelters/${link.id}`
          : `/tasks/${link.id}`;

const isRetracted = (entry: DutyLogEntry) => entry.text.startsWith("[Đã thu hồi");
const sourceOf = (entry: DutyLogEntry): "manual" | "system" => entry.source ?? "manual";

interface LinkCandidate {
  kind: DutyLink["kind"];
  id: string;
  code: string;
  title: string;
}

/**
 * SỔ TRỰC BAN của phòng chỉ huy — dòng thời gian hợp nhất của ca trực:
 * - MANUAL (người ghi): Ghi nhận / Chỉ đạo / Bàn giao — có cổng quyền theo vai.
 * - SYSTEM (máy tự ghi): tóm tắt 1 dòng + link hồ sơ gốc sau mỗi thao tác lớn.
 * Chỉ đạo có thể chuyển thành Nhiệm vụ (link 2 chiều); bàn giao dựng sẵn từ
 * dữ liệu thật rồi mới chốt + ký.
 */
export function DutyLog({ navigate }: { navigate: (path: string) => void }) {
  const store = useOperationalState();
  const user = store.currentUser;
  const [entries, setEntries] = useState<DutyLogEntry[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<DutyEntryKind>("Ghi nhận");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverStep, setHandoverStep] = useState<1 | 2>(1);
  const [handoverTo, setHandoverTo] = useState("");
  const [handoverDraft, setHandoverDraft] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tất cả");
  const [showSystem, setShowSystem] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sync, setSync] = useState<DutySyncStatus>(() => getDutySyncStatus());
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkSel, setLinkSel] = useState<DutyLink | null>(null);

  useEffect(() => {
    const unsubscribeEntries = subscribeDutyLog(setEntries);
    const unsubscribeSync = subscribeDutySync(setSync);
    const stopSync = startDutyLogSync();
    return () => {
      unsubscribeEntries();
      unsubscribeSync();
      stopSync();
    };
  }, []);

  // CỔNG QUYỀN: đơn vị cứu hộ chỉ được Ghi nhận (không ra Chỉ đạo, không giữ
  // ca trực nên không bàn giao/ký nhận). Công dân không mở được trang này.
  const role = store.role;
  const canOrder = role === "disaster_officer" || role === "admin";
  const canHandover = canOrder;

  const lastHandover = useMemo(
    () => entries.find((entry) => entry.kind === "Bàn giao ca"),
    [entries],
  );

  const shift = useMemo(() => getDutyShiftWindow(), []);
  const inShift = (iso: string) => {
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) && ms >= shift.start.getTime() && ms < shift.end.getTime();
  };
  const handoverState = lastHandover?.handover
    ? lastHandover.handover.receivedBy
      ? `Trực ca: ${lastHandover.handover.receivedBy} (đã ký nhận lúc ${formatDutyTime(lastHandover.handover.receivedAt ?? "")})`
      : `Chờ ${lastHandover.handover.toName} ký nhận bàn giao của ${lastHandover.actor}`
    : "Chưa ghi bàn giao ca";
  const shiftLine = `${shift.name} (${shift.range}) · ${handoverState}`;

  const seqById = useMemo(() => {
    const byDay = new Map<string, DutyLogEntry[]>();
    for (const entry of entries) {
      const day = new Date(entry.at).toLocaleDateString("vi-VN");
      const list = byDay.get(day) ?? [];
      list.push(entry);
      byDay.set(day, list);
    }
    const map = new Map<string, number>();
    for (const list of byDay.values()) {
      [...list]
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
        .forEach((entry, index) => map.set(entry.id, index + 1));
    }
    return map;
  }, [entries]);

  const shiftSummary = useMemo(() => {
    const inWindow = (value: string | null | undefined) => {
      if (!value) return false;
      const ms = parseOperationalDate(value);
      return Number.isFinite(ms) && ms >= shift.start.getTime() && ms < shift.end.getTime();
    };
    const sosNew = store.sosRequests.filter((item) => inWindow(item.receivedAt)).length;
    const incidentNew = store.incidents.filter((item) => inWindow(item.createdAt)).length;
    const taskDone = store.tasks.filter(
      (item) => item.status === "Hoàn thành" && inWindow(item.completedAt ?? item.updatedAt),
    ).length;
    const orders = entries.filter((entry) => entry.kind === "Chỉ đạo" && inShift(entry.at)).length;
    const sosOpen = store.sosRequests.filter((item) => !["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(item.status)).length;
    const incidentOpen = store.incidents.filter(
      (item) => !["Đã đóng", "Đã kiểm soát"].includes(item.status),
    ).length;
    const now = Date.now();
    const taskOverdue = store.tasks.filter(
      (item) =>
        !["Hoàn thành", "Đã hủy"].includes(item.status) &&
        Number.isFinite(parseOperationalDate(item.dueAt)) &&
        parseOperationalDate(item.dueAt) < now,
    ).length;
    const taskAwaiting = store.tasks.filter((item) => item.status === "Chờ xác nhận").length;
    return { sosNew, incidentNew, taskDone, orders, sosOpen, incidentOpen, taskOverdue, taskAwaiting };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sosRequests, store.incidents, store.tasks, entries, shift]);

  /**
   * VIỆC DỞ DANG THẬT (không phải textarea tự luận): chỉ đạo chưa xong +
   * mục cắm cờ theo dõi. Ca sau nhìn vào là biết phải làm gì.
   */
  const outstanding = useMemo(() => {
    const openOrders = entries.filter(
      (entry) => entry.kind === "Chỉ đạo" && entry.status !== "done" && !isRetracted(entry),
    );
    const flagged = entries.filter(
      (entry) => entry.followUp && !isRetracted(entry) && entry.kind !== "Bàn giao ca",
    );
    return { openOrders, flagged };
  }, [entries]);

  /** Bản dựng sẵn nội dung bàn giao từ dữ liệu thật (xong/dở/chỉ đạo/cờ). */
  const handoverAutoDraft = useMemo(() => {
    const inWindow = (value: string | null | undefined) => {
      if (!value) return false;
      const ms = parseOperationalDate(value);
      return Number.isFinite(ms) && ms >= shift.start.getTime() && ms < shift.end.getTime();
    };
    const doneTasks = store.tasks.filter(
      (item) => item.status === "Hoàn thành" && inWindow(item.completedAt ?? item.updatedAt),
    );
    const doneSos = store.sosRequests.filter(
      (item) => ["Đã xử lý", "Đã đóng"].includes(item.status) && inWindow(item.lastUpdatedAt),
    );
    const doneIncidents = store.incidents.filter(
      (item) => ["Đã kiểm soát", "Đã đóng"].includes(item.status) && inWindow(item.updatedAt),
    );
    const lines: string[] = [];
    lines.push("VIỆC XONG TRONG CA:");
    if (!doneTasks.length && !doneSos.length && !doneIncidents.length) lines.push("- Không có.");
    for (const item of doneTasks) lines.push(`- ${item.id}: ${item.title} (xong).`);
    for (const item of doneSos) lines.push(`- ${item.id} tại ${item.location.name} (${item.status}).`);
    for (const item of doneIncidents) lines.push(`- ${item.id}: ${item.title} (${item.status}).`);
    lines.push(
      `TỒN ĐỌNG: ${shiftSummary.sosOpen} SOS mở, ${shiftSummary.incidentOpen} sự cố mở, ` +
      `${shiftSummary.taskOverdue} nhiệm vụ quá hạn, ${shiftSummary.taskAwaiting} chờ xác nhận.`,
    );
    if (outstanding.openOrders.length) {
      lines.push("CHỈ ĐẠO CHƯA XONG:");
      for (const entry of outstanding.openOrders)
        lines.push(`- Mục ${seqById.get(entry.id) ?? "—"}: ${entry.text}`);
    }
    if (outstanding.flagged.length) {
      lines.push("CẦN THEO DÕI:");
      for (const entry of outstanding.flagged)
        lines.push(`- Mục ${seqById.get(entry.id) ?? "—"}: ${entry.text}`);
    }
    return lines.join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.tasks, store.sosRequests, store.incidents, outstanding, seqById, shift, shiftSummary]);

  useEffect(() => {
    if (handoverOpen) {
      setHandoverDraft(handoverAutoDraft);
      setHandoverStep(1);
    }
  }, [handoverOpen, handoverAutoDraft]);

  const linkCandidates = useMemo<LinkCandidate[]>(() => {
    const q = linkQuery.trim().toLowerCase();
    const all: LinkCandidate[] = [
      ...store.incidents.map((item) => ({
        kind: "incident" as const,
        id: item.id,
        code: item.id,
        title: item.title,
      })),
      ...store.sosRequests
        .filter((item) => !["Đã xử lý", "Đã đóng", "Từ chối", "Hủy"].includes(item.status))
        .map((item) => ({
          kind: "sos" as const,
          id: item.id,
          code: item.id,
          title: item.location.name,
        })),
      ...store.tasks
        .filter((item) => !["Hoàn thành", "Hủy"].includes(item.status))
        .map((item) => ({
          kind: "task" as const,
          id: item.id,
          code: item.id,
          title: item.title,
        })),
      ...store.teams.map((item) => ({
        kind: "team" as const,
        id: item.id,
        code: item.id,
        title: item.name,
      })),
      ...store.shelters.map((item) => ({
        kind: "shelter" as const,
        id: item.id,
        code: item.id,
        title: item.name,
      })),
    ];
    if (!q) return all.slice(0, 6);
    return all
      .filter((item) => `${item.code} ${item.title}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [store.incidents, store.sosRequests, store.tasks, store.teams, store.shelters, linkQuery]);

  const filtered = useMemo(() => {
    const byKind =
      filter === "Tất cả"
        ? entries
        : filter === "Ca này"
          ? entries.filter((entry) => inShift(entry.at))
          : entries.filter((entry) => entry.kind === filter);
    return showSystem ? byKind : byKind.filter((entry) => sourceOf(entry) === "manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, filter, showSystem, shift]);
  const visible = expanded ? filtered.slice(0, EXPANDED_LIMIT) : filtered.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = filtered.length - visible.length;

  const syncLabel =
    sync.state === "synced"
      ? `Đã đồng bộ${sync.lastSyncedAt ? ` · ${formatDutyTime(sync.lastSyncedAt)}` : ""}`
      : sync.state === "error"
        ? "Mất kết nối máy chủ — đang dùng bản lưu cục bộ"
        : "Chưa đồng bộ — bản ghi lưu trên máy này";

  if (!user) return null;
  const actor = user.displayName;
  const actorRole = roleLabels[user.role];
  const isOwn = (entry: DutyLogEntry) =>
    entry.actorId ? entry.actorId === user.id : entry.actor === actor;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (kind === "Chỉ đạo" && !canOrder) return;
    appendDutyEntry({
      actor,
      actorRole,
      actorId: user.id,
      kind,
      text: trimmed,
      ...(kind === "Chỉ đạo" ? { status: "open" as const } : {}),
      ...(linkSel ? { link: linkSel } : {}),
    });
    setText("");
    setLinkSel(null);
    setLinkQuery("");
    setLinkOpen(false);
  };

  const submitHandover = () => {
    const to = handoverTo.trim();
    if (!to || !canHandover) return;
    appendDutyEntry({
      actor,
      actorRole,
      actorId: user.id,
      kind: "Bàn giao ca",
      text: `Bàn giao ca cho ${to}.`,
      handover: { toName: to, pending: handoverDraft.trim() || "Không có việc tồn đọng được ghi nhận." },
    });
    setHandoverTo("");
    setHandoverDraft("");
    setHandoverOpen(false);
  };

  const exportText = () => {
    const today = new Date().toLocaleDateString("vi-VN");
    const lines = [
      `SỔ TRỰC BAN — ${shift.name} (${shift.range}), ngày ${today}`,
      `Kết xuất lúc ${new Date().toLocaleString("vi-VN")} · ${filtered.length} bản ghi · Lọc: ${filter}${showSystem ? "" : " (ẩn dòng hệ thống)"}`,
      "=".repeat(64),
    ];
    for (const entry of filtered) {
      lines.push(
        `[Mục ${seqById.get(entry.id) ?? "—"}] [${formatDutyTime(entry.at)}] [${entry.kind}]` +
        `[${sourceOf(entry) === "system" ? "Tự động" : "Người ghi"}] ${entry.actor} (${entry.actorRole})` +
        `${entry.link ? ` [${entry.link.code}]` : ""}` +
        `${entry.kind === "Chỉ đạo" ? (entry.status === "done" ? " [Đã xong]" : " [Chưa xong]") : ""}` +
        `${entry.taskId ? ` [NV ${entry.taskId}]` : ""}`,
        entry.text,
      );
      if (entry.handover) {
        lines.push(`Tồn đọng chuyển ca: ${entry.handover.pending}`);
        lines.push(
          entry.handover.receivedBy
            ? `Đã ký nhận: ${entry.handover.receivedBy} lúc ${formatDutyTime(entry.handover.receivedAt ?? "")}`
            : `Chưa ký nhận (chờ ${entry.handover.toName})`,
        );
      }
      lines.push("-".repeat(64));
    }
    const giver = lastHandover?.actor ?? "___";
    const receiver = lastHandover?.handover?.receivedBy ?? "___";
    lines.push(`Người giao ca: ${giver} · Người nhận ca: ${receiver} · Ngày ${today}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    anchor.href = url;
    anchor.download = `so-truc-ban-${stamp}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printLog = () => {
    document.body.classList.add("duty-printing");
    const cleanup = () => document.body.classList.remove("duty-printing");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 2000);
    window.print();
  };

  const taskOf = (taskId: string) => store.tasks.find((item) => item.id === taskId);

  return (
    <section id="so-truc-ban" className="cc-panel duty-log" aria-labelledby="duty-log-title">
      <div className="cc-panel-header">
        <div>
          <span id="duty-log-title">
            <ClipboardList size={14} /> Sổ trực ban
          </span>
          <small>{shiftLine}</small>
        </div>
        <div className="duty-head-actions">
          <button
            type="button"
            className={`duty-sys-toggle${showSystem ? " active" : ""}`}
            onClick={() => setShowSystem((value) => !value)}
            title="Các thao tác nghiệp vụ được máy tự ghi vào sổ — bấm để ẩn/hiện"
          >
            {showSystem ? <Eye size={12} /> : <EyeOff size={12} />}
            Bản ghi tự động
          </button>
          {canHandover ? (
            <button type="button" onClick={() => setHandoverOpen((open) => !open)}>
              <LogIn size={13} />
              {handoverOpen ? "Đóng" : "Bàn giao ca"}
            </button>
          ) : (
            <button type="button" disabled title="Vai trò của bạn không giữ ca trực nên không bàn giao ca">
              <LogIn size={13} /> Bàn giao ca
            </button>
          )}
          <button type="button" onClick={exportText} title="Tải sổ dạng văn bản (.txt)">
            <Download size={13} /> Tải .txt
          </button>
          <button type="button" onClick={printLog} title="In sổ trực ban">
            <Printer size={13} /> In
          </button>
        </div>
      </div>

      <div className="duty-shift-summary" aria-label="Tình hình ca trực">
        <div>
          <b>Phát sinh trong ca</b>
          <span>{shiftSummary.sosNew} SOS mới</span>
          <span>{shiftSummary.incidentNew} sự cố mới</span>
          <span>{shiftSummary.taskDone} nhiệm vụ xong</span>
          <span>{shiftSummary.orders} chỉ đạo đã ghi</span>
        </div>
      </div>

      {(outstanding.openOrders.length > 0 || outstanding.flagged.length > 0) && (
        <div className="duty-outstanding" aria-label="Việc dở dang">
          <b>
            Việc dở dang ({outstanding.openOrders.length + outstanding.flagged.length})
          </b>
          <ul>
            {outstanding.openOrders.map((entry) => (
              <li key={entry.id}>
                <span className="duty-kind">Chỉ đạo</span>
                <span className="duty-out-text">{entry.text}</span>
                {canOrder && !entry.taskId ? (
                  <button type="button" onClick={() => navigate(`/tasks?fromDuty=${entry.id}`)} title="Mở form tạo nhiệm vụ với nội dung điền sẵn từ chỉ đạo này">
                    <ListTodo size={12} /> Thành nhiệm vụ
                  </button>
                ) : null}
                {entry.taskId ? (
                  <button type="button" className="duty-link" onClick={() => navigate(`/tasks/${entry.taskId}`)}>
                    {entry.taskId} · {taskOf(entry.taskId)?.status ?? "?"}
                  </button>
                ) : null}
              </li>
            ))}
            {outstanding.flagged.map((entry) => (
              <li key={entry.id}>
                <span className="duty-kind">Theo dõi</span>
                <span className="duty-out-text">{entry.text}</span>
                <button type="button" onClick={() => toggleDutyFollowUp(entry.id)} title="Bỏ cờ theo dõi">
                  <Flag size={12} /> Bỏ cờ
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {handoverOpen && canHandover && (
        <div className="duty-handover">
          {handoverStep === 1 ? (
            <>
              <b className="duty-wizard-title">Bước 1/2 — Nội dung bàn giao (máy dựng sẵn, bạn chốt lại)</b>
              <div className="duty-wizard-auto">
                <span>{shiftSummary.taskDone + shiftSummary.sosNew + shiftSummary.incidentNew} phát sinh</span>
                <span>{shiftSummary.sosOpen + shiftSummary.incidentOpen + shiftSummary.taskOverdue} tồn đọng</span>
                <span>{outstanding.openOrders.length} chỉ đạo chưa xong</span>
                <span>{outstanding.flagged.length} mục cắm cờ</span>
              </div>
              <textarea
                value={handoverDraft}
                onChange={(event) => setHandoverDraft(event.target.value)}
                rows={6}
                aria-label="Nội dung bàn giao"
              />
              <button className="duty-primary" onClick={() => setHandoverStep(2)}>
                Tiếp tục: chọn người nhận
              </button>
            </>
          ) : (
            <>
              <b className="duty-wizard-title">Bước 2/2 — Chốt người nhận ca</b>
              <label>
                <span>Bàn giao cho</span>
                <input
                  value={handoverTo}
                  onChange={(event) => setHandoverTo(event.target.value)}
                  placeholder="Họ tên người nhận ca"
                />
              </label>
              <div className="duty-wizard-actions">
                <button type="button" onClick={() => setHandoverStep(1)}>Quay lại</button>
                <button className="duty-primary" onClick={submitHandover} disabled={!handoverTo.trim()}>
                  Xác nhận bàn giao
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="duty-compose">
        <div className="duty-kinds" role="group" aria-label="Loại bản ghi">
          {KINDS.map((item) => {
            const locked = item === "Chỉ đạo" && !canOrder;
            return (
              <button
                key={item}
                className={kind === item ? "active" : ""}
                onClick={() => !locked && setKind(item)}
                type="button"
                disabled={locked}
                title={locked ? "Vai trò của bạn chỉ được Ghi nhận, không ra Chỉ đạo" : undefined}
              >
                {item}
              </button>
            );
          })}
        </div>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder={
            kind === "Chỉ đạo"
              ? "Thêm mục chỉ đạo mới vào sổ trực…"
              : "Thêm mục mới vào sổ trực: diễn biến, thông tin nhận được…"
          }
          aria-label="Nội dung mục sổ trực ban"
        />
        <button
          type="button"
          className={`duty-link-toggle${linkSel ? " attached" : ""}`}
          onClick={() => setLinkOpen((open) => !open)}
          title="Gắn bản ghi với một sự cố / SOS / nhiệm vụ / đội / điểm sơ tán"
        >
          <Link2 size={13} /> {linkSel ? linkSel.code : "Gắn mã"}
        </button>
        <button className="duty-primary" onClick={submit} disabled={!text.trim()}>
          <PenLine size={13} /> Thêm mục
        </button>
      </div>

      {linkOpen && (
        <div className="duty-linkbox">
          {linkSel ? (
            <span className="duty-linksel">
              Đang gắn: <b>{linkSel.code}</b>
              <button
                type="button"
                onClick={() => {
                  setLinkSel(null);
                  setLinkQuery("");
                }}
                aria-label="Bỏ liên kết"
              >
                <X size={12} />
              </button>
            </span>
          ) : (
            <>
              <input
                value={linkQuery}
                onChange={(event) => setLinkQuery(event.target.value)}
                placeholder="Tìm mã hoặc tên sự cố / SOS / nhiệm vụ / đội / điểm…"
                aria-label="Tìm hồ sơ để gắn"
              />
              <ul>
                {linkCandidates.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkSel({ kind: item.kind, id: item.id, code: item.code });
                        setLinkOpen(false);
                      }}
                    >
                      <b>{item.code}</b> <span>{item.title}</span>
                    </button>
                  </li>
                ))}
                {!linkCandidates.length && <li className="duty-linkbox-empty">Không tìm thấy hồ sơ phù hợp.</li>}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="duty-toolbar">
        <div className="duty-filters" role="group" aria-label="Lọc theo loại bản ghi">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "active" : ""}
              onClick={() => {
                setFilter(item);
                setExpanded(false);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <span className={`duty-sync state-${sync.state}`} title={syncLabel}>
          <i aria-hidden="true" />
          {syncLabel}
        </span>
      </div>

      <ol className="duty-entries">
        {(() => {
          const nodes: ReactNode[] = [];
          let lastDay = "";
          for (const entry of visible) {
            const day = formatDutyDay(entry.at);
            if (day && day !== lastDay) {
              lastDay = day;
              nodes.push(
                <li key={`day-${day}-${entry.id}`} className="duty-day" aria-hidden="true">
                  <span>{day}</span>
                </li>,
              );
            }
            const seq = seqById.get(entry.id);
            const sys = sourceOf(entry) === "system";
            const handover = entry.kind === "Bàn giao ca" ? entry.handover : undefined;
            const received = handover?.receivedBy
              ? `Đã ký nhận: ${handover.receivedBy} lúc ${formatDutyTime(handover.receivedAt ?? "")}`
              : null;
            const canConfirm = !!handover && !handover.receivedBy && !isOwn(entry) && canHandover;
            const isOrder = entry.kind === "Chỉ đạo";
            const orderDone = entry.status === "done";
            const linkedTask = entry.taskId ? taskOf(entry.taskId) : undefined;
            const expandedOpen = expandedId === entry.id;
            nodes.push(
              <li key={entry.id} className={`duty-entry kind-${kindClass(entry.kind)}${sys ? " is-sys" : ""}${orderDone ? " is-done" : ""}`}>
                <span className="duty-seq" title={`Mục ${seq ?? "—"} trong ngày`}>
                  {seq ?? "—"}
                </span>
                <time>{formatDutyClock(entry.at)}</time>
                <div className="duty-entry-main">
                  <div className="duty-entry-top">
                    <span className="duty-kind">{entry.kind}</span>
                    {sys ? <span className="duty-sysbadge" title="Máy tự ghi sau thao tác nghiệp vụ">Tự động</span> : null}
                    {isOrder ? (
                      <span className={`duty-order-state ${orderDone ? "done" : "open"}`}>
                        {orderDone ? "Đã xong" : "Chưa xong"}
                      </span>
                    ) : null}
                    {entry.link ? (
                      <button
                        type="button"
                        className="duty-link"
                        onClick={() => navigate(linkPath(entry.link!))}
                        title="Mở hồ sơ liên quan"
                      >
                        {entry.link.code}
                      </button>
                    ) : null}
                    {entry.followUp ? <Flag size={11} className="duty-flag-on" aria-label="Đang cắm cờ theo dõi" /> : null}
                  </div>
                  <button
                    type="button"
                    className="duty-text-toggle"
                    onClick={() => setExpandedId(expandedOpen ? null : entry.id)}
                    title="Bấm để xem chi tiết bản ghi"
                  >
                    <p>{entry.text}</p>
                  </button>
                  {handover ? <p className="duty-pending">Tồn đọng: {handover.pending}</p> : null}
                  {received ? <p className="duty-received">{received}</p> : null}
                  {handover && !handover.receivedBy ? (
                    <p className="duty-awaiting">Chờ {handover.toName} ký nhận ca.</p>
                  ) : null}
                  {linkedTask ? (
                    <button
                      type="button"
                      className="duty-taskchip"
                      onClick={() => navigate(`/tasks/${linkedTask.id}`)}
                      title="Mở nhiệm vụ tạo từ chỉ đạo này"
                    >
                      <ListTodo size={11} /> {linkedTask.id} · {linkedTask.status} · {linkedTask.progress}%
                    </button>
                  ) : null}
                  <small>
                    {entry.actor} · {entry.actorRole}
                  </small>
                  {expandedOpen ? (
                    <dl className="duty-detail">
                      <div><dt>Giờ ghi</dt><dd>{formatDutyTime(entry.at)}</dd></div>
                      <div><dt>Nguồn</dt><dd>{sys ? "Tự động (máy ghi sau thao tác)" : "Người trực ghi tay"}</dd></div>
                      <div><dt>Ca</dt><dd>{entry.shiftRef ?? "—"}</dd></div>
                      <div><dt>Mã mục</dt><dd>{entry.id}</dd></div>
                      {entry.link ? <div><dt>Hồ sơ</dt><dd>{entry.link.code}</dd></div> : null}
                      {entry.taskId ? <div><dt>Nhiệm vụ</dt><dd>{entry.taskId}</dd></div> : null}
                    </dl>
                  ) : null}
                  <div className="duty-row-actions">
                    {isOrder && !orderDone && !entry.taskId && canOrder && !isRetracted(entry) ? (
                      <button
                        type="button"
                        className="duty-order-btn"
                        onClick={() => navigate(`/tasks?fromDuty=${entry.id}`)}
                        title="Mở form tạo nhiệm vụ với nội dung điền sẵn từ chỉ đạo này"
                      >
                        <ListTodo size={12} /> Thành nhiệm vụ
                      </button>
                    ) : null}
                    {isOrder && !orderDone && canOrder && !isRetracted(entry) ? (
                      <button
                        type="button"
                        className="duty-order-btn"
                        onClick={() => markDutyEntryDone(entry.id)}
                        title="Đánh dấu chỉ đạo đã hoàn tất (không qua nhiệm vụ)"
                      >
                        <CheckCheck size={12} /> Đánh dấu xong
                      </button>
                    ) : null}
                    {!sys && !isRetracted(entry) ? (
                      <button
                        type="button"
                        className={`duty-order-btn${entry.followUp ? " flagged" : ""}`}
                        onClick={() => toggleDutyFollowUp(entry.id)}
                        title={entry.followUp ? "Bỏ cờ theo dõi" : "Cắm cờ để ca sau theo dõi"}
                      >
                        <Flag size={12} /> {entry.followUp ? "Bỏ cờ" : "Cắm cờ"}
                      </button>
                    ) : null}
                    {canConfirm ? (
                      <button
                        type="button"
                        className="duty-confirm"
                        onClick={() => confirmDutyHandover(entry.id, actor)}
                      >
                        <CheckCheck size={12} /> Xác nhận đã nhận ca
                      </button>
                    ) : null}
                  </div>
                </div>
                {!sys && !isRetracted(entry) && isOwn(entry) ? (
                  <button
                    className="duty-retract"
                    title="Thu hồi bản ghi (vẫn lưu dấu vết)"
                    onClick={() => retractDutyEntry(entry.id, actor)}
                  >
                    <Undo2 size={12} />
                  </button>
                ) : null}
                {isOwn(entry) ? (
                  <button
                    className={`duty-delete${confirmDeleteId === entry.id ? " arming" : ""}`}
                    title={
                      confirmDeleteId === entry.id
                        ? "Bấm lần nữa để xóa vĩnh viễn bản ghi của bạn"
                        : "Xóa vĩnh viễn bản ghi do chính bạn tạo"
                    }
                    onClick={() => {
                      if (confirmDeleteId === entry.id) {
                        deleteDutyEntry(entry.id, user.id);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(entry.id);
                        window.setTimeout(
                          () => setConfirmDeleteId((cur) => (cur === entry.id ? null : cur)),
                          3000,
                        );
                      }
                    }}
                  >
                    <Trash2 size={12} />
                    {confirmDeleteId === entry.id ? <span>Xóa?</span> : null}
                  </button>
                ) : null}
              </li>,
            );
          }
          return nodes;
        })()}
        {!filtered.length && (
          <li className="duty-empty">
            {filter === "Tất cả"
              ? "Chưa có bản ghi nào trong ca trực này. Mọi diễn biến và chỉ đạo nên được ghi lại để ca sau tiếp nhận."
              : `Chưa có bản ghi loại "${filter}".`}
          </li>
        )}
      </ol>

      {filtered.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          className="duty-expand"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Thu gọn" : `Xem thêm ${hiddenCount} bản ghi`}
        </button>
      )}

      <p className="duty-note">
        Sổ dùng chung giữa các điểm trực qua máy chủ (tự động làm mới) — bản lưu trên máy này giữ
        lại để tra cứu khi mất mạng; thu hồi khi ngoại tuyến sẽ được đẩy bù khi có mạng trở lại.
        Dòng “Tự động” do máy ghi sau mỗi thao tác, không sửa/xóa được.
      </p>

      {typeof document !== "undefined" &&
        createPortal(
          <div className="duty-print-sheet" aria-hidden="true">
            <h1>SỔ TRỰC BAN</h1>
            <p>
              {shift.name} ({shift.range}) · Ngày {new Date().toLocaleDateString("vi-VN")} ·{" "}
              {filtered.length} bản ghi · Lọc: {filter}
              {showSystem ? "" : " (ẩn dòng hệ thống)"}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Mục</th>
                  <th>Giờ</th>
                  <th>Loại</th>
                  <th>Nguồn</th>
                  <th>Nội dung</th>
                  <th>Người ghi</th>
                  <th>Liên quan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td>{seqById.get(entry.id) ?? "—"}</td>
                    <td>{formatDutyTime(entry.at)}</td>
                    <td>{entry.kind}{entry.kind === "Chỉ đạo" ? (entry.status === "done" ? " (xong)" : " (chưa)") : ""}</td>
                    <td>{sourceOf(entry) === "system" ? "Tự động" : "Người ghi"}</td>
                    <td>
                      {entry.text}
                      {entry.handover ? <div>Tồn đọng: {entry.handover.pending}</div> : null}
                    </td>
                    <td>
                      {entry.actor} ({entry.actorRole})
                    </td>
                    <td>{entry.link ? entry.link.code : ""}{entry.taskId ? ` ${entry.taskId}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="duty-sign">
              <div>
                <span>Người giao ca</span>
                <b>{lastHandover?.actor ?? "___"}</b>
              </div>
              <div>
                <span>Người nhận ca</span>
                <b>{lastHandover?.handover?.receivedBy ?? "___"}</b>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
