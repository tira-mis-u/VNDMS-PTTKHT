import type {
  AuthUser,
  Session,
  SessionValidation,
} from "../../domain/auth/types";
export interface AuthenticationGateway {
  authenticate(
    username: string,
    password: string,
  ): Promise<{ user: AuthUser; session: Session }>;
  register(
    input: import("../../domain/auth/types").RegisterInput,
  ): Promise<{ user: AuthUser; session: Session }>;
  restoreSession(): SessionValidation;
  logout(sessionId?: string): void;
  listUsers(): AuthUser[];
  saveUsers(users: AuthUser[]): void;
}
export interface AuditGateway {
  load(): import("../../domain/auth/types").SecurityAuditEvent[];
  append(event: import("../../domain/auth/types").SecurityAuditEvent): void;
  replace(events: import("../../domain/auth/types").SecurityAuditEvent[]): void;
}
