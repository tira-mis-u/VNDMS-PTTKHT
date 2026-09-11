import { Select as UiSelect } from "@/components/ui/Select";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  ListTodo,
  MapPin,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { TaskPriority } from "@/domain/tasks/types";
import { isTaskOverdue, taskPriorityRank } from "@/domain/tasks/rules";
import { useOperationalState } from "@/state/operations/OperationalStateContext";
import { DialogBackdrop, Badge, Button, PageSectionHeader, Progress, Input, Textarea } from "@/components/ui";
import { getDutyLog, linkDutyEntryToTask } from "@/infrastructure/duty/dutyLogStore";

const tabs = [
  "Tất cả",
  "Chờ giao",
  "Đã giao",
  "Đã tiếp nhận",
  "Đang thực hiện",
  "Chờ xác nhận",
  "Hoàn thành",
];
const priorityTone = (value: string) =>
  value === "Khẩn cấp"
    ? "red"
    : value === "Cao"
      ? "amber"
      : value === "Thấp"
        ? "neutral"
        : "blue";
const statusTone = (value: string) =>
  value === "Hoàn thành"
    ? "green"
    : value === "Đang thực hiện" || value === "Chờ xác nhận"
      ? "blue"
      : value === "Chờ giao"
        ? "neutral"
        : "amber";
export function TaskListPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { tasks, incidents, teams, createTask, can } = useOperationalState();
  const [tab, setTab] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("Tất cả ưu tiên");
  const [team, setTeam] = useState("Tất cả đội");
  const [open, setOpen] = useState(false);
  /**
   * Tạo nhiệm vụ TỪ MỘT MỤC CHỈ ĐẠO trong sổ trực ban (?fromDuty=DUTY-...):
   * mở sẵn form, điền tiêu đề theo nội dung chỉ đạo; tạo xong thì gắn link
   * 2 chiều duty↔task và đánh dấu chỉ đạo đã xong.
   */
  const [dutyEntryId, setDutyEntryId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("fromDuty"),
  );
  const dutyPrefillTitle = useMemo(() => {
    if (!dutyEntryId) return "";
    const entry = getDutyLog().find((item) => item.id === dutyEntryId);
    if (!entry) return "";
    const firstLine = entry.text.split("\n")[0].trim();
    return firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine;
  }, [dutyEntryId]);
  useEffect(() => {
    if (dutyEntryId) setOpen(true);
  }, [dutyEntryId]);
  // TINH GIẢN dropdown (4→2): bỏ "Sự cố" + "Khu vực" — tên sự cố mẹ và địa
  // bàn đã gộp vào ô tìm kiếm; trang chi tiết sự cố vẫn liệt kê nhiệm vụ của
  // nó. Chỉ giữ Ưu tiên + Đội (2 câu hỏi lọc thật sự khác nhau).
  const incidentTitle = (incidentId: string) =>
    incidents.find((item) => item.id === incidentId)?.title ?? "";
  const filtered = useMemo(
    () =>
      tasks
        .filter((task) => {
          const q = search.toLowerCase();
          return (
            (tab === "Tất cả" || task.status === tab) &&
            (!q ||
              `${task.id} ${task.title} ${task.location} ${incidentTitle(task.incidentId)}`
                .toLowerCase()
                .includes(q)) &&
            (priority === "Tất cả ưu tiên" || task.priority === priority) &&
            (team === "Tất cả đội" || task.teamId === team)
          );
        })
        .sort(
          (a, b) =>
            Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) ||
            taskPriorityRank[b.priority] - taskPriorityRank[a.priority],
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, tab, search, priority, team, incidents],
  );
  return (
    <div className="workspace-content tasks-page">
      <PageSectionHeader
        section="Ứng phó"
        title="Nhiệm vụ"
        description="Quản lý, giao việc và theo dõi tiến độ tác chiến tại hiện trường."
        icon={ListTodo}
        actions={
          can("task_create") ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Tạo nhiệm vụ
            </Button>
          ) : undefined
        }
      />
      <div className="task-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
            {item === "Tất cả" && <span>{tasks.length}</span>}
          </button>
        ))}
      </div>
      <section className="task-worklist">
        <div className="task-filters">
          <label className="ui-search incident-search">
            <Search size={15} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã, tên nhiệm vụ, tên sự cố hoặc khu vực…"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <TaskSelect
            value={priority}
            setValue={setPriority}
            options={[
              "Tất cả ưu tiên",
              "Khẩn cấp",
              "Cao",
              "Trung bình",
              "Thấp",
            ]}
          />
          <TaskSelect
            value={team}
            setValue={setTeam}
            options={[
              "Tất cả đội",
              ...teams.map((t) => ({
                value: t.id,
                label: `${t.id} — ${t.name}`,
              })),
            ]}
          />
          <span className="filter-chip" aria-label="Phạm vi thời gian 24 giờ gần nhất">
            <CalendarDays size={14} />
            24 giờ gần nhất
          </span>
        </div>
        <div className="incident-result-bar">
          <span>
            <b>{filtered.length}</b> nhiệm vụ phù hợp
          </span>
          <span>Sắp xếp theo quá hạn và mức ưu tiên</span>
        </div>
        <div className="task-list-table">
          <div className="task-list-head">
            <span>Nhiệm vụ</span>
            <span>Sự cố liên quan</span>
            <span>Ưu tiên</span>
            <span>Đội thực hiện</span>
            <span>Trạng thái</span>
            <span>Tiến độ</span>
            <span>Hạn xử lý</span>
            <span />
          </div>
          {filtered.map((task) => {
            const overdue = isTaskOverdue(task);
            const linked = incidents.find((i) => i.id === task.incidentId);
            return (
              <button
                className="task-list-row"
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <span className="task-primary">
                  <b>{task.title}</b>
                  <small>
                    {task.id} · {task.type}
                  </small>
                </span>
                <span className="task-incident">
                  <b>{task.incidentId}</b>
                  <small>{linked?.title ?? "Yêu cầu vận hành"}</small>
                </span>
                <span>
                  <Badge tone={priorityTone(task.priority)}>
                    {task.priority}
                  </Badge>
                </span>
                <span className="task-team">{task.teamId || "Chưa giao"}</span>
                <span>
                  <Badge tone={statusTone(task.status)}>{task.status}</Badge>
                </span>
                <span className="task-row-progress">
                  <b>{task.progress}%</b>
                  <Progress
                    value={task.progress}
                    tone={task.progress === 100 ? "green" : "blue"}
                  />
                </span>
                <span className={`task-deadline ${overdue ? "overdue" : ""}`}>
                  <Clock3 size={12} />
                  <b>{task.dueAt.split(" ")[1]}</b>
                  <small>
                    {overdue ? "Quá hạn" : task.dueAt.split(" ")[0]}
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      </section>
      {open && (
        <CreateTaskDialog
          initialTitle={dutyPrefillTitle}
          dutySource={dutyEntryId ? (getDutyLog().find((item) => item.id === dutyEntryId)?.text ?? "") : ""}
          onClose={() => {
            setOpen(false);
            setDutyEntryId(null);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("fromDuty");
              window.history.replaceState({}, "", url.pathname + url.search);
            }
          }}
          onCreate={(data) => {
            const id = createTask(data);
            if (dutyEntryId) linkDutyEntryToTask(dutyEntryId, id);
            setDutyEntryId(null);
            setOpen(false);
            navigate(`/tasks/${id}`);
          }}
        />
      )}
    </div>
  );
}
export type TaskFilterOption = string | { value: string; label: string };

function TaskSelect({
  value,
  setValue,
  options,
}: {
  value: string;
  setValue: (value: string) => void;
  options: TaskFilterOption[];
}) {
  const first = options[0];
  return (
    <label className="filter-select">
      <UiSelect
        aria-label={typeof first === "string" ? first : first.label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {options.map((option) =>
          typeof option === "string" ? (
            <option key={option}>{option}</option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </UiSelect>
    </label>
  );
}
function CreateTaskDialog({
  onClose,
  onCreate,
  initialTitle,
  dutySource,
}: {
  onClose: () => void;
  initialTitle?: string;
  dutySource?: string;
  onCreate: (data: {
    incidentId: string;
    title: string;
    type: string;
    priority: TaskPriority;
    teamId: string;
    assignee: string;
    location: string;
    dueAt: string;
    description: string;
  }) => void;
}) {
  const { incidents, teams } = useOperationalState();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [type, setType] = useState("Cứu hộ");
  const [incidentId, setIncident] = useState(incidents[0]?.id ?? "");
  const [priority, setPriority] = useState<TaskPriority>("Cao");
  const [teamId, setTeam] = useState("");
  const [location, setLocation] = useState(incidents[0]?.location.name ?? "");
  const [dueAt, setDue] = useState("21/08/2026 12:00");
  const [description, setDescription] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title || !incidentId) return;
    onCreate({
      incidentId,
      title,
      type,
      priority,
      teamId,
      assignee: "",
      location,
      dueAt,
      description,
    });
  };
  return (
    <>
      <DialogBackdrop onClick={onClose} />
      <form className="incident-form-dialog" onSubmit={submit}>
        <header>
          <div>
            <small>Điều hành tác chiến</small>
            <h2>Tạo nhiệm vụ mới</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="incident-form-body">
          {dutySource ? (
            <p className="duty-source-banner" title={dutySource}>
              Tạo từ mục chỉ đạo trong sổ trực ban: “{dutySource.length > 120 ? `${dutySource.slice(0, 120)}…` : dutySource}”
            </p>
          ) : null}
          <label className="field field-full">
            <span>Tên nhiệm vụ *</span>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mô tả ngắn gọn công việc tác chiến"
            />
          </label>
          <label className="field">
            <span>Loại nhiệm vụ</span>
            <UiSelect value={type} onChange={(e) => setType(e.target.value)}>
              {[
                "Cứu hộ",
                "Sơ tán",
                "Vận chuyển",
                "Khảo sát hiện trường",
                "Cứu trợ",
                "Kiểm tra tuyến đường",
                "Hỗ trợ y tế",
              ].map((v) => (
                <option value={v} key={v}>
                  {v}
                </option>
              ))}
            </UiSelect>
          </label>
          <label className="field">
            <span>Sự cố liên quan *</span>
            <UiSelect
              value={incidentId}
              onChange={(e) => {
                setIncident(e.target.value);
                const i = incidents.find((x) => x.id === e.target.value);
                if (i) setLocation(i.location.name);
              }}
            >
              {incidents
                .filter((i) => i.status !== "Đã đóng")
                .map((i) => (
                  <option value={i.id} key={i.id}>
                    {i.id} — {i.title}
                  </option>
                ))}
            </UiSelect>
          </label>
          <label className="field">
            <span>Mức ưu tiên</span>
            <UiSelect
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="Khẩn cấp">Khẩn cấp</option>
              <option value="Cao">Cao</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Thấp">Thấp</option>
            </UiSelect>
          </label>
          <label className="field">
            <span>Đội thực hiện</span>
            <UiSelect value={teamId} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Chưa giao</option>
              {teams.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.id} — {t.status}
                </option>
              ))}
            </UiSelect>
          </label>
          <label className="field field-full">
            <span>Địa điểm</span>
            <div className="input-with-icon">
              <MapPin size={14} />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Hạn xử lý</span>
            <Input value={dueAt} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="field field-full">
            <span>Mô tả</span>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <footer>
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={!title || !incidentId}>
            Tạo nhiệm vụ
          </Button>
        </footer>
      </form>
    </>
  );
}
