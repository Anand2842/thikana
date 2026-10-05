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
  if (!["approve", "reject", "suspend"].includes(String(b.action)))
    return invalid(["Choose approve, reject or suspend."]);
  try {
    const db = createServiceClient();
    const { data, error: e } = await db
      .from("brokers")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    if (!data)
      return NextResponse.json({ error: "Broker not found." }, { status: 404 });
    const { error } = await db.rpc("moderate_broker", {
      target: id,
      operation: b.action,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
