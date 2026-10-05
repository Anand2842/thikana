import {
  brokers as mockBrokers,
  listings as mockListings,
  leads as mockLeads,
  reviews as mockReviews,
  reports as mockReports,
  cityRequests as mockCityRequests,
  sameProp as mockSameProp,
  type Broker,
  type Listing,
  type Lead,
  type Review,
  type Report,
  type CityRequest,
} from "../mock-data";
import { createClient, createServiceClient } from "./server";

const hasEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// snake_case row → camelCase app type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBroker(r: any): Broker {
  return {
    id: r.id, name: r.name, agency: r.agency, photo: r.photo, verified: r.verified,
    rating: r.rating, reviews: r.reviews_count, recommend: r.recommend, accuracy: r.accuracy,
    responseRate: r.response_rate, responseTime: r.response_time, cities: r.cities ?? [], areas: r.areas ?? [],
    cats: r.cats ?? [], exp: r.exp, tenure: r.tenure, policy: r.policy, vdate: r.vdate,
    complaints: r.complaints, resolved: r.resolved, kyc: r.kyc,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapListing(r: any): Listing {
  return {
    id: r.id, propId: r.prop_id, title: r.title, city: r.city ?? "Delhi", locality: r.locality, sector: r.sector,
    bhk: r.bhk, type: r.type, rent: r.rent, deposit: r.deposit, furnishing: r.furnishing,
    area: r.area, floor: r.floor, amenities: r.amenities ?? [], avail: r.avail, brok: r.brok,
    brokDays: r.brok_days, visitFee: r.visit_fee, otherFee: r.other_fee, photos: r.photos ?? [],
    brokerId: r.broker_id, hrs: r.hrs, verification: r.verification, desc: r.description,
    views: r.views, enq: r.enq, flags: r.flags?.length ? r.flags : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLead(r: any): Lead {
  return {
    id: r.id, listingId: r.listing_id, brokerId: r.broker_id, userName: r.user_name,
    phone: r.phone, req: r.req, time: r.time, msg: r.msg, status: r.status,
    date: r.date, visit: r.visit, mine: r.mine ?? false, ownerId: r.owner_id ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReview(r: any): Review {
  return { brokerId: r.broker_id, user: r.user_name, rating: r.rating, text: r.text, date: r.date, tag: r.tag };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReport(r: any): Report {
  return { id: r.id, listingId: r.listing_id, reason: r.reason, details: r.details, reporter: r.reporter, status: r.status, date: r.date };
}

// Public catalog reads (anon key, RLS SELECT policies). Fall back to mock data offline.
export async function fetchBrokers(): Promise<Broker[]> {
  if (!hasEnv) return mockBrokers;
  try {
    const sb = await createClient();
    const { data, error } = await sb.from("brokers").select("*").order("rating", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapBroker);
  } catch {
    return mockBrokers;
  }
}

export async function fetchBroker(id: string): Promise<Broker | undefined> {
  const all = await fetchBrokers();
  return all.find((b) => b.id === id);
}

export async function fetchListings(): Promise<Listing[]> {
  if (!hasEnv) return mockListings;
  try {
    const sb = await createClient();
    const { data, error } = await sb.from("listings").select("*").order("hrs", { ascending: true });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapListing);
  } catch {
    return mockListings;
  }
}

export async function fetchListing(id: string): Promise<Listing | undefined> {
  const all = await fetchListings();
  return all.find((l) => l.id === id);
}

export async function fetchSameProp(propId: string): Promise<Listing[]> {
  const all = await fetchListings();
  const group = all.filter((l) => l.propId === propId);
  return group.length ? group : mockSameProp(propId);
}

export async function fetchBrokerListings(brokerId: string): Promise<Listing[]> {
  const all = await fetchListings();
  return all.filter((l) => l.brokerId === brokerId);
}

export async function fetchReviews(brokerId?: string): Promise<Review[]> {
  if (!hasEnv) return brokerId ? mockReviews.filter((r) => r.brokerId === brokerId) : mockReviews;
  try {
    const sb = await createClient();
    let q = sb.from("reviews").select("*").order("id", { ascending: false });
    if (brokerId) q = q.eq("broker_id", brokerId);
    const { data, error } = await q;
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapReview);
  } catch {
    return brokerId ? mockReviews.filter((r) => r.brokerId === brokerId) : mockReviews;
  }
}

// Trusted reads (service_role, bypasses RLS). Server components / API routes only.
export async function fetchLeadsSvc(): Promise<Lead[]> {
  if (!hasEnv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return mockLeads;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("leads").select("*").order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapLead);
  } catch {
    return mockLeads;
  }
}

export async function fetchReportsSvc(): Promise<Report[]> {
  if (!hasEnv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return mockReports;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("reports").select("*").order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapReport);
  } catch {
    return mockReports;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCityRequest(r: any): CityRequest {
  return {
    id: r.id, city: r.city, name: r.name, phone: r.phone, userType: r.user_type,
    note: r.note, status: r.status, date: r.date, ownerId: r.owner_id ?? null,
  };
}

export async function fetchCityRequestsSvc(): Promise<CityRequest[]> {
  if (!hasEnv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return mockCityRequests;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.from("city_requests").select("*").order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapCityRequest);
  } catch {
    return mockCityRequests;
  }
}

// Scoped private reads. Never return the full table to non-admin callers.
// - admin → everything (admin console only)
// - broker → rows assigned to their broker_id
// - seeker → rows they own (owner_id)
// Mock fallback mirrors the scoping (mock rows have no owner → seeker sees none).
export interface LeadScope {
  userId: string;
  role: "admin" | "broker" | "seeker";
  brokerId: string | null;
}

export async function fetchScopedLeads(scope: LeadScope): Promise<Lead[]> {
  if (scope.role === "admin") return fetchLeadsSvc();
  if (!hasEnv || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return scope.role === "broker" && scope.brokerId
      ? mockLeads.filter((l) => l.brokerId === scope.brokerId)
      : [];
  }
  try {
    const sb = createServiceClient();
    let q = sb.from("leads").select("*").order("id", { ascending: false });
    q = scope.role === "broker" && scope.brokerId ? q.eq("broker_id", scope.brokerId) : q.eq("owner_id", scope.userId);
    const { data, error } = await q;
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapLead);
  } catch {
    return scope.role === "broker" && scope.brokerId
      ? mockLeads.filter((l) => l.brokerId === scope.brokerId)
      : [];
  }
}

export async function fetchScopedCityRequests(scope: LeadScope): Promise<CityRequest[]> {
  if (scope.role === "admin") return fetchCityRequestsSvc();
  if (!hasEnv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("city_requests")
      .select("*")
      .eq("owner_id", scope.userId)
      .order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapCityRequest);
  } catch {
    return [];
  }
}
