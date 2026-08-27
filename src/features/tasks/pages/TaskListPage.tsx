import { Select as UiSelect } from "@/components/ui/Select";
import { useMemo, useState, type FormEvent } from "react";
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

const tabs = [
  "Tất cả",
  "Chờ giao",
  "Đã giao",
  "Đã tiếp nhận",
  "Đang thực hiện",
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
    : value === "Đang thực hiện"
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
  const [incident, setIncident] = useState("Tất cả sự cố");
  const [area, setArea] = useState("Tất cả khu vực");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(
    () =>
      tasks
        .filter((task) => {
          const q = search.toLowerCase();
          return (
            (tab === "Tất cả" || task.status === tab) &&
            (!q ||
              `${task.id} ${task.title} ${task.location}`
                .toLowerCase()
                .includes(q)) &&
            (priority === "Tất cả ưu tiên" || task.priority === priority) &&
            (team === "Tất cả đội" || task.teamId === team) &&
            (incident === "Tất cả sự cố" || task.incidentId === incident) &&
            (area === "Tất cả khu vực" || task.location.includes(area))
          );
        })
        .sort(
          (a, b) =>
            Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) ||
            taskPriorityRank[b.priority] - taskPriorityRank[a.priority],
        ),
    [tasks, tab, search, priority, team, incident, area],
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
              placeholder="Tìm mã, tên nhiệm vụ hoặc khu vực…"
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
            options={["Tất cả đội", ...teams.map((t) => t.id)]}
          />
          <TaskSelect
            value={incident}
            setValue={setIncident}
            options={["Tất cả sự cố", ...incidents.map((i) => i.id)]}
          />
          <TaskSelect
            value={area}
            setValue={setArea}
            options={[
              "Tất cả khu vực",
              "Tây Hồ",
              "Hoàn Kiếm",
              "Long Biên",
              "Ba Đình",
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
          onClose={() => setOpen(false)}
          onCreate={(data) => {
            const id = createTask(data);
            setOpen(false);
            navigate(`/tasks/${id}`);
          }}
        />
      )}
    </div>
  );
}
function TaskSelect({
  value,
  setValue,
  options,
}: {
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="filter-select">
      <UiSelect
        aria-label={options[0]}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </UiSelect>
    </label>
  );
}
function CreateTaskDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
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
  const [title, setTitle] = useState("");
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
