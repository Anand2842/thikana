import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { userBrokerId } from "@/lib/supabase/role";
import { fetchListings } from "@/lib/supabase/data";
import { submitListing, submitValidationErrors } from "@/lib/listing-submit";
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
    errors = submitValidationErrors(b);
  if (errors.length) return invalid(errors);
  try {
    const { listing } = await submitListing({ body: b, brokerId });
    return NextResponse.json({ listing }, { status: 201 });
  } catch (e) {
    if (
      e instanceof Error &&
      "errors" in e &&
      Array.isArray((e as { errors: unknown }).errors)
    )
      return invalid((e as { errors: string[] }).errors);
    if (e instanceof Error && "status" in e && (e as { status: unknown }).status === 403)
      return NextResponse.json({ error: e.message }, { status: 403 });
    return unavailable(e);
  }
}
