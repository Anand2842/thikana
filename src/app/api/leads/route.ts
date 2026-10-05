import { NextResponse } from "next/server";
import { getListing } from "@/lib/mock-data";
import { validateLead } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";
import { fetchScopedLeads, mapLead } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";

// Private reads: session required, scoped to owner / assigned broker / admin.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const leads = await fetchScopedLeads({ userId: user.id, role: userRole(user), brokerId: userBrokerId(user) });
  return NextResponse.json({ leads });
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { limit: 10, windowMs: 60_000, key: "leads" });
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as { name?: string; phone?: string; listingId?: string; msg?: string };
  const errors = validateLead(body);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const listing = getListing(body.listingId!);
  const user = await getSessionUser();
  const row = {
    id: `LD-${Date.now().toString().slice(-6)}`,
    listing_id: body.listingId!,
    broker_id: listing?.brokerId ?? "B1",
    user_name: body.name!,
    phone: body.phone!,
    msg: body.msg ?? "",
    status: "New",
    date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    owner_id: user?.id ?? null,
  };
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("leads").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ lead: mapLead(data), source: "supabase" }, { status: 201 });
  } catch {
    return NextResponse.json({ lead: { ...row, listingId: row.listing_id }, source: "mock" }, { status: 201 });
  }
}
