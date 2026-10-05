import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { validateListing, text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { fetchListings, mapListing } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";
export async function GET(req: Request) {
  try {
    let rows = await fetchListings();
    const loc = new URL(req.url).searchParams.get("locality");
    if (loc && loc !== "All") rows = rows.filter((l) => l.locality === loc);
    return NextResponse.json({ listings: rows });
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
    limit: 10,
    windowMs: 60000,
    key: `listings:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req),
    errors = validateListing(b);
  if (errors.length) return invalid(errors);
  try {
    const db = createServiceClient();
    const { data: broker, error: be } = await db
      .from("brokers")
      .select("verified,cities")
      .eq("id", brokerId)
      .single();
    if (be) throw be;
    if (broker.verified !== "verified")
      return NextResponse.json(
        {
          error:
            "Your broker application must be approved before listing homes.",
        },
        { status: 403 },
      );
    if (!broker.cities.includes(text(b.city)))
      return invalid(["Choose a city in your approved service area."]);
    // ponytail: exact normalized addresses share an ID; staff reviews ambiguous address matches.
    const identity = [b.city, b.locality, b.address]
      .map((v) =>
        text(v)
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]/gu, ""),
      )
      .join("|");
    const propId = `PROP-${createHash("sha256").update(identity).digest("hex").slice(0, 16).toUpperCase()}`;
    const row = {
      id: `L-${crypto.randomUUID()}`,
      prop_id: propId,
      title: text(b.title),
      city: text(b.city),
      locality: text(b.locality),
      sector: text(b.sector).slice(0, 100),
      bhk: b.bhk,
      type: b.type,
      rent: b.rent,
      deposit: b.deposit,
      brok_days: b.brokDays,
      brok: `${b.brokDays} days`,
      visit_fee: b.visitFee,
      other_fee: b.otherFee,
      area: b.area,
      floor: text(b.floor).slice(0, 100),
      furnishing: b.furnishing,
      avail: b.avail,
      description: text(b.desc),
      amenities: text(b.amenities)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
      photos: b.photos,
      broker_id: brokerId,
      verification: "pending",
      last_confirmed_at: new Date().toISOString(),
    };
    const { data, error } = await db.rpc("submit_listing", {
      payload: row,
      address: text(b.address),
    });
    if (error) throw error;
    return NextResponse.json({ listing: mapListing(data) }, { status: 201 });
  } catch (e) {
    return unavailable(e);
  }
}
