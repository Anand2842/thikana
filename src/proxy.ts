import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, userRole } from "@/lib/supabase/role";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Always refresh the session first so the check below sees fresh cookies.
  const response = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  // Exact-or-slash-prefix match so public /brokers stays ungated.
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isBrokerRoute = pathname === "/broker" || pathname.startsWith("/broker/");
  const isAuthedRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (!isAdminRoute && !isBrokerRoute && !isAuthedRoute) return response;

  // Read-only check built from request cookies. next/headers cookies() is not
  // available in middleware, so role.ts's getSessionUser() can't run here —
  // instead build the client inline and apply the pure canAccess() helper.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Read-only check — updateSession() above already refreshed cookies.
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = userRole(user);

  // canAccess() falls through to seeker-level for any requirement other than
  // "broker", so admin routes need the explicit role check as well.
  // /dashboard needs any signed-in user (seeker, broker, or admin).
  const required = isAdminRoute ? "admin" : "broker";
  const allowed =
    !!user &&
    (isAuthedRoute || (canAccess(role, required) && (!isAdminRoute || role === "admin")));
  if (allowed) return response;

  const redirect = new URL("/auth", request.url);
  redirect.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(redirect);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
