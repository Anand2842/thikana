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
  if (typeof b.uphold !== "boolean")
    return invalid(["Choose uphold or dismiss."]);
  try {
    const db = createServiceClient();
    const { data, error: e } = await db
      .from("reports")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    if (!data)
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    if (data.status.startsWith("Resolved"))
      return NextResponse.json(
        { error: "Report already resolved." },
        { status: 409 },
      );
    const { error } = await db.rpc("resolve_report", {
      target: id,
      upheld: b.uphold,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
