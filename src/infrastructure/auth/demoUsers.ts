import type { AuthCredential, AuthUser } from "../../domain/auth/types";

const now = "21/08/2026 08:00";

export const demoUsers: AuthUser[] = [
  {
    id: "USR-CMD-001",
    displayName: "Trần Quốc Thuận",
    username: "Trần Quốc Thuận",
    role: "commander",
    geographicScope: { level: "national", name: "Toàn quốc", code: "VN" },
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-OPS-001",
    displayName: "Nguyễn Quốc Trung",
    username: "Nguyễn Quốc Trung",
    role: "operator",
    geographicScope: { level: "national", name: "Toàn quốc", code: "VN" },
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-LOC-001",
    displayName: "Phạm Văn Đam",
    username: "Phạm Văn Đam",
    role: "local_officer",
    geographicScope: {
      level: "district",
      name: "Tây Hồ, Hà Nội",
      code: "HN-TAYHO",
    },
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-RSL-001",
    displayName: "Phạm Trung Hiếu",
    username: "Phạm Trung Hiếu",
    role: "rescue_leader",
    geographicScope: { level: "province", name: "Hà Nội", code: "HN" },
    active: true,
    teamId: "CH-05",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-RSM-001",
    displayName: "Lê Nguyễn Minh Trí",
    username: "Lê Nguyễn Minh Trí",
    role: "rescue_member",
    geographicScope: { level: "province", name: "Hà Nội", code: "HN" },
    active: true,
    teamId: "CH-05",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-WHS-001",
    displayName: "Nguyễn Nam Anh",
    username: "Nguyễn Nam Anh",
    role: "warehouse_staff",
    geographicScope: {
      level: "warehouse",
      name: "Hoàn Kiếm, Hà Nội",
      code: "KHO-01",
    },
    active: true,
    warehouseId: "KHO-01",
    createdAt: now,
    updatedAt: now,
  },
];

const DEMO_PASSWORD_HASH =
  "a6778192b58b6263212f166afeec676b38bac8e00100f97f57a1e21904619c92";

export const demoCredentials: AuthCredential[] = demoUsers.map((user) => ({
  userId: user.id,
  passwordHash: DEMO_PASSWORD_HASH,
}));
