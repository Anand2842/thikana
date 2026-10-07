import { PHASE1_CITIES } from "./mock-data";
import { text, validPhotoUrl } from "./validation";

// Draft field checks: per-field, lenient (partial saves allowed). Full
// validateListing still gates actual submission.
const draftFieldRules: Record<string, (v: unknown) => string | null> = {
  title: (v) =>
    text(v).length < 4 || text(v).length > 160
      ? "Title must be 4–160 characters."
      : null,
  city: (v) =>
    !(PHASE1_CITIES as readonly string[]).includes(text(v))
      ? "Select a supported city."
      : null,
  locality: (v) =>
    text(v).length < 2 || text(v).length > 100
      ? "Enter a locality (2–100 characters)."
      : null,
  address: (v) =>
    text(v).length < 8 || text(v).length > 300
      ? "Enter the full property address (8–300 characters)."
      : null,
  rent: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v <= 0
      ? "Rent must be a positive whole rupee amount."
      : null,
  deposit: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 10_000_000
      ? "Enter a valid deposit."
      : null,
  brokDays: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 60
      ? "Brokerage must be 0–60 days."
      : null,
  visitFee: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 10_000_000
      ? "Enter a valid visit fee."
      : null,
  otherFee: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 10_000_000
      ? "Enter a valid other fee."
      : null,
  bhk: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 10
      ? "BHK must be between 1 and 10."
      : null,
  area: (v) =>
    typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 100_000
      ? "Enter an area in square feet."
      : null,
  ownerName: (v) =>
    text(v).length < 2 || text(v).length > 100
      ? "Enter the owner's name (2–100 characters)."
      : null,
  unit: (v) =>
    text(v).length > 100 ? "Unit reference must be under 100 characters." : null,
};

export function validateDraftFields(
  fields: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    const rule = draftFieldRules[k];
    if (!rule) continue;
    const err = rule(v);
    if (err) errors.push(err);
  }
  if (
    fields.photos !== undefined &&
    (!Array.isArray(fields.photos) ||
      fields.photos.length > 8 ||
      !(fields.photos as unknown[]).every(validPhotoUrl))
  )
    errors.push("Photos must be up to 8 HTTPS URLs.");
  return errors;
}

export interface DraftReadiness {
  ready: boolean;
  missing: string[];
}

// Derived from current fields + confirmations — never persisted, so it
// cannot go stale. Submission additionally runs full validateListing.
export function draftReadiness(
  fields: Record<string, unknown>,
  confirmations: Record<string, unknown>,
): DraftReadiness {
  const missing: string[] = [];
  if (!(typeof fields.rent === "number" && fields.rent > 0))
    missing.push("rent");
  if (!text(fields.furnishing)) missing.push("furnishing");
  if (!text(fields.avail)) missing.push("availability date");
  if (text(fields.ownerName).length < 2) missing.push("owner identity");
  if (confirmations.authority !== true) missing.push("owner permission");
  if (confirmations.fees !== true) missing.push("fee confirmation");
  if (
    !Array.isArray(fields.photos) ||
    (fields.photos as unknown[]).length < 1
  )
    missing.push("photos");
  if (!text(fields.city) || !text(fields.locality) || !text(fields.address))
    missing.push("full address");
  return { ready: missing.length === 0, missing };
}

export interface BuildingInput {
  label?: unknown;
  city?: unknown;
  locality?: unknown;
  street?: unknown;
  sector?: unknown;
  amenities?: unknown;
  defaults?: unknown;
}

export function validateBuilding(b: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (text(b.label).length > 120) errors.push("Label must be under 120 characters.");
  if (b.city !== undefined && !(PHASE1_CITIES as readonly string[]).includes(text(b.city)))
    errors.push("Select a supported city.");
  if (text(b.locality).length > 100) errors.push("Locality must be under 100 characters.");
  if (text(b.street).length > 300) errors.push("Street must be under 300 characters.");
  if (!Array.isArray(b.amenities ?? [])) errors.push("Amenities must be a list.");
  if (b.defaults !== undefined && (typeof b.defaults !== "object" || b.defaults === null || Array.isArray(b.defaults)))
    errors.push("Defaults must be an object.");
  return errors;
}
