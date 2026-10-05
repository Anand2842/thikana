import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "broker" | "seeker";

// Roles live in auth.users app_metadata: { role: "admin"|"broker"|"seeker", broker_id?: "B1" }.
// Assign via Supabase dashboard (Authentication → Users) or SQL in README.
// Hierarchy: admin can access everything; broker can access broker routes.

function readClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only check — session refresh happens in middleware.
        },
      },
    }
  );
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const sb = readClient(await cookies());
    const { data } = await sb.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export function userRole(user: User | null): Role {
  const r = (user?.app_metadata as { role?: unknown } | undefined)?.role;
  return r === "admin" || r === "broker" ? r : "seeker";
}

export function userBrokerId(user: User | null): string | null {
  const id = (user?.app_metadata as { broker_id?: unknown } | undefined)?.broker_id;
  return typeof id === "string" && id ? id : null;
}

export function canAccess(role: Role, required: Role): boolean {
  if (role === "admin") return true;
  if (required === "broker") return role === "broker";
  return true; // required === "seeker": any signed-in user
}
