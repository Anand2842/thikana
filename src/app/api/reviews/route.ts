import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text, integer } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const b = await body(req);
  if (
    !integer(b.rating, 1, 5) ||
    text(b.text).length < 10 ||
    text(b.text).length > 2000
  )
    return invalid(["Choose 1–5 stars and write 10–2,000 characters."]);
  try {
    const db = createServiceClient();
    const { data: l, error: e } = await db
      .from("leads")
      .select("*")
      .eq("id", text(b.leadId))
      .maybeSingle();
    if (e) throw e;
    if (!l || l.owner_id !== user!.id)
      return NextResponse.json(
        { error: "This enquiry does not belong to you." },
        { status: 403 },
      );
    if (!l.seeker_visited || !l.broker_visited)
      return NextResponse.json(
        { error: "Both parties must confirm the visit before a review." },
        { status: 409 },
      );
    const { error } = await db
      .from("reviews")
      .insert({
        lead_id: l.id,
        owner_id: user!.id,
        broker_id: l.broker_id,
        user_name: l.user_name,
        rating: b.rating,
        text: text(b.text),
        date: new Date().toISOString().slice(0, 10),
        tag: "Verified visit",
      });
    if (error?.code === "23505")
      return NextResponse.json(
        { error: "You already reviewed this visit." },
        { status: 409 },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return unavailable(e);
  }
}
