import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, rmSync } from "node:fs";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
async function main() {
  const qa = JSON.parse(readFileSync(".local/qa-account.json", "utf8"));
  const {
    data: { user },
    error,
  } = await db.auth.admin.getUserById(qa.id);
  if (error) throw error;
  if (!user?.user_metadata.thikana_qa)
    throw new Error("Not an isolated QA account.");
  const created = existsSync(".local/qa-created.json")
    ? JSON.parse(readFileSync(".local/qa-created.json", "utf8"))
    : {};
  const { data: apps, error: ae } = await db
    .from("broker_applications")
    .select("broker_id")
    .eq("owner_id", qa.id);
  if (ae) throw ae;
  const brokerIds = (apps ?? []).map((a) => a.broker_id);
  const { data: leads, error: le } = await db
    .from("leads")
    .select("id")
    .eq("owner_id", qa.id);
  if (le) throw le;
  const leadIds = [
    ...(leads ?? []).map((l) => l.id),
    created.lead,
    created.dynamicLead,
  ].filter(Boolean);
  if (leadIds.length) {
    const { error } = await db.from("reviews").delete().in("lead_id", leadIds);
    if (error) throw error;
    const r = await db.from("leads").delete().in("id", leadIds);
    if (r.error) throw r.error;
  }
  for (const id of brokerIds) {
    const { data: ls, error } = await db
      .from("listings")
      .select("id")
      .eq("broker_id", id);
    if (error) throw error;
    const ids = ls.map((l) => l.id);
    if (ids.length) {
      for (const t of ["reports", "leads"]) {
        const r = await db.from(t).delete().in("listing_id", ids);
        if (r.error) throw r.error;
      }
      const r = await db.from("listings").delete().in("id", ids);
      if (r.error) throw r.error;
    }
    const a = await db.from("broker_applications").delete().eq("broker_id", id);
    if (a.error) throw a.error;
    const b = await db.from("brokers").delete().eq("id", id);
    if (b.error) throw b.error;
  }
  for (const bucket of ["broker-proofs", "listing-photos"]) {
    const { data, error } = await db.storage.from(bucket).list(qa.id);
    if (error) throw error;
    if (data.length) {
      const r = await db.storage
        .from(bucket)
        .remove(data.map((f) => `${qa.id}/${f.name}`));
      if (r.error) throw r.error;
    }
  }
  const city = await db
    .from("city_requests")
    .delete()
    .eq("name", "QA City Request")
    .eq("city", "QA Demo City");
  if (city.error) throw city.error;
  const r = await db.auth.admin.deleteUser(qa.id);
  if (r.error) throw r.error;
  rmSync(".local/qa-account.json");
  rmSync(".local/qa-created.json", { force: true });
  console.log("Isolated QA records and account removed.");
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
