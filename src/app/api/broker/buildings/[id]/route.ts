import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { validateBuilding } from "@/lib/inventory";

export async function PATCH(
  req: Request,
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
  const { id } = await ctx.params,
    b = await body(req);
  const expectedRevision =
    typeof b.expectedRevision === "number" ? b.expectedRevision : null;
  if (expectedRevision === null)
    return invalid(["Send the expected revision you edited."]);
  const errors = validateBuilding(b);
  if (errors.length) return invalid(errors);
  try {
    const db = createServiceClient();
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified")
      .eq("id", brokerId)
      .single();
    if (be) throw be;
    if (broker.verified !== "verified")
      return NextResponse.json(
        { error: "Building workspace unlocks after approval." },
        { status: 403 },
      );
    const { data: updated, error } = await db
      .from("broker_buildings")
      .update({
        label: text(b.label).slice(0, 120),
        city: text(b.city),
        locality: text(b.locality).slice(0, 100),
        street: text(b.street).slice(0, 300),
        sector: text(b.sector).slice(0, 100),
        amenities: Array.isArray(b.amenities)
          ? (b.amenities as unknown[]).map((a) => text(a)).filter(Boolean).slice(0, 30)
          : [],
        defaults:
          typeof b.defaults === "object" && b.defaults !== null && !Array.isArray(b.defaults)
            ? b.defaults
            : {},
        revision: expectedRevision + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("broker_id", brokerId)
      .eq("revision", expectedRevision)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!updated)
      return NextResponse.json(
        { error: "Building changed. Refresh and try again." },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unavailable(e);
  }
}
