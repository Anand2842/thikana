import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { validateBuilding } from "@/lib/inventory";
import { checkRateLimit } from "@/lib/ratelimit";

function mapBuilding(r: Record<string, unknown>) {
  return {
    id: r.id,
    label: r.label,
    city: r.city,
    locality: r.locality,
    street: r.street,
    sector: r.sector,
    amenities: r.amenities ?? [],
    defaults: r.defaults ?? {},
    revision: r.revision ?? 1,
    updatedAt: r.updated_at,
  };
}

export async function GET() {
  // Reads allowed for any authenticated broker (even pending review) so
  // brokers can recover their own work.
  const { user, response } = await authorize();
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  try {
    const { data, error } = await createServiceClient()
      .from("broker_buildings")
      .select("*")
      .eq("broker_id", brokerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({
      buildings: (data ?? []).map((r) => mapBuilding(r as Record<string, unknown>)),
    });
  } catch (e) {
    return unavailable(e);
  }
}

export async function POST(req: Request) {
  const { user, response } = await authorize("broker");
  if (response) return response;
  const brokerId = userBrokerId(user);
  if (!brokerId)
    return NextResponse.json(
      { error: "Complete broker onboarding first." },
      { status: 403 },
    );
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `buildings:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req),
    errors = validateBuilding(b);
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
    const { data, error } = await db
      .from("broker_buildings")
      .insert({
        id: `BB-${crypto.randomUUID()}`,
        broker_id: brokerId,
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
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(
      { building: mapBuilding(data as Record<string, unknown>) },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
