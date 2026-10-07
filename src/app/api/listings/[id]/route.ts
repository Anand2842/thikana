import { NextResponse } from "next/server";
import { authorize, body, invalid, requireAal2, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId, userRole } from "@/lib/supabase/role";
import { mapListing } from "@/lib/supabase/data";
import { checkRateLimit } from "@/lib/ratelimit";

// ---- Inline partial-edit validators (mirrors validateListing rules;
// validation.ts is intentionally left untouched). ----
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const integer = (v: unknown, min = 0, max = 10_000_000) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
function validPhotoUrl(v: unknown) {
  if (typeof v !== "string" || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
const AVAILABILITY = ["Available", "Taken", "OnHold"] as const;
const RELATIONSHIPS = ["owner", "agent", "subagent"] as const;
const FURNISHINGS = [
  "Unfurnished",
  "Semi-Furnished",
  "Fully Furnished",
] as const;

function parseAmenities(v: unknown): string[] | null {
  if (typeof v === "string") {
    if (v.length > 1000) return null;
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (Array.isArray(v)) {
    if (v.length > 20) return null;
    const items: string[] = [];
    for (const item of v) {
      if (typeof item !== "string") return null;
      const t = item.trim();
      if (!t || t.length > 100) return null;
      items.push(t);
    }
    return items;
  }
  return null;
}

function validAvail(v: unknown) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(text(v)) &&
    Number.isFinite(Date.parse(text(v))) &&
    new Date(text(v)).toISOString().slice(0, 10) === text(v)
  );
}

// Editing any price/fee/photo field sends the listing back for re-review.
const REREVIEW_FIELDS = [
  "rent",
  "deposit",
  "brokDays",
  "visitFee",
  "visitFeeRefundable",
  "otherFee",
  "otherFeeNote",
  "photos",
  "photoHashes",
];

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // Brokers and admins both reach this handler; each branch re-checks scope.
  const { user, response } = await authorize("broker");
  if (response) return response;
  const { id } = await ctx.params,
    b = await body(req);

  // Moderation branch (pre-existing admin action; preserved as-is).
  if (b.action !== undefined) {
    if (userRole(user) !== "admin")
      return NextResponse.json(
        { error: "You do not have access to this action." },
        { status: 403 },
      );
    const mfa = await requireAal2();
    if (mfa) return mfa;
    if (!["approve", "expire", "flag"].includes(String(b.action)))
      return invalid(["Choose approve, expire or flag."]);
    try {
      const db = createServiceClient();
      const { data: l, error: e } = await db
        .from("listings")
        .select("broker_id")
        .eq("id", id)
        .maybeSingle();
      if (e) throw e;
      if (!l)
        return NextResponse.json(
          { error: "Listing not found." },
          { status: 404 },
        );
      if (b.action === "approve") {
        const { data: broker, error } = await db
          .from("brokers")
          .select("verified")
          .eq("id", l.broker_id)
          .single();
        if (error) throw error;
        if (broker.verified !== "verified")
          return NextResponse.json(
            { error: "Approve the broker before approving their listing." },
            { status: 409 },
          );
      }
      const note = text(b.note);
      if (note.length > 2000)
        return invalid(["Moderation note must be under 2,000 characters."]);
      const modNote = text(b.note);
      if (modNote.length > 2000)
        return invalid(["Moderation note must be under 2,000 characters."]);
      // Atomic state change + audit log in one transaction (moderate_listing).
      const { error } = await db.rpc("moderate_listing", {
        target: id,
        operation: b.action,
        actor_id: user!.id,
        detail: modNote.slice(0, 500),
        actor_email: user!.email ?? "",
        note: modNote,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    } catch (e) {
      return unavailable(e);
    }
  }

  // Broker edit branch: partial update + availability status.
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `listings-edit:${user!.id}`,
  });
  if (limited) return limited;
  try {
    const db = createServiceClient();
    const { data: existing, error: e } = await db
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (e) throw e;
    if (!existing)
      return NextResponse.json(
        { error: "Listing not found." },
        { status: 404 },
      );
    const isAdmin = userRole(user) === "admin";
    if (!isAdmin && existing.broker_id !== userBrokerId(user))
      return NextResponse.json(
        { error: "This is not your listing." },
        { status: 403 },
      );
    if (isAdmin) {
      const mfa = await requireAal2();
      if (mfa) return mfa;
    }
    if ("note" in b && b.note !== undefined) {
      if (!isAdmin)
        return NextResponse.json(
          { error: "Only admins can add moderation notes." },
          { status: 403 },
        );
      if (typeof b.note !== "string" || b.note.length > 2000)
        return invalid(["Moderation note must be under 2,000 characters."]);
    }

    const errors: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    const has = (k: string) => b[k] !== undefined;

    if (has("title")) {
      if (text(b.title).length < 4 || text(b.title).length > 160)
        errors.push("Title must be 4–160 characters.");
      else patch.title = text(b.title);
    }
    if (has("rent")) {
      if (!integer(b.rent, 1))
        errors.push("Rent must be a positive whole rupee amount.");
      else patch.rent = b.rent;
    }
    if (has("deposit")) {
      if (!integer(b.deposit, 0))
        errors.push("Enter a valid deposit.");
      else patch.deposit = b.deposit;
    }
    if (has("brokDays")) {
      if (!integer(b.brokDays, 0, 60))
        errors.push("Enter a valid brokDays.");
      else {
        patch.brok_days = b.brokDays;
        patch.brok = `${b.brokDays} days`;
      }
    }
    if (has("visitFee")) {
      if (!integer(b.visitFee, 0))
        errors.push("Enter a valid visitFee.");
      else patch.visit_fee = b.visitFee;
    }
    if (has("visitFeeRefundable")) {
      if (typeof b.visitFeeRefundable !== "boolean")
        errors.push("Visit fee refundability must be true or false.");
      else patch.visit_fee_refundable = b.visitFeeRefundable;
    }
    if (has("otherFee")) {
      if (!integer(b.otherFee, 0))
        errors.push("Enter a valid otherFee.");
      else patch.other_fee = b.otherFee;
    }
    if (has("otherFeeNote")) {
      if (typeof b.otherFeeNote !== "string" || b.otherFeeNote.length > 500)
        errors.push("Other fee explanation must be under 500 characters.");
      else patch.other_fee_note = text(b.otherFeeNote).slice(0, 500);
    }
    // A non-zero other fee always needs an explanation: resolve against the
    // stored note when the edit only touches the amount.
    const resolvedOtherFee = has("otherFee")
      ? Number(b.otherFee)
      : Number(existing.other_fee ?? 0);
    const resolvedNote = has("otherFeeNote")
      ? text(b.otherFeeNote)
      : text(existing.other_fee_note);
    if (resolvedOtherFee > 0 && !resolvedNote)
      errors.push("Explain any non-zero other fee.");
    if (has("locality")) {
      if (text(b.locality).length < 2 || text(b.locality).length > 100)
        errors.push("Enter a locality (2–100 characters).");
      else patch.locality = text(b.locality);
    }
    if (has("sector")) {
      if (typeof b.sector !== "string" || b.sector.length > 100)
        errors.push("Sector must be under 100 characters.");
      else patch.sector = text(b.sector).slice(0, 100);
    }
    if (has("area")) {
      if (!integer(b.area, 1, 100_000))
        errors.push("Enter an area in square feet.");
      else patch.area = b.area;
    }
    if (has("floor")) {
      if (typeof b.floor !== "string" || b.floor.length > 100)
        errors.push("Floor must be under 100 characters.");
      else patch.floor = text(b.floor).slice(0, 100);
    }
    if (has("furnishing")) {
      if (!(FURNISHINGS as readonly string[]).includes(text(b.furnishing)))
        errors.push("Select furnishing.");
      else patch.furnishing = text(b.furnishing);
    }
    if (has("avail")) {
      if (!validAvail(b.avail)) errors.push("Select an availability date.");
      else patch.avail = text(b.avail);
    }
    if (has("desc")) {
      if (text(b.desc).length < 20 || text(b.desc).length > 4000)
        errors.push("Description must be 20–4,000 characters.");
      else patch.description = text(b.desc);
    }
    if (has("amenities")) {
      const parsed = parseAmenities(b.amenities);
      if (!parsed)
        errors.push("Amenities must be text under 1,000 characters.");
      else patch.amenities = parsed;
    }
    if (has("photos")) {
      if (
        !Array.isArray(b.photos) ||
        b.photos.length < 1 ||
        b.photos.length > 8 ||
        !b.photos.every(validPhotoUrl)
      )
        errors.push("Add 1–8 HTTPS photo URLs or upload photos.");
      else patch.photos = b.photos;
    }
    if (has("photoHashes")) {
      if (
        !Array.isArray(b.photoHashes) ||
        b.photoHashes.length > 8 ||
        !b.photoHashes.every(
          (h) => typeof h === "string" && /^[0-9a-f]{64}$/.test(h),
        )
      )
        errors.push("Photo hashes must be SHA-256 hex strings (max 8).");
      else patch.photo_hashes = b.photoHashes;
    } else if (has("photos") && patch.photos) {
      // URLs changed without re-uploads: drop stale byte-hashes so the
      // duplicate-photo check does not match the previous files.
      patch.photo_hashes = [];
    }
    if (has("availabilityStatus")) {
      if (!(AVAILABILITY as readonly string[]).includes(text(b.availabilityStatus)))
        errors.push("Choose Available, Taken or OnHold.");
      else patch.availability_status = text(b.availabilityStatus);
    }
    if (has("ownerName")) {
      if (text(b.ownerName).length < 2 || text(b.ownerName).length > 100)
        errors.push("Enter the owner's name (2–100 characters).");
      else patch.owner_name = text(b.ownerName).slice(0, 100);
    }
    if (has("ownerRelationship")) {
      if (
        !(RELATIONSHIPS as readonly string[]).includes(
          text(b.ownerRelationship),
        )
      )
        errors.push("Select whether you own the unit or market it for the owner.");
      else patch.owner_relationship = text(b.ownerRelationship);
    }
    if ("note" in b && b.note !== undefined && isAdmin) {
      // Preserve-on-empty, matching the broker moderation path: an untouched
      // note input sends "" and must not wipe existing feedback.
      if (text(b.note)) patch.moderation_note = text(b.note).slice(0, 2000);
    }

    if (!Object.keys(patch).length && !errors.length)
      return invalid(["No editable fields provided."]);
    if (errors.length) return invalid(errors);

    // Price/fee/photo edits need a fresh review; availability-only or
    // cosmetic edits (title/desc/amenities/floor/sector/avail) keep the
    // current verification state. Nothing else is appended.
    if (REREVIEW_FIELDS.some(has)) patch.verification = "pending";

    const { data: updated, error: save } = await db
      .from("listings")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (save) throw save;
    return NextResponse.json({ listing: mapListing(updated) });
  } catch (e) {
    return unavailable(e);
  }
}
