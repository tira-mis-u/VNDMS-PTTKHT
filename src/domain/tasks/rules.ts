import type { IncidentTask, TaskPriority, TaskStatus } from "./types";

export const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  "Chờ giao": ["Đã giao", "Đã hủy"],
  "Đã giao": ["Đã tiếp nhận", "Đã hủy"],
  "Đã tiếp nhận": ["Đang thực hiện"],
  "Đang thực hiện": ["Hoàn thành", "Đã hủy"],
  "Hoàn thành": [],
  "Đã hủy": [],
};

export const taskPriorityRank: Record<TaskPriority, number> = {
  "Khẩn cấp": 4,
  Cao: 3,
  "Trung bình": 2,
  Thấp: 1,
};
export const demoCurrentTime = new Date("2026-08-21T10:45:00+07:00");

export function parseVietnameseDate(value: string) {
  const [date, time] = value.split(" ");
  const [day, month, year] = date.split("/").map(Number);
  const [hour, minute] = (time ?? "00:00").split(":").map(Number);
  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+07:00`,
  );
}

export function isTaskOverdue(task: IncidentTask) {
  return (
    !["Hoàn thành", "Đã hủy"].includes(task.status) &&
    parseVietnameseDate(task.dueAt).getTime() < demoCurrentTime.getTime()
  );
}

export function calculateIncidentProgress(tasks: IncidentTask[]) {
  if (!tasks.length) return null;
  const active = tasks.filter((task) => task.status !== "Đã hủy");
  if (!active.length) return 0;
  return Math.round(
    active.reduce((sum, task) => sum + task.progress, 0) / active.length,
  );
}

export function getValidTransitions(status: TaskStatus) {
  return taskTransitions[status];
}
