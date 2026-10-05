import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { response } = await authorize("admin");
  if (response) return response;
  const { id } = await ctx.params,
    b = await body(req);
  if (!["approve", "expire", "flag"].includes(String(b.action)))
    return invalid(["Choose approve, expire or flag."]);
  try {
    const db = createServiceClient();
    const { data: l, error: e } = await db
      .from("listings")
      .select("broker_id")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    if (!l)
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    if (b.action === "approve") {
      const { data: broker, error } = await db
        .from("brokers")
        .select("verified")
        .eq("id", l.broker_id)
        .single();
      if (error) throw error;
      if (broker.verified !== "verified")
        return NextResponse.json(
          { error: "Approve the broker before approving their listing." },
          { status: 409 },
        );
    }
    const patch =
      b.action === "approve"
        ? {
            verification: "verified",
            hrs: 0,
            last_confirmed_at: new Date().toISOString(),
            flags: [],
          }
        : b.action === "expire"
          ? { verification: "stale" }
          : { verification: "flagged", flags: ["Under review by trust team"] };
    const { error } = await db.from("listings").update(patch).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
