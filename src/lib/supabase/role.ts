import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "broker" | "seeker";

// Roles live in auth.users app_metadata: { role: "admin"|"broker"|"seeker", broker_id?: "B1" }.
// Assign via Supabase dashboard (Authentication → Users) or SQL in README.
// Hierarchy: admin can access everything; broker can access broker routes.

export async function getSessionUser(): Promise<User | null> {
  try {
    const sb = await createClient();
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
  const id = (user?.app_metadata as { broker_id?: unknown } | undefined)
    ?.broker_id;
  return typeof id === "string" && id ? id : null;
}

// Authenticator Assurance Level for the current session. Admin console and
// admin APIs require "aal2" (TOTP enrolled + verified); password or email
// OTP alone yields "aal1".
export async function getAssurance(): Promise<{
  current: string | null;
  next: string | null;
}> {
  try {
    const sb = await createClient();
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return { current: null, next: null };
    return {
      current: data.currentLevel,
      next: data.nextLevel,
    };
  } catch {
    return { current: null, next: null };
  }
}
