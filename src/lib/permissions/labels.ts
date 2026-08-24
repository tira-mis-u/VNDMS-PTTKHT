import type { Permission } from "./permissions";

const resources = [
  ["damage_assessment", "đánh giá thiệt hại"],
  ["recovery_project", "dự án phục hồi"],
  ["ai_assistant", "trợ lý AI"],
  ["task", "nhiệm vụ"],
  ["team", "đội cứu hộ"],
  ["shelter", "điểm sơ tán"],
  ["evacuation", "hoạt động sơ tán"],
  ["sos", "yêu cầu SOS"],
  ["relief", "cứu trợ"],
  ["warehouse", "kho vật tư"],
  ["shipment", "chuyến hàng"],
  ["playbook", "phương án ứng phó"],
  ["simulation", "mô phỏng"],
  ["alert", "cảnh báo"],
  ["user", "tài khoản"],
  ["audit", "nhật ký hệ thống"],
] as const;
const actions: Record<string, string> = {
  view: "Xem",
  create: "Tạo",
  edit: "Chỉnh sửa",
  assign: "Phân công",
  accept: "Tiếp nhận",
  start: "Bắt đầu",
  update: "Cập nhật",
  update_progress: "Cập nhật tiến độ",
  update_status: "Cập nhật trạng thái",
  update_location: "Cập nhật vị trí",
  update_field: "Cập nhật hiện trường",
  complete: "Hoàn thành",
  open: "Mở",
  close: "Đóng",
  cancel: "Hủy",
  manage_members: "Quản lý thành viên",
  manage_capacity: "Quản lý sức chứa",
  approve: "Phê duyệt",
  verify: "Xác minh",
  reject: "Từ chối",
  triage: "Phân loại ưu tiên",
  assign_incident: "Gắn với sự cố",
  create_task: "Tạo nhiệm vụ",
  dispatch: "Điều phối",
  resolve: "Xử lý hoàn tất",
  reserve: "Phân bổ",
  receive: "Tiếp nhận",
  adjust_stock: "Điều chỉnh tồn kho",
  publish: "Công bố",
  activate: "Kích hoạt",
  execute: "Thực hiện",
  override: "Phê duyệt ngoại lệ",
  submit: "Gửi thẩm định",
  control: "Điều khiển",
  use: "Sử dụng",
  manage: "Quản lý",
  acknowledge: "Xác nhận",
};
const direct: Partial<Record<Permission, string>> = {
  view: "Xem dữ liệu vận hành",
  create: "Tạo sự cố",
  dispatch: "Điều phối lực lượng",
  severity: "Cập nhật mức độ sự cố",
  update: "Cập nhật sự cố",
  close: "Đóng sự cố",
  update_progress: "Cập nhật tiến độ",
};

export function permissionLabel(permission: Permission) {
  if (direct[permission]) return direct[permission];
  const resource = resources.find(([prefix]) =>
    permission.startsWith(`${prefix}_`),
  );
  if (!resource) return "Quyền nghiệp vụ";
  const action = permission.slice(resource[0].length + 1);
  return `${actions[action] ?? "Thao tác"} ${resource[1]}`;
}
