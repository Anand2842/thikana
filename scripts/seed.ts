// Seed Supabase from the prototype dataset: `npm run seed`
// Uses the service-role key (server only). Run from repo root with .env present.
import { createClient } from "@supabase/supabase-js";
import { brokers, listings, leads, reviews, reports } from "../src/lib/mock-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Missing Supabase env — check .env");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const brokerRows = brokers.map((b) => ({
    id: b.id, name: b.name, agency: b.agency, photo: b.photo, verified: b.verified,
    rating: b.rating, reviews_count: b.reviews, recommend: b.recommend, accuracy: b.accuracy,
    response_rate: b.responseRate, response_time: b.responseTime, cities: b.cities, areas: b.areas, cats: b.cats,
    exp: b.exp, tenure: b.tenure, policy: b.policy, vdate: b.vdate,
    complaints: b.complaints, resolved: b.resolved, kyc: b.kyc,
  }));
  const { error: e1 } = await db.from("brokers").upsert(brokerRows);
  if (e1) throw e1;
  console.log(`brokers: ${brokerRows.length}`);

  const listingRows = listings.map((l) => ({
    id: l.id, prop_id: l.propId, title: l.title, city: l.city, locality: l.locality, sector: l.sector,
    bhk: l.bhk, type: l.type, rent: l.rent, deposit: l.deposit, furnishing: l.furnishing,
    area: l.area, floor: l.floor, amenities: l.amenities, avail: l.avail, brok: l.brok,
    brok_days: l.brokDays, visit_fee: l.visitFee, other_fee: l.otherFee, photos: l.photos,
    broker_id: l.brokerId, hrs: l.hrs, verification: l.verification, description: l.desc,
    views: l.views, enq: l.enq, flags: l.flags ?? [],
  }));
  const { error: e2 } = await db.from("listings").upsert(listingRows);
  if (e2) throw e2;
  console.log(`listings: ${listingRows.length}`);

  const leadRows = leads.map((l) => ({
    id: l.id, listing_id: l.listingId, broker_id: l.brokerId, user_name: l.userName,
    phone: l.phone, req: l.req, time: l.time, msg: l.msg, status: l.status,
    date: l.date, visit: l.visit, mine: l.mine, owner_id: null,
  }));
  const { error: e3 } = await db.from("leads").upsert(leadRows);
  if (e3) throw e3;
  console.log(`leads: ${leadRows.length}`);

  await db.from("reviews").delete().neq("id", 0);
  const { error: e4 } = await db.from("reviews").insert(
    reviews.map((r) => ({ broker_id: r.brokerId, user_name: r.user, rating: r.rating, text: r.text, date: r.date, tag: r.tag }))
  );
  if (e4) throw e4;
  console.log(`reviews: ${reviews.length}`);

  const { error: e5 } = await db.from("reports").upsert(
    reports.map((r) => ({ id: r.id, listing_id: r.listingId, reason: r.reason, details: r.details, reporter: r.reporter, status: r.status, date: r.date }))
  );
  if (e5) throw e5;
  console.log(`reports: ${reports.length}`);
  console.log("seed complete");
}

main().catch((e) => { console.error("seed failed:", e.message); process.exit(1); });
