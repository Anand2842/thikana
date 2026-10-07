import { NextResponse } from "next/server";
import { authorize, body, invalid, requireAal2, unavailable } from "@/lib/api";
import { validateMessage, text } from "@/lib/validation";
import { userBrokerId, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { fetchLeadMessages, mapLeadMessage } from "@/lib/supabase/data";
async function leadFor(
  db: ReturnType<typeof createServiceClient>,
  id: string,
) {
  const { data, error } = await db
    .from("leads")
    .select("id,owner_id,broker_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
function participant(
  l: { owner_id: string | null; broker_id: string } | null,
  userId: string,
  brokerId: string | null,
  role: string,
) {
  return (
    !!l &&
    (l.owner_id === userId || l.broker_id === brokerId || role === "admin")
  );
}
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const l = await leadFor(db, id);
    if (!l)
      return NextResponse.json(
        { error: "Enquiry not found." },
        { status: 404 },
      );
    if (
      !participant(l, user!.id, userBrokerId(user), userRole(user))
    )
      return NextResponse.json(
        { error: "This enquiry does not belong to you." },
        { status: 403 },
      );
    // Admin thread access needs a TOTP-verified session.
    if (userRole(user) === "admin" && l.owner_id !== user!.id && l.broker_id !== userBrokerId(user)) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    const messages = await fetchLeadMessages(id);
    const { data: read } = await db
      .from("lead_reads")
      .select("last_read_at")
      .eq("lead_id", id)
      .eq("user_id", user!.id)
      .maybeSingle();
    const watermark = read?.last_read_at ?? null;
    const unread = messages.filter(
      (m) => !watermark || m.createdAt > watermark,
    ).length;
    return NextResponse.json({ messages, unread });
  } catch (e) {
    return unavailable(e);
  }
}
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `lead-messages:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params,
    b = await body(req),
    errors = validateMessage(b);
  if (errors.length) return invalid(errors);
  try {
    const db = createServiceClient();
    const l = await leadFor(db, id);
    if (!l)
      return NextResponse.json(
        { error: "Enquiry not found." },
        { status: 404 },
      );
    if (
      !participant(l, user!.id, userBrokerId(user), userRole(user))
    )
      return NextResponse.json(
        { error: "This enquiry does not belong to you." },
        { status: 403 },
      );
    // Admin writes to foreign threads need a TOTP-verified session.
    if (userRole(user) === "admin" && l.owner_id !== user!.id && l.broker_id !== userBrokerId(user)) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    const { data, error } = await db
      .from("lead_messages")
      .insert({
        id: `LM-${crypto.randomUUID()}`,
        lead_id: id,
        sender_id: user!.id,
        body: text(b.body),
      })
      .select()
      .single();
    if (error) throw error;
    // First broker reply starts the response clock (best-effort, never fails
    // the message itself).
    if (l.broker_id === userBrokerId(user)) {
      await db
        .from("leads")
        .update({ first_response_at: new Date().toISOString() })
        .eq("id", id)
        .is("first_response_at", null);
    }
    return NextResponse.json(
      { message: mapLeadMessage(data) },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
