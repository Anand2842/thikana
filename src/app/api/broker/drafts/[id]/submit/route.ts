import { NextResponse } from "next/server";
import { authorize, body, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { submitOneDraft } from "@/lib/listing-submit";
import { checkRateLimit } from "@/lib/ratelimit";

// Submit one draft as a pending listing. Atomic: the draft row is locked,
// checked, and linked in a single database transaction, with a partial
// unique index on listings.source_draft_id as backstop. A repeat returns
// the already-submitted listing; concurrent submits cannot create two.
// Shares submitOneDraft with the batch endpoint so semantics are identical.
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
    key: `draft-submit:${user!.id}`,
  });
  if (limited) return limited;
  const { id } = await ctx.params,
    b = await body(req);
  const expectedRevision =
    typeof b.expectedRevision === "number" ? b.expectedRevision : null;
  if (expectedRevision === null)
    return invalid(["Send the expected revision you are submitting."]);
  try {
    const db = createServiceClient();
    const result = await submitOneDraft(db, brokerId, id, expectedRevision);
    if (!result.ok)
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    return NextResponse.json(
      { listing: result.listing, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
