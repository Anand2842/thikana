import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const p = request.nextUrl.pathname;
  const privatePage =
    p === "/dashboard" ||
    p.startsWith("/dashboard/") ||
    p === "/admin" ||
    p.startsWith("/admin/") ||
    p.startsWith("/broker/");
  if (privatePage && !user) {
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
