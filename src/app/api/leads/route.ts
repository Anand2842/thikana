import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { validateLead, text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId, userRole } from "@/lib/supabase/role";
import { fetchScopedLeads, mapLead, mapListing } from "@/lib/supabase/data";
import { isActive } from "@/lib/trust";
import { checkRateLimit } from "@/lib/ratelimit";
export async function GET() {
  const { user, response } = await authorize();
  if (response) return response;
  try {
    return NextResponse.json({
      leads: await fetchScopedLeads({
        userId: user!.id,
        role: userRole(user),
        brokerId: userBrokerId(user),
      }),
    });
  } catch (e) {
    return unavailable(e);
  }
}
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: `leads:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req),
    errors = validateLead(b);
  if (errors.length) return invalid(errors);
  try {
    const db = createServiceClient();
    const { data: l, error } = await db
      .from("listings")
      .select("*")
      .eq("id", text(b.listingId))
      .maybeSingle();
    if (error) throw error;
    if (!l)
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified")
      .eq("id", l.broker_id)
      .single();
    if (be) throw be;
    if (!isActive(mapListing(l)) || broker.verified !== "verified")
      return NextResponse.json(
        { error: "This listing is unavailable for enquiries." },
        { status: 409 },
      );
    if (l.broker_id === userBrokerId(user))
      return NextResponse.json(
        { error: "You cannot enquire on your own listing." },
        { status: 409 },
      );
    const { data, error: save } = await db
      .from("leads")
      .insert({
        id: `LD-${crypto.randomUUID()}`,
        listing_id: l.id,
        broker_id: l.broker_id,
        user_name: text(b.name),
        phone: text(b.phone),
        msg: text(b.msg),
        owner_id: user!.id,
        date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (save) throw save;
    return NextResponse.json({ lead: mapLead(data) }, { status: 201 });
  } catch (e) {
    return unavailable(e);
  }
}
