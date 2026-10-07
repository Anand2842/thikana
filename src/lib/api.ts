import "server-only";
import { NextResponse } from "next/server";
import { getAssurance, getSessionUser, userRole, type Role } from "./supabase/role";
import { object } from "./validation";

export async function authorize(role?: Role) {
  const user = await getSessionUser();
  if (!user)
    return {
      user: null,
      response: NextResponse.json(
        { error: "Sign in to continue." },
        { status: 401 },
      ),
    };
  if (role && userRole(user) !== "admin" && userRole(user) !== role)
    return {
      user: null,
      response: NextResponse.json(
        { error: "You do not have access to this action." },
        { status: 403 },
      ),
    };
  // Password-only admin sessions cannot touch moderation APIs: admin role
  // requires a TOTP-verified session (aal2). Enroll/verify at /admin/mfa.
  if (role === "admin") {
    const mfa = await requireAal2();
    if (mfa) return { user: null, response: mfa };
  }
  return { user, response: null };
}
// Single choke point for admin privilege: signed-in + admin role +
// TOTP-verified session. Every moderation path must go through this or
// authorize("admin") — never a bare role check.
export async function requireAdmin() {
  const { user, response } = await authorize("admin");
  if (response) return { user: null, response };
  return { user, response: null };
}
// Standalone step-up check for handlers that branch on admin role manually
// instead of calling authorize("admin").
export async function requireAal2() {
  const { current } = await getAssurance();
  if (current !== "aal2")
    return NextResponse.json(
      { error: "Admin MFA required. Verify at /admin/mfa." },
      { status: 403 },
    );
  return null;
}
export async function body(req: Request) {
  return object(await req.json().catch(() => null));
}
export const invalid = (errors: string[]) =>
  NextResponse.json({ errors }, { status: 400 });
export function unavailable(error: unknown) {
  // Keep provider errors and credentials out of public responses.
  console.error(
    "Database operation failed",
    error && typeof error === "object" && "code" in error
      ? error.code
      : "unavailable",
  );
  return NextResponse.json(
    { error: "Could not save changes. Please try again." },
    { status: 503 },
  );
}
