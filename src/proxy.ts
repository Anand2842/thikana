import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const p = request.nextUrl.pathname;
  // /broker/onboard is the public signup funnel — everything else under
  // /broker/* needs a session (pages enforce broker/admin roles themselves).
  const privatePage =
    p === "/dashboard" ||
    p.startsWith("/dashboard/") ||
    p === "/admin" ||
    p.startsWith("/admin/") ||
    p === "/broker" ||
    p.startsWith("/broker/");
  const isOnboard = p === "/broker/onboard";
  if (privatePage && !isOnboard && !user) {
    const u = new URL("/auth", request.url);
    u.searchParams.set("next", p + request.nextUrl.search);
    const redirect = NextResponse.redirect(u);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
