import type { Listing } from "./mock-data";

export const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

export type Freshness = { label: string; tone: string };

export function freshness(l: Listing): Freshness {
  if (l.verification === "flagged")
    return { label: "Flagged · under review", tone: "flagged" };
  if (l.verification === "stale")
    return { label: `Stale · ${Math.round(l.hrs / 24)}d old`, tone: "stale" };
  if (l.verification === "pending")
    return { label: "Pending verification", tone: "pending" };
  if (l.hrs < 12)
    return { label: `Verified ${l.hrs}h ago · Fresh`, tone: "fresh" };
  if (l.hrs < 48)
    return { label: `Verified ${l.hrs}h ago · Recent`, tone: "recent" };
  if (l.hrs < 168)
    return {
      label: `Verified ${Math.round(l.hrs / 24)}d ago · Aging`,
      tone: "aging",
    };
  return { label: "Needs reconfirm", tone: "stale" };
}

export const STALE_AFTER_HRS = 168;

// Server snapshot timestamp. Call once per render and pass down, so time
// comparisons stay stable within a single server render.
export const nowMs = () => Date.now();

export function isActive(l: Listing) {
  // Availability is part of active: Taken / On Hold homes leave search,
  // sitemap, broker inventories and enquiry intake (all filter via isActive).
  // Legacy rows without the field default to Available in mapListing.
  return (
    l.verification === "verified" &&
    l.hrs < STALE_AFTER_HRS &&
    l.availabilityStatus !== "Taken" &&
    l.availabilityStatus !== "OnHold"
  );
}

export const LEAD_STAGES = [
  "New",
  "Contacted",
  "Visit Scheduled",
  "Visited",
  "Negotiating",
  "Closed",
] as const;

export const brokerageAmount = (l: Listing) =>
  Math.round((l.rent * l.brokDays) / 30);
export const moveInTotal = (l: Listing) =>
  l.rent + l.deposit + brokerageAmount(l) + l.visitFee + l.otherFee;
