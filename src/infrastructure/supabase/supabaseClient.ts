import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser, GeographicScope } from "@/domain/auth/types";

function normalizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();

  // Nếu người dùng dán chuỗi postgresql://...db.<project-id>.supabase.co...
  if (trimmed.startsWith("postgresql://") || trimmed.startsWith("postgres://")) {
    const match = trimmed.match(/db\.([a-z0-9]+)\.supabase\.co/i);
    if (match && match[1]) {
      return `https://${match[1]}.supabase.co`;
    }
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return "";
}

const rawSupabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim();
export const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project-id")
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Interface cho bảng profiles trong Supabase
 */
export interface SupabaseProfileRow {
  id: string;
  username: string;
  display_name: string;
  role: string;
  scope_level: string;
  scope_name: string;
  scope_code: string;
  active: boolean;
  team_id?: string | null;
  warehouse_id?: string | null;
  organization?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Chuyển đổi SupabaseProfileRow sang domain AuthUser
 */
export function toAuthUser(row: SupabaseProfileRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as AuthUser["role"],
    geographicScope: {
      level: row.scope_level as GeographicScope["level"],
      name: row.scope_name,
      code: row.scope_code,
    },
    active: row.active ?? true,
    teamId: row.team_id ?? undefined,
    warehouseId: row.warehouse_id ?? undefined,
    organization: row.organization ?? undefined,
    phone: row.phone ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Chuyển đổi domain AuthUser sang SupabaseProfileRow
 */
export function toProfileRow(user: AuthUser): SupabaseProfileRow {
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    role: user.role,
    scope_level: user.geographicScope.level,
    scope_name: user.geographicScope.name,
    scope_code: user.geographicScope.code,
    active: user.active,
    team_id: user.teamId ?? null,
    warehouse_id: user.warehouseId ?? null,
    organization: user.organization ?? null,
    phone: user.phone ?? null,
    created_at: user.createdAt,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Lấy danh sách toàn bộ người dùng từ Supabase profiles table
 */
export async function fetchSupabaseUsers(): Promise<AuthUser[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[VNDMS/Supabase] Lỗi khi tải profiles:", error.message);
      return null;
    }

    return (data as SupabaseProfileRow[]).map(toAuthUser);
  } catch (err) {
    console.error("[VNDMS/Supabase] Exception fetchSupabaseUsers:", err);
    return null;
  }
}

/**
 * Đồng bộ hoặc cập nhật hồ sơ người dùng lên Supabase
 */
export async function upsertSupabaseProfile(user: AuthUser): Promise<boolean> {
  if (!supabase) return false;
  try {
    const row = toProfileRow(user);
    const { error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "id" });

    if (error) {
      console.error("[VNDMS/Supabase] Lỗi upsert profile:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[VNDMS/Supabase] Exception upsertSupabaseProfile:", err);
    return false;
  }
}

/**
 * Cập nhật phân quyền / phạm vi địa lý cho người dùng trên Supabase
 */
export async function updateSupabaseUserRoleAndScopes(
  userId: string,
  role: AuthUser["role"],
  geographicScope: GeographicScope
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        role,
        scope_level: geographicScope.level,
        scope_name: geographicScope.name,
        scope_code: geographicScope.code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("[VNDMS/Supabase] Lỗi cập nhật quyền:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[VNDMS/Supabase] Exception updateSupabaseUserRoleAndScopes:", err);
    return false;
  }
}
