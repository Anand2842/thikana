import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { text } from "@/lib/validation";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await authorize("admin");
  if (response) return response;
  const limited = checkRateLimit(req, { limit: 20, windowMs: 60000, key: `privacy-review:${user!.id}` });
  if (limited) return limited;
  const { id } = await ctx.params, b = await body(req);
  if (!["Reviewing", "Closed"].includes(text(b.status)) || !["Open", "Reviewing"].includes(text(b.expectedStatus)) || text(b.response).length < 10 || text(b.response).length > 2000)
    return invalid(["Choose a valid next step and write a 10–2,000 character response."]);
  try {
    const db = createServiceClient();
    const { data: item, error: lookup } = await db.from("privacy_requests").select("id").eq("id", id).maybeSingle();
    if (lookup) throw lookup;
    if (!item) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    const { error } = await db.rpc("review_privacy_request", {
      target: id, next_status: b.status, expected_status: b.expectedStatus, reply: text(b.response), actor: user!.id, actor_email: user!.email ?? "",
    });
    if (error?.code === "P0001") return NextResponse.json({ error: "This request changed or needs review before closure. Refresh and try again." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) { return unavailable(e); }
}
