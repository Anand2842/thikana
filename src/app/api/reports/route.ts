import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: `reports:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req);
  if (
    ![
      "Advance fee demand",
      "Wrong details",
      "Duplicate photos",
      "Unavailable property",
      "Other",
    ].includes(text(b.reason)) ||
    text(b.details).length < 10 ||
    text(b.details).length > 2000
  )
    return invalid([
      "Choose a reason and describe the issue (10–2,000 characters).",
    ]);
  try {
    const db = createServiceClient();
    const { data: l, error: e } = await db
      .from("listings")
      .select("id")
      .eq("id", text(b.listingId))
      .maybeSingle();
    if (e) throw e;
    if (!l)
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    const { data, error } = await db
      .from("reports")
      .insert({
        id: `R-${crypto.randomUUID()}`,
        listing_id: l.id,
        reason: text(b.reason),
        details: text(b.details),
        reporter: user!.email,
        owner_id: user!.id,
        date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) throw error;
    return NextResponse.json({ report: data }, { status: 201 });
  } catch (e) {
    return unavailable(e);
  }
}
