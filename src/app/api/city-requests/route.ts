import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { validateCityRequest, text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/role";
import { fetchCityRequestsSvc, mapCityRequest } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";
export async function GET() {
  const { response } = await authorize("admin");
  if (response) return response;
  try {
    return NextResponse.json({ requests: await fetchCityRequestsSvc() });
  } catch (e) {
    return unavailable(e);
  }
}
export async function POST(req: Request) {
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: "city-requests",
  });
  if (limited) return limited;
  const b = await body(req),
    errors = validateCityRequest(b);
  if (errors.length) return invalid(errors);
  try {
    const user = await getSessionUser();
    const { data, error } = await createServiceClient()
      .from("city_requests")
      .insert({
        id: `CR-${crypto.randomUUID()}`,
        city: text(b.city),
        name: text(b.name),
        phone: text(b.phone),
        user_type: b.userType,
        owner_id: user?.id ?? null,
        date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(
      { request: mapCityRequest(data) },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
