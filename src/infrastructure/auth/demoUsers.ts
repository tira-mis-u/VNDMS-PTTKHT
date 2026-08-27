import { PERSONNEL, personName } from "../../data/identity/personnel";
import type { AuthCredential, AuthUser } from "../../domain/auth/types";

const now = "21/08/2026 08:00";

export const demoUsers: AuthUser[] = [
  {
    id: "USR-CMD-001",
    displayName: personName(PERSONNEL.COMMANDER.id),
    username: "thuantq",
    role: PERSONNEL.COMMANDER.role,
    geographicScope: { ...PERSONNEL.COMMANDER.geographicScope! },
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-OPS-001",
    displayName: personName(PERSONNEL.OPERATOR.id),
    username: "nguyentrung",
    role: PERSONNEL.OPERATOR.role,
    geographicScope: { ...PERSONNEL.OPERATOR.geographicScope! },
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-LOC-001",
    displayName: personName(PERSONNEL.LOCAL_OFFICER.id),
    username: "phamdam",
    role: PERSONNEL.LOCAL_OFFICER.role,
    geographicScope: { ...PERSONNEL.LOCAL_OFFICER.geographicScope! },
    active: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-RSL-001",
    displayName: personName(PERSONNEL.RESCUE_LEADER.id),
    username: "phamhieu",
    role: PERSONNEL.RESCUE_LEADER.role,
    geographicScope: { ...PERSONNEL.RESCUE_LEADER.geographicScope! },
    active: true,
    teamId: "CH-05",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-RSM-001",
    displayName: personName(PERSONNEL.RESCUE_MEMBER.id),
    username: "minhtri",
    role: PERSONNEL.RESCUE_MEMBER.role,
    geographicScope: { ...PERSONNEL.RESCUE_MEMBER.geographicScope! },
    active: true,
    teamId: "CH-05",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-WHS-001",
    displayName: personName(PERSONNEL.WAREHOUSE_STAFF.id),
    username: "namanh",
    role: PERSONNEL.WAREHOUSE_STAFF.role,
    geographicScope: { ...PERSONNEL.WAREHOUSE_STAFF.geographicScope! },
    active: true,
    warehouseId: "KHO-01",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "USR-CTZ-001",
    displayName: "Trần Thái Tuấn",
    username: "trantuan",
    role: "citizen",
    geographicScope: { level: "national", code: "VN", name: "Toàn quốc" },
    active: true,
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
