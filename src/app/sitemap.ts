import type { MetadataRoute } from "next";
import { isActive } from "@/lib/trust";
import { fetchBrokers, fetchListings } from "@/lib/supabase/data";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const STATIC_ROUTES = ["/", "/properties", "/brokers"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
  }));
  try {
    const [listings, brokers] = await Promise.all([
      fetchListings(),
      fetchBrokers(),
    ]);
    for (const l of listings.filter(
      (l) =>
        isActive(l) &&
        brokers.some((b) => b.id === l.brokerId && b.verified === "verified"),
    )) {
      pages.push({ url: `${BASE}/properties/${l.id}`, lastModified: now });
    }
    for (const b of brokers.filter((b) => b.verified === "verified")) {
      pages.push({ url: `${BASE}/brokers/${b.id}`, lastModified: now });
    }
  } catch {
    // Build must never fail offline — fall back to static routes only.
  }
  return pages;
}
