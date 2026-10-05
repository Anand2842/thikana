import { NextResponse } from "next/server";
import { listings as mockListings } from "@/lib/mock-data";
import { validateListing } from "@/lib/validation";
import { acceptPhotoUrls } from "@/lib/uploads";
import { createServiceClient } from "@/lib/supabase/server";
import { mapListing } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locality = searchParams.get("locality");
  try {
    const sb = createServiceClient();
    let q = sb.from("listings").select("*").order("hrs", { ascending: true });
    if (locality && locality !== "All") q = q.eq("locality", locality);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ listings: (data ?? []).map(mapListing), source: "supabase" });
  } catch {
    const rows = locality && locality !== "All" ? mockListings.filter((l) => l.locality === locality) : mockListings;
    return NextResponse.json({ listings: rows, source: "mock" });
  }
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { limit: 10, windowMs: 60_000, key: "listings" });
  if (limited) return limited;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors = validateListing(body);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const row = {
    id: `L${Date.now().toString().slice(-6)}`,
    prop_id: `DL-TMP-${Date.now().toString().slice(-6)}`,
    title: String(body.title),
    city: String(body.city),
    locality: String(body.locality),
    bhk: Number(body.bhk),
    rent: Number(body.rent),
    broker_id: String(body.brokerId),
    photos: acceptPhotoUrls(body.photos),
    verification: "pending",
    hrs: 0,
  };
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("listings").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ listing: mapListing(data), source: "supabase" }, { status: 201 });
  } catch {
    return NextResponse.json({ listing: { ...row, verification: "pending" as const }, source: "mock" }, { status: 201 });
  }
}
