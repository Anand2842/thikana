import { PHASE1_CITIES } from "./mock-data";

export function validPhone(phone: string) {
  return /^\d{10}$/.test(phone.trim());
}

export function validCity(city: unknown) {
  return typeof city === "string" && (PHASE1_CITIES as readonly string[]).includes(city);
}

export function validateLead(input: { name?: string; phone?: string; listingId?: string }) {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!input.phone || !validPhone(input.phone)) errors.push("Enter a valid 10-digit phone number.");
  if (!input.listingId) errors.push("listingId is required.");
  return errors;
}

export function validateListing(input: Record<string, unknown>) {
  const errors: string[] = [];
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!input.title || String(input.title).length < 4) errors.push("title is required (min 4 chars).");
  if (!input.locality) errors.push("locality is required.");
  if (!num(input.rent) || (input.rent as number) <= 0) errors.push("rent must be a positive number.");
  if (!num(input.bhk) || (input.bhk as number) <= 0) errors.push("bhk must be a positive number.");
  if (!input.brokerId) errors.push("brokerId is required.");
  if (!validCity(input.city)) errors.push(`city must be one of: ${PHASE1_CITIES.join(", ")}.`);
  return errors;
}

export function validateBroker(input: Record<string, unknown>) {
  const errors: string[] = [];
  if (!input.name || String(input.name).length < 2) errors.push("name is required.");
  if (!input.agency || String(input.agency).length < 2) errors.push("agency is required.");
  if (!input.phone || !validPhone(String(input.phone))) errors.push("Enter a valid 10-digit phone number.");
  if (!Array.isArray(input.areas) || (input.areas as unknown[]).length === 0)
    errors.push("At least one area served is required.");
  if (input.city !== undefined && !validCity(input.city))
    errors.push(`city must be one of: ${PHASE1_CITIES.join(", ")}.`);
  return errors;
}

export function validateCityRequest(input: { city?: string; name?: string; phone?: string; userType?: string }) {
  const errors: string[] = [];
  if (!input.city || String(input.city).trim().length < 2) errors.push("Tell us which city you want.");
  if (input.city && validCity(input.city)) errors.push("We're already live there — search properties instead!");
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!input.phone || !validPhone(input.phone)) errors.push("Enter a valid 10-digit phone number.");
  return errors;
}
