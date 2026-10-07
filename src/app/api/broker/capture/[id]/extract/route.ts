import { NextResponse } from "next/server";
import { authorize, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import {
  ExtractionError,
  MAX_EXTRACT_ATTEMPTS,
  runProviderExtraction,
  validateCandidates,
} from "@/lib/extraction";
import { MEDIA_BUCKET } from "@/lib/inventory-media";
import { checkRateLimit } from "@/lib/ratelimit";

// Run one bounded extraction attempt for an own capture request. A
// processing lease is committed before the provider call: a committed
// completed request replays its candidates, an expired unfinished lease can
// be retried, and persistence uses the source/index uniqueness constraint
// so retries never duplicate candidates.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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
    key: `extract:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params;
  try {
    const db = createServiceClient();
    const { data: row, error: fe } = await db
      .from("inventory_requests")
      .select("*")
      .eq("id", id)
      .eq("broker_id", brokerId)
      .eq("kind", "extract")
      .maybeSingle();
    if (fe) throw fe;
    const reqRow = row as Record<string, unknown> | null;
    if (!reqRow)
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (reqRow.state === "done")
      return NextResponse.json({
        drafts: reqRow.results,
        replay: true,
        complete: true,
      });
    if (
      typeof reqRow.attempts === "number" &&
      reqRow.attempts >= MAX_EXTRACT_ATTEMPTS
    )
      return NextResponse.json(
        { error: "Extraction keeps failing — add the home manually." },
        { status: 429 },
      );
    // Claim the lease atomically: only one worker per request.
    const leaseUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    const { data: claimed, error: ce } = await db
      .from("inventory_requests")
      .update({
        state: "processing",
        lease_until: leaseUntil,
        attempts: ((reqRow.attempts as number) ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .or(`state.neq.processing,lease_until.lte.${new Date().toISOString()}`)
      .select("id");
    if (ce) throw ce;
    if (!claimed?.length)
      return NextResponse.json(
        { error: "An extraction is already running for this request." },
        { status: 409 },
      );
    const release = async () => {
      await db
        .from("inventory_requests")
        .update({ state: "open", lease_until: null, updated_at: new Date().toISOString() })
        .eq("id", id);
    };
    const items = (reqRow.items ?? {}) as { text?: string; screenshots?: string[] };
    const images: { mime: string; base64: string }[] = [];
    if (Array.isArray(items.screenshots)) {
      const { data: assets } = await db
        .from("inventory_assets")
        .select("id,storage_path,mime")
        .in("id", items.screenshots)
        .eq("broker_id", brokerId)
        .eq("kind", "screenshot")
        .eq("state", "ready");
      const found = (assets ?? []) as { id: string; storage_path: string; mime: string }[];
      if (found.length !== items.screenshots.length) {
        await release();
        return NextResponse.json(
          { error: "A screenshot is no longer available. Reselect it." },
          { status: 404 },
        );
      }
      for (const a of found) {
        const { data: blob, error: de } = await db.storage
          .from(MEDIA_BUCKET)
          .download(a.storage_path);
        if (de || !blob) {
          await release();
          return NextResponse.json(
            { error: "A screenshot is no longer available. Reselect it." },
            { status: 404 },
          );
        }
        images.push({
          mime: a.mime,
          base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
        });
      }
    }
    let raw: unknown;
    try {
      raw = await runProviderExtraction({
        text: typeof items.text === "string" ? items.text : "",
        images,
      });
    } catch (e) {
      await release();
      if (!(e instanceof ExtractionError)) throw e;
      if (e.kind === "refused" || e.kind === "invalid")
        return NextResponse.json({ drafts: [], notice: e.message });
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    let drafts;
    try {
      drafts = validateCandidates(raw);
    } catch {
      await release();
      return NextResponse.json({
        drafts: [],
        notice: "Extraction returned an unreadable result. Add the home manually.",
      });
    }
    // Atomic per-candidate persistence: the source/index unique constraint
    // absorbs retries — a repeated attempt reuses the existing draft.
    const saved: { id: string; fields: Record<string, unknown>; excerpt: string }[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      await db
        .from("listing_drafts")
        .upsert(
          {
            id: `D-${crypto.randomUUID()}`,
            broker_id: brokerId,
            fields: d.fields,
            confirmations: {},
            source_request_id: id,
            source_index: i,
          },
          { onConflict: "source_request_id,source_index", ignoreDuplicates: true },
        );
      const { data: existing } = await db
        .from("listing_drafts")
        .select("id,fields")
        .eq("source_request_id", id)
        .eq("source_index", i)
        .maybeSingle();
      if (existing)
        saved.push({
          id: (existing as { id: string }).id,
          fields: (existing as { fields: Record<string, unknown> }).fields ?? {},
          excerpt: d.excerpt,
        });
    }
    await db
      .from("inventory_requests")
      .update({
        results: saved,
        state: "done",
        lease_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ drafts: saved, replay: false, complete: true });
  } catch (e) {
    return unavailable(e);
  }
}
