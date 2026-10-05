import { NextResponse } from "next/server";
import { brokers as mockBrokers } from "@/lib/mock-data";
import { validateBroker } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { mapBroker } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET() {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("brokers").select("*").order("rating", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ brokers: (data ?? []).map(mapBroker), source: "supabase" });
  } catch {
    return NextResponse.json({ brokers: mockBrokers, source: "mock" });
  }
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { limit: 10, windowMs: 60_000, key: "brokers" });
  if (limited) return limited;
  const body = await req.json().catch(() => ({}));
  const errors = validateBroker(body as Record<string, unknown>);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const b = body as Record<string, unknown>;
  const id = `B${Date.now().toString().slice(-6)}`;
  const row = {
    id,
    name: String(b.name),
    agency: String(b.agency),
    photo: "",
    verified: "pending",
    cities: b.city ? [String(b.city)] : ["Delhi"],
    areas: Array.isArray(b.areas) ? (b.areas as string[]) : [],
    cats: [] as string[],
  };
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("brokers").insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ broker: mapBroker(data), source: "supabase" }, { status: 201 });
  } catch {
    return NextResponse.json(
      { broker: { ...row, verified: "pending" as const }, note: "Demo mode: accepted, persisted after DB wiring." },
      { status: 201 }
    );
  }
}
