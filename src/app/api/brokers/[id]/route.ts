import { NextResponse } from "next/server";
import { authorize, body, invalid, requireAal2, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchApplicantChecks, mapBroker } from "@/lib/supabase/data";
import { userBrokerId, userRole } from "@/lib/supabase/role";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { integer, text, validPhotoUrl } from "@/lib/validation";
import { checkRateLimit } from "@/lib/ratelimit";

// Whitelist for broker self-service (enforced key-by-key in
// validateSelfUpdate). Verified status, rating, reviews and moderation
// columns are never writable here.

function validateSelfUpdate(b: Record<string, unknown>): {
  errors: string[];
  update: Record<string, unknown>;
} {
  const errors: string[] = [],
    update: Record<string, unknown> = {},
    has = (k: string) => b[k] !== undefined;
  if (has("agency")) {
    const v = text(b.agency);
    if (v.length < 2 || v.length > 100)
      errors.push("Agency name must be 2–100 characters.");
    else update.agency = v;
  }
  if (has("photo")) {
    if (!validPhotoUrl(b.photo))
      errors.push("Profile photo must be a valid HTTPS URL.");
    else update.photo = b.photo;
  }
  if (has("businessAddress")) {
    if (
      typeof b.businessAddress !== "string" ||
      text(b.businessAddress).length > 300
    )
      errors.push("Business address must be under 300 characters.");
    else update.business_address = text(b.businessAddress);
  }
  if (has("areas")) {
    if (
      !Array.isArray(b.areas) ||
      !b.areas.length ||
      b.areas.length > 20 ||
      !(b.areas as unknown[]).every(
        (v) => text(v).length >= 2 && text(v).length <= 100,
      )
    )
      errors.push("Add 1–20 areas served (2–100 characters each).");
    else update.areas = (b.areas as unknown[]).map((v) => text(v));
  }
  if (has("policy")) {
    const v = text(b.policy);
    if (v.length < 10 || v.length > 1000)
      errors.push(
        "Describe your brokerage policy (10–1,000 characters).",
      );
    else update.policy = v;
  }
  if (has("exp")) {
    if (!integer(b.exp, 0, 50))
      errors.push("Experience must be a whole number of years (0–50).");
    else update.exp = b.exp;
  }
  if (has("cities")) {
    if (
      !Array.isArray(b.cities) ||
      !(b.cities as unknown[]).length ||
      !(b.cities as unknown[]).every((c) =>
        (PHASE1_CITIES as readonly string[]).includes(text(c)),
      )
    )
      errors.push("Select at least one supported city.");
    else update.cities = (b.cities as unknown[]).map((c) => text(c));
  }
  if (has("cats")) {
    if (
      !Array.isArray(b.cats) ||
      (b.cats as unknown[]).length > 10 ||
      !(b.cats as unknown[]).every(
        (c) =>
          typeof c === "string" &&
          text(c).length >= 1 &&
          text(c).length <= 50,
      )
    )
      errors.push("Add up to 10 specialties (max 50 characters each).");
    else
      update.cats = (b.cats as unknown[])
        .map((c) => text(c))
        .filter(Boolean);
  }
  return { errors, update };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, response } = await authorize();
  if (response) return response;
  const { id } = await ctx.params,
    b = await body(req);

  // Admin moderation — behavior unchanged, plus optional `note` → moderation_note.
  if (userRole(user) === "admin") {
    const mfa = await requireAal2();
    if (mfa) return mfa;
    if (!["approve", "reject", "suspend"].includes(String(b.action)))
      return invalid(["Choose approve, reject or suspend."]);
    try {
      const db = createServiceClient();
      const { data, error: e } = await db
        .from("brokers")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (e) throw e;
      if (!data)
        return NextResponse.json(
          { error: "Broker not found." },
          { status: 404 },
        );
      // Approval prerequisites: identity + business proof on file, confirmed
      // contact email, and a business address. The checklist is also shown in
      // the admin queue; the API re-checks so it cannot be bypassed.
      // Stored proof paths must still resolve — a missing file blocks approval.
      if (String(b.action) === "approve") {
        const checks = await fetchApplicantChecks(id);
        if (checks.missing.length)
          return NextResponse.json(
            {
              error: `Approval blocked — missing: ${checks.missing.join(", ")}.`,
            },
            { status: 409 },
          );
        const db2 = createServiceClient();
        const { data: appRow, error: appErr } = await db2
          .from("broker_applications")
          .select("identity_path,business_path")
          .eq("broker_id", id)
          .maybeSingle();
        if (appErr) throw appErr;
        for (const [label, path] of [
          ["identity proof", appRow?.identity_path],
          ["business proof", appRow?.business_path],
        ] as const) {
          if (!path) continue;
          const { data: file, error: dlErr } = await db2.storage
            .from("broker-proofs")
            .download(path);
          if (dlErr || !file || file.size < 1) {
            return NextResponse.json(
              {
                error: `Approval blocked — stored ${label} no longer resolves. Ask the applicant to re-upload.`,
              },
              { status: 409 },
            );
          }
        }
      }
      const { error } = await db.rpc("moderate_broker", {
        target: id,
        operation: b.action,
        actor_id: user!.id,
        detail: text(b.note).slice(0, 500),
        actor_email: user!.email ?? "",
      });
      if (error) throw error;
      if (text(b.note)) {
        const { error: noteError } = await db
          .from("brokers")
          .update({ moderation_note: text(b.note).slice(0, 1000) })
          .eq("id", id);
        if (noteError) throw noteError;
      }
      // Decision audit is written atomically inside moderate_broker.
      return NextResponse.json({ ok: true });
    } catch (e) {
      return unavailable(e);
    }
  }

  // Broker self-service: only the broker's own row, whitelist only.
  // Changing cities/areas here never touches the verified column.
  if (userBrokerId(user) !== id)
    return NextResponse.json(
      { error: "You can only update your own profile." },
      { status: 403 },
    );
  if ("action" in b)
    return NextResponse.json(
      { error: "You do not have access to this action." },
      { status: 403 },
    );
  const { errors, update } = validateSelfUpdate(b);
  if (errors.length) return invalid(errors);
  if (!Object.keys(update).length)
    return invalid(["Nothing to update."]);
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `brokers-self:${user!.id}`,
  });
  if (limited) return limited;
  try {
    const db = createServiceClient();
    const { data: existing, error: e } = await db
      .from("brokers")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    if (!existing)
      return NextResponse.json({ error: "Broker not found." }, { status: 404 });
    const { data, error } = await db
      .from("brokers")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ broker: mapBroker(data) });
  } catch (e) {
    return unavailable(e);
  }
}
