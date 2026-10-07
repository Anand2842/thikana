import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { getSessionUser } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { validatePrivacyRequest } from "@/lib/policies";
import { text } from "@/lib/validation";

export async function GET() {
  const { user, response } = await authorize();
  if (response) return response;
  try {
    const { data, error } = await createServiceClient().from("privacy_requests")
      .select("id,kind,status,response,created_at,updated_at").eq("owner_id", user!.id)
      .order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return NextResponse.json({ requests: data });
  } catch (e) { return unavailable(e); }
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req, { limit: 5, windowMs: 3600000, key: "privacy-requests" });
  if (limited) return limited;
  const b = await body(req), errors = validatePrivacyRequest(b);
  if (errors.length) return invalid(errors);
  try {
    const user = await getSessionUser();
    const { data, error } = await createServiceClient().from("privacy_requests").insert({
      id: `PR-${crypto.randomUUID()}`, owner_id: user?.id ?? null,
      contact_email: user?.email ?? text(b.email).toLowerCase(), kind: b.kind, details: text(b.details),
    }).select("id,status,created_at").single();
    if (error) throw error;
    return NextResponse.json({ request: data }, { status: 201 });
  } catch (e) { return unavailable(e); }
}
