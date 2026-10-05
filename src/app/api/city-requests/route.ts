import { NextResponse } from "next/server";
import { validateCityRequest } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser, userRole } from "@/lib/supabase/role";
import { fetchCityRequestsSvc, mapCityRequest } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";

// Demand signals carry phone numbers: admin-only reads.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (userRole(user) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requests = await fetchCityRequestsSvc();
  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { limit: 10, windowMs: 60_000, key: "city-requests" });
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { city?: string; name?: string; phone?: string; userType?: string };
  const errors = validateCityRequest(body);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const user = await getSessionUser();
  const row = {
    id: `CR-${Date.now().toString().slice(-6)}`,
    city: body.city!.trim(),
    name: body.name!.trim(),
    phone: body.phone!.trim(),
    user_type: body.userType === "broker" ? "broker" : "seeker",
    status: "New",
    date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    owner_id: user?.id ?? null,
  };
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("city_requests").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ request: mapCityRequest(data), source: "supabase" }, { status: 201 });
  } catch {
    return NextResponse.json({ request: { ...row, userType: row.user_type }, source: "mock" }, { status: 201 });
  }
}
