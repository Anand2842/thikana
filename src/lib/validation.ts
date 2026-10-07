import { PHASE1_CITIES } from "./mock-data";

export const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const validPhone = (v: unknown) => /^\d{10}$/.test(text(v));
export const validCity = (v: unknown) =>
  (PHASE1_CITIES as readonly string[]).includes(text(v));
export const integer = (v: unknown, min = 0, max = 10_000_000) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export function validateLead(value: unknown) {
  const b = object(value),
    errors: string[] = [];
  if (text(b.name).length < 2 || text(b.name).length > 100)
    errors.push("Name must be 2–100 characters.");
  if (!validPhone(b.phone)) errors.push("Enter a valid 10-digit phone number.");
  if (!text(b.listingId)) errors.push("Choose a listing.");
  if (b.msg !== undefined && (typeof b.msg !== "string" || b.msg.length > 2000))
    errors.push("Message must be under 2,000 characters.");
  return errors;
}
export const OWNER_RELATIONSHIPS = ["owner", "agent", "subagent"] as const;
export const AVAILABILITY_STATUSES = ["Available", "Taken", "OnHold"] as const;
export const LEAD_OUTCOMES = ["booked", "not_interested"] as const;
export const validRelationship = (v: unknown) =>
  (OWNER_RELATIONSHIPS as readonly string[]).includes(text(v));
export const validAvailability = (v: unknown) =>
  (AVAILABILITY_STATUSES as readonly string[]).includes(text(v));
export const validOutcome = (v: unknown) =>
  (LEAD_OUTCOMES as readonly string[]).includes(text(v));
export function validateListing(value: unknown) {
  const b = object(value),
    errors: string[] = [];
  if (text(b.title).length < 4 || text(b.title).length > 160)
    errors.push("Title must be 4–160 characters.");
  if (!validCity(b.city)) errors.push("Select a supported city.");
  if (text(b.locality).length < 2 || text(b.locality).length > 100)
    errors.push("Enter a locality (2–100 characters).");
  if (text(b.address).length < 8 || text(b.address).length > 300)
    errors.push("Enter the full property address (8–300 characters).");
  if (!integer(b.rent, 1))
    errors.push("Rent must be a positive whole rupee amount.");
  if (!integer(b.bhk, 1, 10)) errors.push("BHK must be between 1 and 10.");
  for (const key of ["deposit", "brokDays", "visitFee", "otherFee"])
    if (!integer(b[key], 0, key === "brokDays" ? 60 : 10_000_000))
      errors.push(`Enter a valid ${key}.`);
  if (
    b.visitFeeRefundable !== undefined &&
    typeof b.visitFeeRefundable !== "boolean"
  )
    errors.push("Visit fee refundability must be true or false.");
  if (b.otherFeeNote !== undefined) {
    if (typeof b.otherFeeNote !== "string" || b.otherFeeNote.length > 500)
      errors.push("Other fee explanation must be under 500 characters.");
  }
  // Required whenever a non-zero other fee is charged — whether or not the
  // explanation field was submitted. Omitting the field must not bypass it.
  if (Number(b.otherFee) > 0 && !text(b.otherFeeNote))
    errors.push("Explain any non-zero other fee.");
  if (!integer(b.area, 1, 100_000))
    errors.push("Enter an area in square feet.");
  if (
    !["Apartment", "Builder Floor", "Independent House", "Studio"].includes(
      text(b.type),
    )
  )
    errors.push("Select a property type.");
  if (
    !["Unfurnished", "Semi-Furnished", "Fully Furnished"].includes(
      text(b.furnishing),
    )
  )
    errors.push("Select furnishing.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text(b.avail)) ||
    !Number.isFinite(Date.parse(text(b.avail))) ||
    new Date(text(b.avail)).toISOString().slice(0, 10) !== text(b.avail)
  )
    errors.push("Select an availability date.");
  if (text(b.desc).length < 20 || text(b.desc).length > 4000)
    errors.push("Description must be 20–4,000 characters.");
  if (
    b.amenities !== undefined &&
    (typeof b.amenities !== "string" || b.amenities.length > 1000)
  )
    errors.push("Amenities must be text under 1,000 characters.");
  if (text(b.ownerName).length < 2 || text(b.ownerName).length > 100)
    errors.push("Enter the owner's name (2–100 characters).");
  if (!(b.authorized === true || b.authorized === "on" || b.authorized === "true"))
    errors.push(
      "Confirm you are authorized by the owner/landlord to market this property.",
    );
  if (!validRelationship(b.ownerRelationship))
    errors.push("Select whether you own the unit or market it for the owner.");
  if (
    !Array.isArray(b.photos) ||
    b.photos.length < 1 ||
    b.photos.length > 8 ||
    !b.photos.every(validPhotoUrl)
  )
    errors.push("Add 1–8 HTTPS photo URLs or upload photos.");
  if (
    b.photoHashes !== undefined &&
    (!Array.isArray(b.photoHashes) ||
      b.photoHashes.length > 8 ||
      !b.photoHashes.every(
        (h) => typeof h === "string" && /^[0-9a-f]{64}$/.test(h),
      ))
  )
    errors.push("Photo hashes must be SHA-256 hex strings (max 8).");
  return errors;
}
export function validPhotoUrl(v: unknown) {
  if (typeof v !== "string" || v.length > 2048) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function validateBroker(value: unknown) {
  const b = object(value),
    errors: string[] = [];
  for (const key of ["name", "agency"])
    if (text(b[key]).length < 2 || text(b[key]).length > 100)
      errors.push(`${key} must be 2–100 characters.`);
  if (!validPhone(b.phone)) errors.push("Enter a valid 10-digit phone number.");
  if (!validCity(b.city)) errors.push("Select a supported city.");
  if (
    !Array.isArray(b.areas) ||
    !b.areas.length ||
    b.areas.length > 20 ||
    !b.areas.every((v) => text(v).length >= 2 && text(v).length <= 100)
  )
    errors.push("Add 1–20 areas served.");
  if (text(b.policy).length < 10 || text(b.policy).length > 1000)
    errors.push("Describe your brokerage policy (10–1,000 characters).");
  if (!text(b.identityPath) || !text(b.businessPath))
    errors.push("Upload identity and business proof.");
  if (b.photo !== undefined && b.photo !== "" && !validPhotoUrl(b.photo))
    errors.push("Profile photo must be a valid HTTPS URL.");
  if (
    b.businessAddress !== undefined &&
    (typeof b.businessAddress !== "string" || b.businessAddress.length > 300)
  )
    errors.push("Business address must be under 300 characters.");
  if (b.exp !== undefined && !integer(b.exp, 0, 50))
    errors.push("Experience must be 0–50 years.");
  if (
    b.cats !== undefined &&
    (!Array.isArray(b.cats) ||
      b.cats.length > 10 ||
      !b.cats.every(
        (v) => typeof v === "string" && text(v).length >= 1 && text(v).length <= 50,
      ))
  )
    errors.push("Specialties must be up to 10 labels.");
  return errors;
}
export function validateCityRequest(value: unknown) {  const b = object(value),
    errors: string[] = [];
  if (text(b.city).length < 2 || text(b.city).length > 100)
    errors.push("Tell us which city you want (2–100 characters).");
  if (PHASE1_CITIES.some((c) => c.toLowerCase() === text(b.city).toLowerCase()))
    errors.push("We're already live there — search properties instead!");
  if (text(b.name).length < 2 || text(b.name).length > 100)
    errors.push("Name must be 2–100 characters.");
  if (!validPhone(b.phone)) errors.push("Enter a valid 10-digit phone number.");
  if (!["broker", "seeker"].includes(text(b.userType)))
    errors.push("Select whether you are a broker or seeker.");
  return errors;
}
export function validateMessage(value: unknown) {
  const b = object(value),
    errors: string[] = [];
  if (text(b.body).length < 1 || text(b.body).length > 2000)
    errors.push("Message must be 1–2,000 characters.");
  return errors;
}
export const REPORT_REASONS = [
  "Advance fee demand",
  "Wrong details",
  "Duplicate photos",
  "Unavailable property",
  "Unprofessional behavior",
  "Other",
] as const;
export function validateReport(value: unknown) {
  const b = object(value),
    errors: string[] = [];
  const target = text(b.targetType) || "listing";
  if (!["listing", "broker"].includes(target))
    errors.push("Report must target a listing or a broker.");
  if (target === "listing" && !text(b.listingId))
    errors.push("Choose a listing to report.");
  if (target === "broker" && !text(b.brokerId))
    errors.push("Choose a broker to report.");
  if (
    !(REPORT_REASONS as readonly string[]).includes(text(b.reason)) ||
    text(b.details).length < 10 ||
    text(b.details).length > 2000
  )
    errors.push("Choose a reason and describe the issue (10–2,000 characters).");
  return errors;
}
