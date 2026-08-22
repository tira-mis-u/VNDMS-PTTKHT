import type { AuditGateway } from "../../application/auth/authContracts";
import type { SecurityAuditEvent } from "../../domain/auth/types";
import type { StorageLike } from "./localAuthenticationAdapter";
const KEY = "vndms.security.audit.v1";
export class LocalAuditAdapter implements AuditGateway {
  private storage: StorageLike;
  constructor(storage: StorageLike) {
    this.storage = storage;
  }
  load() {
    try {
      const value = JSON.parse(this.storage.getItem(KEY) ?? "[]");
      return Array.isArray(value) ? (value as SecurityAuditEvent[]) : [];
    } catch {
      return [];
    }
  }
  append(event: SecurityAuditEvent) {
    const events = [event, ...this.load()].slice(0, 500);
    this.storage.setItem(KEY, JSON.stringify(events));
  }
  replace(events: SecurityAuditEvent[]) {
    this.storage.setItem(KEY, JSON.stringify(events.slice(0, 500)));
  }
}
export const browserAuditAdapter = () =>
  new LocalAuditAdapter(window.localStorage);
