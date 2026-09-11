import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Search, Users, X } from "lucide-react";

/** Ứng viên được chia sẻ định vị: tìm theo họ tên hoặc tên đăng nhập. */
export interface BeaconCandidate {
  id: string;
  username: string;
  displayName: string;
  detail: string;
  role: string;
  roleLabel: string;
}

/** Thứ tự nhóm vai trò trong hộp chọn nhanh. */
const ROLE_ORDER = ["rescue_unit", "disaster_officer", "admin", "citizen"];

/**
 * Modal chỉ định ai được thấy định vị realtime — mở ra khi bấm nút
 * "Phát định vị". Chỉ tài khoản tác nghiệp (cứu hộ, cán bộ, quản trị) được
 * tick chọn mới thấy; công dân không nhận định vị của người khác.
 * Tick nhanh cả nhóm vai trò, hoặc tìm theo
 * họ tên / tên đăng nhập rồi tick từng người. Khi beacon đang bật, modal
 * cho đổi phạm vi hoặc tắt hẳn.
 */
export function BeaconScopeModal({
  isActive,
  initialScope,
  candidates,
  quickSelectRoles,
  onSave,
  onTurnOff,
  onClose,
}: {
  isActive: boolean;
  initialScope: string[] | null;
  candidates: BeaconCandidate[];
  /** undefined = mọi nhóm vai trò; mảng = chỉ các nhóm đó (công dân). */
  quickSelectRoles?: string[];
  onSave: (scope: string[] | null) => void;
  onTurnOff: () => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initialScope ?? []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  /**
   * Thanh cuộn RIÊNG của khung chọn người — luôn nhìn thấy được, không phụ
   * thuộc chế độ thanh cuộn của hệ điều hành (nhiều máy để overlay nên thanh
   * cuộn native tự ẩn, người dùng không biết vùng này cuộn được).
   */
  const listRef = useRef<HTMLUListElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0 });
  const dragging = useRef<{ startY: number; startTop: number } | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const syncThumb = useCallback(() => {
    const el = listRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const trackH = track.clientHeight;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ top: 0, height: trackH });
      return;
    }
    const height = Math.max(24, (clientHeight / scrollHeight) * trackH);
    const top = (scrollTop / (scrollHeight - clientHeight)) * (trackH - height);
    setThumb({ top, height });
  }, []);

  useEffect(() => {
    syncThumb();
    window.addEventListener("resize", syncThumb);
    return () => window.removeEventListener("resize", syncThumb);
  }, [syncThumb, candidates.length, query]);

  const scrollable = (() => {
    const el = listRef.current;
    return !!el && el.scrollHeight > el.clientHeight + 1;
  })();

  const onThumbPointerDown = (event: React.PointerEvent) => {
    const el = listRef.current;
    if (!el || !scrollable) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    dragging.current = { startY: event.clientY, startTop: el.scrollTop };
    event.preventDefault();
    event.stopPropagation();
  };
  const onThumbPointerMove = (event: React.PointerEvent) => {
    const drag = dragging.current;
    const el = listRef.current;
    const track = trackRef.current;
    if (!drag || !el || !track) return;
    const trackH = track.clientHeight;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, trackH - thumb.height);
    el.scrollTop = drag.startTop + (event.clientY - drag.startY) * ratio;
  };
  const endDrag = () => {
    dragging.current = null;
  };
  const onTrackClick = (event: React.MouseEvent) => {
    const el = listRef.current;
    const track = trackRef.current;
    if (!el || !track || !scrollable) return;
    const rect = track.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  };

  const groups = useMemo(() => {
    const byRole = new Map<string, BeaconCandidate[]>();
    for (const item of candidates) {
      const list = byRole.get(item.role) ?? [];
      list.push(item);
      byRole.set(item.role, list);
    }
    return [...byRole.entries()]
      .map(([role, members]) => ({
        role,
        roleLabel: members[0]?.roleLabel ?? role,
        members,
      }))
      .sort((a, b) => {
        const orderA = ROLE_ORDER.indexOf(a.role);
        const orderB = ROLE_ORDER.indexOf(b.role);
        if (orderA !== -1 || orderB !== -1)
          return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
        return a.roleLabel.localeCompare(b.roleLabel, "vi");
      });
  }, [candidates]);

  /** Công dân chỉ chọn nhanh 2 nhóm cán bộ PCTT + cứu hộ; lực lượng thấy đủ nhóm. */
  const visibleGroups = useMemo(
    () =>
      quickSelectRoles
        ? groups.filter((group) => quickSelectRoles.includes(group.role))
        : groups,
    [groups, quickSelectRoles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (item) =>
        item.displayName.toLowerCase().includes(q) ||
        item.username.toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const pickedSet = useMemo(() => new Set(picked), [picked]);

  const toggle = (id: string) => {
    setError("");
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  /** Tick cả nhóm vai trò: chưa đủ thì thêm hết, đủ rồi thì bỏ hết. */
  const toggleGroup = (members: BeaconCandidate[]) => {
    setError("");
    setPicked((current) => {
      const ids = members.map((item) => item.id);
      const allPicked = ids.every((id) => current.includes(id));
      if (allPicked) return current.filter((id) => !ids.includes(id));
      return [...current, ...ids.filter((id) => !current.includes(id))];
    });
  };

  const save = () => {
    if (picked.length === 0) {
      setError("Hãy chọn ít nhất 1 người được thấy định vị của bạn.");
      return;
    }
    onSave(picked);
  };

  return (
    <div className="tracking-modal-backdrop" onClick={onClose}>
      <div
        className="tracking-modal-content beacon-scope-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Chỉ định người được thấy định vị"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tracking-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={20} color="#16a34a" />
            <h3>{isActive ? "Phạm vi chia sẻ định vị" : "Bật phát định vị — ai được thấy bạn?"}</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="tracking-modal-body">
          <p className="beacon-scope-note">
            {quickSelectRoles
              ? "Chia sẻ định vị cho từng người cụ thể (kể cả công dân khác) hoặc chọn nhanh cả nhóm Cán bộ PCTT / Đơn vị cứu hộ — không có lựa chọn \"Tất cả công dân\". Bạn luôn thấy vị trí của chính mình."
              : "Vị trí realtime của bạn hiển thị trên Bản đồ tác nghiệp cho những người được tick dưới đây — tick nhanh cả nhóm vai trò (kể cả Tất cả công dân) hoặc chọn từng người. Bạn luôn thấy vị trí của chính mình."}
          </p>

          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {visibleGroups.length > 0 && (
            <div className="beacon-scope-groups" aria-label="Chọn nhanh theo vai trò">
              <span className="beacon-scope-sub">Chọn nhanh theo vai trò</span>
              {visibleGroups.map((group) => {
                const pickedCount = group.members.filter((item) =>
                  pickedSet.has(item.id),
                ).length;
                const allPicked =
                  pickedCount === group.members.length && group.members.length > 0;
                return (
                  <label key={group.role} className="beacon-scope-group">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            pickedCount > 0 && !allPicked;
                      }}
                      onChange={() => toggleGroup(group.members)}
                    />
                    <span>
                      <b>{group.role === "citizen" ? "Tất cả công dân" : group.roleLabel}</b>
                      <small>
                        {pickedCount}/{group.members.length} người
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {picked.length > 0 && (
            <div className="beacon-scope-chips" aria-label="Đã chọn">
              {picked.map((id) => {
                const person = candidates.find((item) => item.id === id);
                if (!person) return null;
                return (
                  <span key={id} className="beacon-scope-chip">
                    {person.displayName}
                    <button type="button" onClick={() => toggle(id)} aria-label={`Bỏ ${person.displayName}`}>
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
              <small>
                {picked.length} người được thấy định vị của bạn
              </small>
            </div>
          )}

          <span className="beacon-scope-sub">Chọn từng người</span>
          <div className="beacon-scope-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm họ tên hoặc tên đăng nhập…"
              aria-label="Tìm người được chia sẻ định vị"
            />
          </div>

          <div className="beacon-scope-scrollwrap">
          <ul
            className="beacon-scope-list beacon-scope-list-custom"
            ref={listRef}
            tabIndex={0}
            onScroll={syncThumb}
            aria-label="Danh sách người được chia sẻ định vị"
          >
            {filtered.map((person) => (
              <li key={person.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={pickedSet.has(person.id)}
                    onChange={() => toggle(person.id)}
                  />
                  <span>
                    <b>{person.displayName}</b> <i>@{person.username}</i>
                    <small>
                      {person.detail
                        ? `${person.roleLabel} · ${person.detail}`
                        : person.roleLabel}
                    </small>
                  </span>
                </label>
              </li>
            ))}
            {!filtered.length && (
              <li className="beacon-scope-empty">Không tìm thấy tài khoản phù hợp.</li>
            )}
          </ul>
            <div
              ref={trackRef}
              className="beacon-scope-track"
              onClick={onTrackClick}
              aria-hidden="true"
            >
              <div
                className="beacon-scope-thumb"
                style={{ top: thumb.top, height: thumb.height }}
                onPointerDown={onThumbPointerDown}
                onPointerMove={onThumbPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            </div>
          </div>
        </div>

        <footer className="tracking-modal-footer beacon-scope-footer">
          {isActive && (
            <button type="button" className="btn btn-md btn-danger" onClick={onTurnOff}>
              Tắt phát định vị
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-md btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn-md btn-primary" onClick={save}>
            {isActive ? "Lưu phạm vi" : "Bật phát định vị"}
          </button>
        </footer>
      </div>
    </div>
  );
}
