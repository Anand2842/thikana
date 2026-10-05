import type { MetadataRoute } from "next";
import { fetchBrokers, fetchListings } from "@/lib/supabase/data";

const BASE = "https://thikana.rent";

const STATIC_ROUTES = [
  "/",
  "/properties",
  "/brokers",
  "/dashboard",
  "/broker/dashboard",
  "/broker/onboard",
  "/broker/listings/new",
  "/admin",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
  }));
  try {
    const [listings, brokers] = await Promise.all([fetchListings(), fetchBrokers()]);
    for (const l of listings) {
      pages.push({ url: `${BASE}/properties/${l.id}`, lastModified: now });
    }
    for (const b of brokers) {
      pages.push({ url: `${BASE}/brokers/${b.id}`, lastModified: now });
    }
  } catch {
    // Build must never fail offline — fall back to static routes only.
  }
  return pages;
}
