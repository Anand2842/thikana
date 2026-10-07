import { NextResponse } from "next/server";
import { authorize, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";

// Own request progress/receipt: recovers the broker's screen after refresh
// or connection loss without re-sending input to any provider.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("inventory_requests")
      .select("id,kind,state,results,attempts,updated_at")
      .eq("id", id)
      .eq("broker_id", brokerId)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    return NextResponse.json({ request: data });
  } catch (e) {
    return unavailable(e);
  }
}
