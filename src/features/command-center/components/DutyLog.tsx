import { useEffect, useMemo, useState } from "react";
import { ClipboardList, LogIn, Send, Undo2 } from "lucide-react";
import {
  appendDutyEntry,
  formatDutyTime,
  retractDutyEntry,
  subscribeDutyLog,
  type DutyEntryKind,
  type DutyLogEntry,
} from "@/infrastructure/duty/dutyLogStore";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { roleLabels } from "@/domain/auth/labels";

const KINDS: DutyEntryKind[] = ["Ghi nhận", "Chỉ đạo"];

/**
 * Sổ trực ban của phòng chỉ huy: ghi nhận diễn biến, ghi chỉ đạo và bàn giao
 * ca. Khác với "Nhật ký bảo mật" (audit kỹ thuật của hệ thống), đây là nhật
 * ký nghiệp vụ do người trực chủ động ghi.
 */
export function DutyLog() {
  const store = useOperationalState();
  const user = store.currentUser;
  const [entries, setEntries] = useState<DutyLogEntry[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<DutyEntryKind>("Ghi nhận");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverTo, setHandoverTo] = useState("");
  const [handoverPending, setHandoverPending] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeDutyLog(setEntries);
    return () => {
      unsubscribe();
    };
  }, []);

  const lastHandover = useMemo(
    () => entries.find((entry) => entry.kind === "Bàn giao ca"),
    [entries],
  );

  if (!user) return null;
  const actor = user.displayName;
  const actorRole = roleLabels[user.role];

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    appendDutyEntry({ actor, actorRole, kind, text: trimmed });
    setText("");
  };

  const submitHandover = () => {
    const to = handoverTo.trim();
    if (!to) return;
    appendDutyEntry({
      actor,
      actorRole,
      kind: "Bàn giao ca",
      text: `Bàn giao ca cho ${to}.`,
      handover: { toName: to, pending: handoverPending.trim() || "Không có việc tồn đọng được ghi nhận." },
    });
    setHandoverTo("");
    setHandoverPending("");
    setHandoverOpen(false);
  };

  return (
    <section className="cc-panel duty-log" aria-labelledby="duty-log-title">
      <div className="cc-panel-header">
        <div>
          <span id="duty-log-title">
            <ClipboardList size={14} /> Nhật ký trực ban
          </span>
          <small>
            {lastHandover
              ? `Ca hiện tại nhận từ ${lastHandover.actor} lúc ${formatDutyTime(lastHandover.at)}`
              : "Ghi nhận diễn biến, chỉ đạo và bàn giao ca của kíp trực"}
          </small>
        </div>
        <button onClick={() => setHandoverOpen((open) => !open)}>
          <LogIn size={13} />
          {handoverOpen ? "Đóng" : "Bàn giao ca"}
        </button>
      </div>

      {handoverOpen && (
        <div className="duty-handover">
          <label>
            <span>Bàn giao cho</span>
            <input
              value={handoverTo}
              onChange={(event) => setHandoverTo(event.target.value)}
              placeholder="Họ tên người nhận ca"
            />
          </label>
          <label>
            <span>Việc tồn đọng chuyển ca sau</span>
            <textarea
              value={handoverPending}
              onChange={(event) => setHandoverPending(event.target.value)}
              rows={2}
              placeholder="Ví dụ: SOS-0142 chưa xác minh; đội CH-03 đang trên đường tới Nam Đàn."
            />
          </label>
          <button className="duty-primary" onClick={submitHandover} disabled={!handoverTo.trim()}>
            Xác nhận bàn giao
          </button>
        </div>
      )}

      <div className="duty-compose">
        <div className="duty-kinds" role="group" aria-label="Loại bản ghi">
          {KINDS.map((item) => (
            <button
              key={item}
              className={kind === item ? "active" : ""}
              onClick={() => setKind(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder={
            kind === "Chỉ đạo"
              ? "Nội dung chỉ đạo của người có thẩm quyền…"
              : "Diễn biến, thông tin nhận được, kết quả kiểm tra…"
          }
          aria-label="Nội dung bản ghi trực ban"
        />
        <button className="duty-primary" onClick={submit} disabled={!text.trim()}>
          <Send size={13} /> Ghi
        </button>
      </div>

      <ol className="duty-entries">
        {entries.slice(0, 8).map((entry) => (
          <li key={entry.id} className={`duty-entry kind-${entry.kind === "Chỉ đạo" ? "order" : entry.kind === "Bàn giao ca" ? "handover" : "note"}`}>
            <time>{formatDutyTime(entry.at)}</time>
            <div>
              <p>
                <b>{entry.kind}</b> · {entry.text}
              </p>
              {entry.handover ? <p className="duty-pending">Tồn đọng: {entry.handover.pending}</p> : null}
              <small>
                {entry.actor} · {entry.actorRole}
              </small>
            </div>
            {!entry.text.startsWith("[Đã thu hồi") && entry.actor === actor ? (
              <button
                className="duty-retract"
                title="Thu hồi bản ghi (vẫn lưu dấu vết)"
                onClick={() => retractDutyEntry(entry.id, actor)}
              >
                <Undo2 size={12} />
              </button>
            ) : null}
          </li>
        ))}
        {!entries.length && (
          <li className="duty-empty">
            Chưa có bản ghi nào trong ca trực này. Mọi diễn biến và chỉ đạo nên được ghi lại để ca
            sau tiếp nhận.
          </li>
        )}
      </ol>

      <p className="duty-note">
        Bản ghi lưu trên thiết bị đang trực (chưa đồng bộ nhiều điểm trực) — dùng cho kíp trực tại
        chỗ; khi hệ thống có máy chủ nghiệp vụ sẽ đồng bộ tập trung và ký số theo phiên trực.
      </p>
    </section>
  );
}
