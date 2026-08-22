import type { UserRole } from "../../domain/shared/auth";

export type Permission =
  | "view"
  | "create"
  | "dispatch"
  | "severity"
  | "update"
  | "close"
  | "update_progress"
  | "task_view"
  | "task_create"
  | "task_assign"
  | "task_accept"
  | "task_start"
  | "task_update"
  | "task_complete"
  | "task_cancel"
  | "team_view"
  | "team_create"
  | "team_edit"
  | "team_assign"
  | "team_update_status"
  | "team_update_location"
  | "team_manage_members"
  | "shelter_view"
  | "shelter_create"
  | "shelter_update"
  | "shelter_open"
  | "shelter_close"
  | "shelter_manage_capacity"
  | "evacuation_view"
  | "evacuation_create"
  | "evacuation_approve"
  | "evacuation_assign"
  | "evacuation_update"
  | "evacuation_complete"
  | "evacuation_cancel"
  | "sos_view"
  | "sos_create"
  | "sos_verify"
  | "sos_update"
  | "sos_triage"
  | "sos_assign_incident"
  | "sos_create_task"
  | "sos_dispatch"
  | "sos_update_field"
  | "sos_resolve"
  | "sos_close"
  | "sos_cancel"
  | "relief_view"
  | "relief_create"
  | "relief_approve"
  | "relief_reserve"
  | "relief_dispatch"
  | "relief_receive"
  | "relief_cancel"
  | "warehouse_view"
  | "warehouse_update"
  | "warehouse_adjust_stock"
  | "warehouse_close"
  | "shipment_view"
  | "shipment_update"
  | "playbook_view"
  | "playbook_edit"
  | "playbook_publish"
  | "playbook_activate"
  | "playbook_execute"
  | "playbook_override"
  | "playbook_cancel"
  | "damage_assessment_view"
  | "damage_assessment_create"
  | "damage_assessment_edit"
  | "damage_assessment_submit"
  | "damage_assessment_verify"
  | "damage_assessment_reject"
  | "recovery_project_view"
  | "recovery_project_create"
  | "recovery_project_approve"
  | "recovery_project_execute"
  | "recovery_project_cancel"
  | "simulation_view"
  | "simulation_control"
  | "ai_assistant_use"
  | "user_manage"
  | "alert_view"
  | "alert_acknowledge"
  | "audit_view";

export const permissionMatrix: Record<UserRole, readonly Permission[]> = {
  commander: [
    "view",
    "create",
    "dispatch",
    "severity",
    "update",
    "close",
    "task_view",
    "task_create",
    "task_assign",
    "task_accept",
    "task_start",
    "task_update",
    "task_complete",
    "task_cancel",
    "team_view",
    "team_create",
    "team_edit",
    "team_assign",
    "team_update_status",
    "team_update_location",
    "team_manage_members",
    "shelter_view",
    "shelter_create",
    "shelter_update",
    "shelter_open",
    "shelter_close",
    "shelter_manage_capacity",
    "evacuation_view",
    "evacuation_create",
    "evacuation_approve",
    "evacuation_assign",
    "evacuation_update",
    "evacuation_complete",
    "evacuation_cancel",
    "sos_view",
    "sos_create",
    "sos_verify",
    "sos_update",
    "sos_triage",
    "sos_assign_incident",
    "sos_create_task",
    "sos_dispatch",
    "sos_update_field",
    "sos_resolve",
    "sos_close",
    "sos_cancel",
    "relief_view",
    "relief_create",
    "relief_approve",
    "relief_reserve",
    "relief_dispatch",
    "relief_receive",
    "relief_cancel",
    "warehouse_view",
    "warehouse_update",
    "warehouse_adjust_stock",
    "warehouse_close",
    "shipment_view",
    "shipment_update",
    "playbook_view",
    "playbook_edit",
    "playbook_publish",
    "playbook_activate",
    "playbook_execute",
    "playbook_override",
    "playbook_cancel",
    "alert_view",
    "alert_acknowledge",
    "damage_assessment_view",
    "damage_assessment_create",
    "damage_assessment_edit",
    "damage_assessment_submit",
    "damage_assessment_verify",
    "damage_assessment_reject",
    "recovery_project_view",
    "recovery_project_create",
    "recovery_project_approve",
    "recovery_project_execute",
    "recovery_project_cancel",
    "simulation_view",
    "simulation_control",
    "ai_assistant_use",
    "user_manage",
    "audit_view",
  ],
  operator: [
    "view",
    "create",
    "dispatch",
    "update",
    "task_view",
    "task_create",
    "task_assign",
    "task_update",
    "team_view",
    "team_edit",
    "team_assign",
    "team_update_status",
    "team_update_location",
    "shelter_view",
    "shelter_update",
    "shelter_open",
    "shelter_close",
    "shelter_manage_capacity",
    "evacuation_view",
    "evacuation_create",
    "evacuation_assign",
    "evacuation_update",
    "evacuation_complete",
    "evacuation_cancel",
    "sos_view",
    "sos_create",
    "sos_verify",
    "sos_update",
    "sos_triage",
    "sos_assign_incident",
    "sos_create_task",
    "sos_dispatch",
    "sos_update_field",
    "sos_resolve",
    "sos_close",
    "sos_cancel",
    "relief_view",
    "relief_create",
    "relief_approve",
    "relief_reserve",
    "relief_dispatch",
    "relief_receive",
    "relief_cancel",
    "warehouse_view",
    "warehouse_update",
    "warehouse_adjust_stock",
    "warehouse_close",
    "shipment_view",
    "shipment_update",
    "playbook_view",
    "playbook_activate",
    "playbook_execute",
    "playbook_cancel",
    "alert_view",
    "alert_acknowledge",
    "damage_assessment_view",
    "damage_assessment_create",
    "damage_assessment_edit",
    "damage_assessment_submit",
    "damage_assessment_verify",
    "damage_assessment_reject",
    "recovery_project_view",
    "recovery_project_create",
    "recovery_project_execute",
    "recovery_project_cancel",
    "simulation_view",
    "simulation_control",
    "ai_assistant_use",
    "audit_view",
  ],
  local_officer: [
    "view",
    "update",
    "task_view",
    "task_create",
    "task_update",
    "team_view",
    "team_update_location",
    "shelter_view",
    "shelter_update",
    "shelter_manage_capacity",
    "evacuation_view",
    "evacuation_create",
    "evacuation_update",
    "sos_view",
    "sos_create",
    "sos_verify",
    "sos_update",
    "sos_triage",
    "sos_assign_incident",
    "sos_update_field",
    "sos_resolve",
    "relief_view",
    "relief_create",
    "relief_receive",
    "warehouse_view",
    "shipment_view",
    "playbook_view",
    "playbook_execute",
    "alert_view",
    "alert_acknowledge",
    "damage_assessment_view",
    "damage_assessment_create",
    "damage_assessment_edit",
    "damage_assessment_submit",
    "recovery_project_view",
    "recovery_project_create",
    "recovery_project_execute",
    "simulation_view",
    "ai_assistant_use",
  ],
  rescue_leader: [
    "view",
    "update_progress",
    "task_view",
    "task_accept",
    "task_start",
    "task_update",
    "task_complete",
    "team_view",
    "team_update_status",
    "team_update_location",
    "team_manage_members",
    "shelter_view",
    "evacuation_view",
    "evacuation_update",
    "evacuation_complete",
    "sos_view",
    "sos_update_field",
    "sos_resolve",
    "relief_view",
    "relief_receive",
    "warehouse_view",
    "shipment_view",
    "shipment_update",
    "playbook_view",
    "playbook_execute",
    "alert_view",
    "alert_acknowledge",
    "damage_assessment_view",
    "recovery_project_view",
    "recovery_project_execute",
    "simulation_view",
    "ai_assistant_use",
  ],
  rescue_member: [
    "task_view",
    "task_update",
    "team_view",
    "team_update_location",
    "shelter_view",
    "evacuation_view",
    "sos_view",
    "sos_update_field",
    "relief_view",
    "shipment_view",
    "shipment_update",
    "playbook_view",
    "alert_view",
    "damage_assessment_view",
    "recovery_project_view",
    "simulation_view",
    "ai_assistant_use",
  ],
  warehouse_staff: [
    "relief_view",
    "relief_reserve",
    "relief_dispatch",
    "relief_receive",
    "warehouse_view",
    "warehouse_update",
    "warehouse_adjust_stock",
    "shipment_view",
    "shipment_update",
    "alert_view",
    "alert_acknowledge",
    "ai_assistant_use",
  ],
  relief_worker: [
    "view",
    "task_view",
    "team_view",
    "shelter_view",
    "evacuation_view",
    "sos_view",
    "relief_view",
    "relief_create",
    "relief_receive",
    "warehouse_view",
    "shipment_view",
    "shipment_update",
    "damage_assessment_view",
    "recovery_project_view",
    "alert_view",
    "ai_assistant_use",
  ],
  citizen: ["sos_create"],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return permissionMatrix[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission))
    throw new Error("Bạn không có quyền thực hiện thao tác này.");
}
