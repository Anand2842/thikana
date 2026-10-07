import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { validateBroker, text } from "@/lib/validation";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { userRole } from "@/lib/supabase/role";
import { fetchBrokers } from "@/lib/supabase/data";
import { POLICY_VERSION, validateBrokerAcceptance } from "@/lib/policies";
export async function GET() {
  try {
    return NextResponse.json({ brokers: await fetchBrokers() });
  } catch (e) {
    return unavailable(e);
  }
}
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 10,
    windowMs: 60000,
    key: `brokers:${user!.id}`,
  });
  if (limited) return limited;
  const b = await body(req),
    errors = [...validateBroker(b), ...validateBrokerAcceptance(b)];
  if (errors.length) return invalid(errors);
  if (
    ![b.identityPath, b.businessPath].every(
      (p) => text(p).startsWith(`${user!.id}/`) && !text(p).includes(".."),
    )
  )
    return invalid(["Upload your own verification documents."]);
  try {
    const db = createServiceClient();
    const { data: existing, error: ee } = await db
      .from("broker_applications")
      .select("broker_id")
      .eq("owner_id", user!.id)
      .maybeSingle();
    if (ee) throw ee;
    const id = existing?.broker_id ?? `B-${crypto.randomUUID()}`;
    if (existing) {
      const { data: profile, error } = await db
        .from("brokers")
        .select("verified")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (profile.verified === "verified")
        return NextResponse.json(
          {
            error:
              "Your profile is already approved. Use your broker dashboard.",
          },
          { status: 409 },
        );
    }
    {
      for (const path of [text(b.identityPath), text(b.businessPath)]) {
        const { data, error } = await db.storage
          .from("broker-proofs")
          .download(path);
        if (error || !data)
          return invalid(["Verification document is missing. Upload again."]);
      }
      const { error } = await db.rpc("submit_broker", {
        broker: {
          id,
          name: text(b.name),
          agency: text(b.agency),
          cities: [text(b.city)],
          areas: b.areas,
          policy: text(b.policy),
          photo: text(b.photo),
          business_address: text(b.businessAddress),
          exp: typeof b.exp === "number" ? b.exp : 0,
          cats: Array.isArray(b.cats)
            ? b.cats.map((v) => text(v)).filter(Boolean)
            : [],
        },
        application: {
          owner_id: user!.id,
          phone: text(b.phone),
          identity_path: b.identityPath,
          business_path: b.businessPath,
          agreement_version: POLICY_VERSION,
          privacy_version: POLICY_VERSION,
        },
      });
      if (error) throw error;
    }
    const { error: authError } = await db.auth.admin.updateUserById(user!.id, {
      app_metadata: {
        ...user!.app_metadata,
        role: userRole(user) === "admin" ? "admin" : "broker",
        broker_id: id,
      },
    });
    if (authError) throw authError;
    return NextResponse.json(
      { broker: { id, verified: "pending" } },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
