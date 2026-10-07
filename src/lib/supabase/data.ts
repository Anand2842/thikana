import "server-only";
import {
  type Broker,
  type Listing,
  type Lead,
  type LeadMessage,
  type Review,
  type Report,
  type CityRequest,
} from "../mock-data";
import { createClient, createServiceClient } from "./server";
import type { Role } from "./role";
import { text } from "../validation";

const hasEnv =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// snake_case row → camelCase app type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBroker(r: any): Broker {
  return {
    id: r.id,
    name: r.name,
    agency: r.agency,
    photo: r.photo,
    verified: r.verified,
    rating: r.rating,
    reviews: r.reviews_count,
    recommend: r.recommend,
    accuracy: r.accuracy,
    responseRate: r.response_rate,
    responseTime: r.response_time,
    cities: r.cities ?? [],
    areas: r.areas ?? [],
    cats: r.cats ?? [],
    exp: r.exp,
    tenure: r.tenure,
    policy: r.policy,
    vdate: r.vdate,
    complaints: r.complaints,
    resolved: r.resolved,
    kyc: r.kyc,
    businessAddress: r.business_address ?? "",
    moderationNote: r.moderation_note ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapListing(r: any): Listing {
  return {
    id: r.id,
    propId: r.prop_id,
    title: r.title,
    city: r.city ?? "Delhi",
    locality: r.locality,
    sector: r.sector,
    bhk: r.bhk,
    type: r.type,
    rent: r.rent,
    deposit: r.deposit,
    furnishing: r.furnishing,
    area: r.area,
    floor: r.floor,
    amenities: r.amenities ?? [],
    avail: r.avail,
    brok: r.brok,
    brokDays: r.brok_days,
    visitFee: r.visit_fee,
    visitFeeRefundable: r.visit_fee_refundable ?? false,
    otherFee: r.other_fee,
    otherFeeNote: r.other_fee_note ?? "",
    photos: r.photos ?? [],
    photoHashes: r.photo_hashes ?? [],
    brokerId: r.broker_id,
    hrs: Math.max(
      0,
      Math.floor((Date.now() - Date.parse(r.last_confirmed_at)) / 3_600_000),
    ),
    verification:
      r.verification === "verified" &&
      Date.now() - Date.parse(r.last_confirmed_at) >= 604_800_000
        ? "stale"
        : r.verification,
    desc: r.description,
    views: r.views,
    enq: r.enq,
    flags: r.flags?.length ? r.flags : undefined,
    ownerName: r.owner_name ?? "",
    ownerAuthorized: r.owner_authorized ?? false,
    ownerRelationship: r.owner_relationship ?? "agent",
    availabilityStatus: r.availability_status ?? "Available",
    moderationNote: r.moderation_note ?? "",
    revision: r.revision ?? 1,
    sourceDraftId: r.source_draft_id ?? null,
    sourceRequestId: r.source_request_id ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLead(r: any): Lead {
  return {
    id: r.id,
    listingId: r.listing_id,
    brokerId: r.broker_id,
    userName: r.user_name,
    phone: r.phone,
    req: r.req,
    time: r.time,
    msg: r.msg,
    status: r.status,
    date: r.date,
    visit: r.visit,
    visitAt: r.visit_at,
    seekerVisited: r.seeker_visited,
    brokerVisited: r.broker_visited,
    visitProposedBy: r.visit_proposed_by ?? null,
    visitAccepted: r.visit_accepted ?? false,
    outcome: r.outcome ?? null,
    mine: r.mine ?? false,
    ownerId: r.owner_id ?? null,
    createdAt: r.created_at ?? null,
    firstResponseAt: r.first_response_at ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReview(r: any): Review {
  return {
    brokerId: r.broker_id,
    user: r.user_name,
    rating: r.rating,
    text: r.text,
    date: r.date,
    tag: r.tag,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReport(r: any): Report {
  return {
    id: r.id,
    listingId: r.listing_id,
    brokerId: r.broker_id ?? null,
    targetType: r.target_type === "broker" ? "broker" : "listing",
    reason: r.reason,
    details: r.details,
    reporter: r.reporter,
    status: r.status,
    date: r.date,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLeadMessage(r: any): LeadMessage {
  return {
    id: r.id,
    leadId: r.lead_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

// Real catalog reads. Provider failures are surfaced; sample data is only used by the seed script.
export async function fetchBrokers(): Promise<Broker[]> {
  if (!hasEnv) throw new Error("Supabase is not configured.");
  const sb = await createClient();
  try {
    const { data, error } = await sb
      .from("brokers")
      .select("*")
      .order("rating", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapBroker);
  } catch {
    throw new Error("Could not load brokers. Please retry.");
  }
}

export async function fetchBroker(id: string): Promise<Broker | undefined> {
  const all = await fetchBrokers();
  return all.find((b) => b.id === id);
}

export async function fetchListings(): Promise<Listing[]> {
  if (!hasEnv) throw new Error("Supabase is not configured.");
  const sb = await createClient();
  try {
    const { data, error } = await sb
      .from("listings")
      .select("*")
      .order("last_confirmed_at", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapListing);
  } catch {
    throw new Error("Could not load listings. Please retry.");
  }
}

export async function fetchListing(id: string): Promise<Listing | undefined> {
  const all = await fetchListings();
  return all.find((l) => l.id === id);
}

// Service-role full catalog (admin console only — bypasses the public
// non-pending RLS filter so pending/flagged queues are visible).
export async function fetchListingsSvc(): Promise<Listing[]> {
  if (!hasEnv || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Supabase is not configured.");
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("listings")
    .select("*")
    .order("last_confirmed_at", { ascending: false });
  if (error || !data) throw error ?? new Error("empty");
  return data.map(mapListing);
}

// Role-aware single-listing read: public catalog first, then a privileged
// preview for admins and the owning broker (pending moderation).
export async function fetchListingVisible(
  id: string,
  scope: { role: Role; brokerId: string | null },
): Promise<Listing | undefined> {
  const pub = await fetchListing(id).catch(() => undefined);
  if (pub) return pub;
  if (scope.role !== "admin" && !scope.brokerId) return undefined;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    const l = mapListing(data);
    if (scope.role === "admin" || l.brokerId === scope.brokerId) return l;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function fetchSameProp(propId: string): Promise<Listing[]> {
  const all = await fetchListings();
  const group = all.filter((l) => l.propId === propId);
  return group;
}

export async function fetchBrokerListings(
  brokerId: string,
): Promise<Listing[]> {
  const all = await fetchListings();
  return all.filter((l) => l.brokerId === brokerId);
}

export async function fetchReviews(brokerId?: string): Promise<Review[]> {
  if (!hasEnv) throw new Error("Supabase is not configured.");
  const sb = await createClient();
  try {
    let q = sb
      .from("reviews")
      .select("id,broker_id,user_name,rating,text,date,tag")
      .order("id", { ascending: false });
    if (brokerId) q = q.eq("broker_id", brokerId);
    const { data, error } = await q;
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapReview);
  } catch {
    throw new Error("Could not load reviews. Please retry.");
  }
}

// Trusted reads (service_role, bypasses RLS). Server components / API routes only.
export async function fetchLeadsSvc(): Promise<Lead[]> {
  if (!hasEnv) throw new Error("Supabase is not configured.");
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapLead);
  } catch {
    throw new Error("Could not load enquiries. Please retry.");
  }
}

export async function fetchReportsSvc(): Promise<Report[]> {
  if (!hasEnv) throw new Error("Supabase is not configured.");
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("reports")
      .select("*")
      .order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapReport);
  } catch {
    throw new Error("Could not load reports. Please retry.");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCityRequest(r: any): CityRequest {
  return {
    id: r.id,
    city: r.city,
    name: r.name,
    phone: r.phone,
    userType: r.user_type,
    note: r.note,
    status: r.status,
    date: r.date,
    ownerId: r.owner_id ?? null,
  };
}

export async function fetchCityRequestsSvc(): Promise<CityRequest[]> {
  if (!hasEnv) throw new Error("Supabase is not configured.");
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("city_requests")
      .select("*")
      .order("id", { ascending: false });
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapCityRequest);
  } catch {
    throw new Error("Could not load city requests. Please retry.");
  }
}

// Scoped private reads. Never return the full table to non-admin callers.
// - admin → everything (admin console only)
// - broker → rows assigned to their broker_id
// - seeker → rows they own (owner_id)
// Scope is derived from the authenticated session.
export interface LeadScope {
  userId: string;
  role: "admin" | "broker" | "seeker";
  brokerId: string | null;
}

export async function fetchScopedLeads(scope: LeadScope): Promise<Lead[]> {
  if (scope.role === "admin") return fetchLeadsSvc();
  try {
    const sb = createServiceClient();
    let q = sb.from("leads").select("*").order("id", { ascending: false });
    q =
      scope.role === "broker" && scope.brokerId
        ? q.eq("broker_id", scope.brokerId)
        : q.eq("owner_id", scope.userId);
    const { data, error } = await q;
    if (error || !data) throw error ?? new Error("empty");
    return data.map(mapLead);
  } catch {
    throw new Error("Could not load enquiries. Please retry.");
  }
}

export async function fetchSavedIds(userId: string): Promise<string[]> {  const { data, error } = await createServiceClient()
    .from("saved_listings")
    .select("listing_id")
    .eq("owner_id", userId);
  if (error) throw error;
  return data.map((r) => r.listing_id);
}
export async function fetchReviewedIds(userId: string): Promise<string[]> {
  const { data, error } = await createServiceClient()
    .from("reviews")
    .select("lead_id")
    .eq("owner_id", userId);
  if (error) throw error;
  return data.map((r) => r.lead_id);
}

// Messages for one enquiry, visible only to its participants (owner seeker,
// assigned broker) and admins. Callers must scope the lead first.
export async function fetchLeadMessages(leadId: string): Promise<LeadMessage[]> {
  const { data, error } = await createServiceClient()
    .from("lead_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(mapLeadMessage);
}

// Reports filed by one user, for tenant-visible complaint progress.
export async function fetchMyReports(userId: string): Promise<Report[]> {
  const { data, error } = await createServiceClient()
    .from("reports")
    .select("*")
    .eq("owner_id", userId)
    .order("id", { ascending: false });
  if (error) throw error;
  return data.map(mapReport);
}

// Audit trail for admin moderation decisions (admin console only).
export interface AdminAction {
  id: number;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: string;
}
export async function logAdminAction(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  detail = "",
): Promise<void> {
  const { error } = await createServiceClient()
    .from("admin_actions")
    .insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail.slice(0, 1000),
    });
  if (error) throw error;
}
export async function fetchAdminActions(limit = 30): Promise<AdminAction[]> {
  const { data, error } = await createServiceClient()
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    detail: r.detail ?? "",
    createdAt: r.created_at,
  }));
}

// KYC review checklist for one broker application. Document paths stay
// private; only presence + contact confirmation + address are exposed.
export interface KycCheck {
  hasIdentity: boolean;
  hasBusiness: boolean;
  emailConfirmed: boolean;
  phoneConfirmed: boolean;
  phoneOtpStatus: string;
  hasAddress: boolean;
  missing: string[];
}
export async function fetchApplicantChecks(
  brokerId: string,
): Promise<KycCheck> {
  const db = createServiceClient();
  const [{ data: app }, { data: broker }] = await Promise.all([
    db
      .from("broker_applications")
      .select("owner_id,phone,identity_path,business_path")
      .eq("broker_id", brokerId)
      .maybeSingle(),
    db.from("brokers").select("business_address").eq("id", brokerId).maybeSingle(),
  ]);
  let emailConfirmed = false,
    phoneConfirmed = false;
  if (app?.owner_id) {
    try {
      const { data } = await db.auth.admin.getUserById(app.owner_id);
      emailConfirmed = !!data.user?.email_confirmed_at;
      phoneConfirmed = !!data.user?.phone_confirmed_at;
    } catch {
      // Auth lookup failure must not abort moderation — surfaced as unchecked.
    }
  }
  const missing: string[] = [];
  if (!app?.identity_path) missing.push("identity proof");
  if (!app?.business_path) missing.push("business proof");
  if (!emailConfirmed) missing.push("confirmed email");
  if (!text(app?.phone ?? "")) missing.push("contact phone");
  if (!text(broker?.business_address ?? "")) missing.push("business address");
  return {
    hasIdentity: !!app?.identity_path,
    hasBusiness: !!app?.business_path,
    emailConfirmed,
    // Phone OTP needs an SMS provider (ops blocker): presence is required,
    // verification is labeled, not faked. See phoneOtpStatus below.
    phoneConfirmed,
    phoneOtpStatus:
      "Phone OTP verification needs an SMS provider — phone is on file, not OTP-verified.",
    hasAddress: !!text(broker?.business_address ?? ""),
    missing,
  };
}

// Investigator/reporter notes on a report.
export interface ReportNote {
  id: string;
  reportId: string;
  authorId: string;
  body: string;
  createdAt: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReportNote(r: any): ReportNote {
  return {
    id: r.id,
    reportId: r.report_id,
    authorId: r.author_id,
    body: r.body,
    createdAt: r.created_at,
  };
}
export async function fetchReportNotes(
  reportIds: string[],
): Promise<ReportNote[]> {
  if (!reportIds.length) return [];
  const { data, error } = await createServiceClient()
    .from("report_notes")
    .select("*")
    .in("report_id", reportIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapReportNote);
}
export async function fetchBrokerVerification(brokerId: string): Promise<{
  identitySubmitted: boolean;
  businessSubmitted: boolean;
  reviewedAt: string | null;
}> {
  const { data, error } = await createServiceClient()
    .from("broker_applications")
    .select("identity_path,business_path,created_at")
    .eq("broker_id", brokerId)
    .maybeSingle();
  if (error) throw error;
  return {
    identitySubmitted: !!data?.identity_path,
    businessSubmitted: !!data?.business_path,
    reviewedAt: data?.created_at ?? null,
  };
}

// Unread message counts per lead for one viewer (inbox badges).
// Unread = messages with created_at after the viewer's last_read_at in
// lead_reads (migration-014); a lead with no read row counts all its
// messages as unread. Bulk-fetched with .in() (two queries, no per-lead
// N+1). Server-side only (service client, bypasses RLS).
export async function fetchUnreadCounts(
  userId: string,
  leadIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (leadIds.length === 0) return counts;
  const sb = createServiceClient();
  const [{ data: msgs, error: msgError }, { data: reads, error: readError }] =
    await Promise.all([
      sb.from("lead_messages").select("lead_id,created_at").in("lead_id", leadIds),
      sb
        .from("lead_reads")
        .select("lead_id,last_read_at")
        .eq("user_id", userId)
        .in("lead_id", leadIds),
    ]);
  if (msgError) throw msgError;
  if (readError) throw readError;
  const lastRead = new Map(
    (reads ?? []).map((r) => [r.lead_id as string, Date.parse(r.last_read_at as string)]),
  );
  for (const m of msgs ?? []) {
    const lid = m.lead_id as string,
      at = Date.parse(m.created_at as string),
      seen = lastRead.get(lid);
    if (seen === undefined || at > seen)
      counts.set(lid, (counts.get(lid) ?? 0) + 1);
  }
  return counts;
}
