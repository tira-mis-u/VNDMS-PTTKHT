import type { AuditGateway } from "../../application/auth/authContracts";
import type { SecurityAuditEvent } from "../../domain/auth/types";
import type { StorageLike } from "./localAuthenticationAdapter";
import { supabase, isSupabaseConfigured } from "../supabase/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

const KEY = "vndms.security.audit.v1";
const MAX_AUDIT_LOGS = 500;

export function auditEventToRow(event: SecurityAuditEvent): Record<string, unknown> {
  return {
    id: event.id,
    timestamp: event.timestamp,
    actor_id: event.actorId ?? null,
    actor_name: event.actorName,
    role: event.role ?? null,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId ?? null,
    geographic_scope: event.geographicScope || "Toàn quốc",
    result: event.result,
    reason: event.reason,
    permission: event.permission ?? null,
  };
}

export function rowToAuditEvent(row: any): SecurityAuditEvent {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: String(row.actor_name || "Hệ thống"),
    role: row.role ?? null,
    action: row.action as any,
    resourceType: String(row.resource_type),
    resourceId: row.resource_id ? String(row.resource_id) : null,
    geographicScope: String(row.geographic_scope || "Toàn quốc"),
    result: row.result as any,
    reason: String(row.reason || ""),
    permission: row.permission ?? undefined,
  };
}

export class SupabaseAuditAdapter implements AuditGateway {
  private storage: StorageLike;
  private realtimeChannel: RealtimeChannel | null = null;
  private onRemoteEventCallback?: (event: SecurityAuditEvent) => void;

  constructor(storage: StorageLike) {
    this.storage = storage;
  }

  load(): SecurityAuditEvent[] {
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SecurityAuditEvent[]) : [];
    } catch {
      return [];
    }
  }

  append(event: SecurityAuditEvent): void {
    // 1. Lưu ngay vào bộ nhớ đệm thiết bị để UI phản hồi tức thì
    const events = [event, ...this.load().filter((e) => e.id !== event.id)].slice(0, MAX_AUDIT_LOGS);
    try {
      this.storage.setItem(KEY, JSON.stringify(events));
    } catch {
      // storage quota
    }

    // 2. Đẩy nền lên Supabase Cloud dùng chung
    if (isSupabaseConfigured && supabase) {
      const row = auditEventToRow(event);
      void (async () => {
        try {
          await supabase.from("security_audit_logs").insert(row);
        } catch {
          // Không throw: nhật ký không bao giờ được làm gãy luồng tác vụ
        }
      })();
    }
  }

  replace(events: SecurityAuditEvent[]): void {
    try {
      this.storage.setItem(KEY, JSON.stringify(events.slice(0, MAX_AUDIT_LOGS)));
    } catch {
      // storage quota
    }
  }

  /**
   * Kéo toàn bộ nhật ký an ninh dùng chung từ Supabase Cloud về và hợp nhất
   */
  async fetchRemote(): Promise<SecurityAuditEvent[]> {
    if (!isSupabaseConfigured || !supabase) {
      return this.load();
    }

    try {
      const { data, error } = await supabase
        .from("security_audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(200);

      if (!error && Array.isArray(data)) {
        const remoteEvents = data.map(rowToAuditEvent);
        const localEvents = this.load();

        const map = new Map<string, SecurityAuditEvent>();
        for (const ev of localEvents) {
          if (ev?.id) map.set(ev.id, ev);
        }
        for (const ev of remoteEvents) {
          if (ev?.id) map.set(ev.id, ev);
        }

        const merged = [...map.values()]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, MAX_AUDIT_LOGS);

        this.replace(merged);
        return merged;
      }
    } catch {
      // fallback về local
    }

    return this.load();
  }

  /**
   * Lắng nghe Realtime thay đổi từ các máy/tài khoản khác
   */
  subscribeRealtime(onEvent: (event: SecurityAuditEvent) => void): () => void {
    this.onRemoteEventCallback = onEvent;
    if (typeof window === "undefined" || !isSupabaseConfigured || !supabase || this.realtimeChannel) {
      return () => this.unsubscribeRealtime();
    }

    try {
      this.realtimeChannel = supabase
        .channel("vndms_security_audit_realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "security_audit_logs" },
          (payload: any) => {
            if (payload?.new) {
              const event = rowToAuditEvent(payload.new);
              const current = this.load();
              if (!current.some((e) => e.id === event.id)) {
                this.replace([event, ...current]);
                this.onRemoteEventCallback?.(event);
              }
            }
          },
        )
        .subscribe();
    } catch {
      // ignore
    }

    return () => this.unsubscribeRealtime();
  }

  unsubscribeRealtime(): void {
    if (this.realtimeChannel && supabase) {
      try {
        supabase.removeChannel(this.realtimeChannel);
      } catch {
        // ignore
      }
      this.realtimeChannel = null;
    }
  }
}

export const createAuditAdapter = (storage?: StorageLike): SupabaseAuditAdapter =>
  new SupabaseAuditAdapter(
    storage ?? (typeof window !== "undefined" ? window.localStorage : ({} as StorageLike)),
  );
