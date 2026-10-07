import { NextResponse } from "next/server";
import { authorize, requireAal2, unavailable } from "@/lib/api";
import { userBrokerId, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/leads/[id]/read — record that the caller has seen this thread.
// Participant-checked (owner seeker / assigned broker / admin), same rule
// as the messages route. Upserts lead_reads (migration-014); the row's
// last_read_at is the watermark for unread-count math.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data: lead, error: leadError } = await db
      .from("leads")
      .select("id,owner_id,broker_id")
      .eq("id", id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead)
      return NextResponse.json(
        { error: "Enquiry not found." },
        { status: 404 },
      );
    const participant =
      lead.owner_id === user!.id ||
      lead.broker_id === userBrokerId(user) ||
      userRole(user) === "admin";
    if (!participant)
      return NextResponse.json(
        { error: "This enquiry does not belong to you." },
        { status: 403 },
      );
    // Admin thread access needs a TOTP-verified session.
    if (
      userRole(user) === "admin" &&
      lead.owner_id !== user!.id &&
      lead.broker_id !== userBrokerId(user)
    ) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    const { error: upsertError } = await db.from("lead_reads").upsert(
      {
        lead_id: id,
        user_id: user!.id,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "lead_id,user_id" },
    );
    if (upsertError) throw upsertError;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
