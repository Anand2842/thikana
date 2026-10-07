// Admin-readiness verification: MFA coverage, broker resolve, KYC block,
// notes reply, retention with aged fixture (delete after run).
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const B = "http://localhost:3001";
const admin = createClient(url, svc, { auth: { persistSession: false } });
const stamp = Date.now().toString().slice(-6);
let pass = 0, fail = 0;
const check = (n, c, d = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : " " + d)); };
const CK = (s) => `sb-foiskjtrkywbqpzbxfws-auth-token=base64-` + Buffer.from(JSON.stringify(s)).toString("base64url");
function totp(secretB32, t = Math.floor(Date.now() / 30000)) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{1,8}/g).map((b) => parseInt(b.padEnd(8, "0"), 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(t));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]).toString().slice(-6).padStart(6, "0");
}
async function mkuser(prefix, meta) {
  const email = `${prefix}-${stamp}@example.com`;
  const pw = `Str0ng!${stamp}zz`;
  await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, app_metadata: meta });
  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { data } = await userClient.auth.signInWithPassword({ email, password: pw });
  return { email, ck: CK(data.session), id: data.user.id, userClient };
}
const H = (ck) => ({ "Content-Type": "application/json", Cookie: ck });
async function req(method, path, ck, body) {
  const r = await fetch(`${B}${path}`, { method, headers: { ...H(ck) }, body: body ? JSON.stringify(body) : undefined });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, json: j };
}

const adm = await mkuser("adm7", { role: "admin" });
const H1 = H(adm.ck);
// AAL1 admin blocked on EVERY admin path
const probes = [
  ["PATCH", "/api/brokers/B1", { action: "suspend", note: "x" }],
  ["PATCH", "/api/listings/L001", { action: "flag" }],
  ["POST", "/api/listings/L001/reconfirm", null],
  ["GET", "/api/leads", null],
  ["GET", "/api/city-requests", null],
];
for (const [m, p, b] of probes) {
  const r = await req(m, p, adm.ck, b);
  check(`aal1 ${m} ${p} → 403`, r.status === 403, `${r.status}`);
}
let r = await fetch(`${B}/broker/dashboard?broker=B1`, { headers: { Cookie: adm.ck }, redirect: "manual" });
check("aal1 broker preview → mfa redirect", r.status === 307 && (r.headers.get("location") || "").includes("mfa"), `${r.status}`);

// step up to aal2 via real TOTP
const { data: enr } = await adm.userClient.auth.mfa.enroll({ factorType: "totp" });
const ch = await adm.userClient.auth.mfa.challenge({ factorId: enr.id });
await adm.userClient.auth.mfa.verify({ factorId: enr.id, challengeId: ch.data.id, code: totp(enr.totp.secret) });
const { data: sess2 } = await adm.userClient.auth.getSession();
const ck2 = CK(sess2.session);
const H2 = H(ck2);

// broker-report resolve suspends (not silent)
await admin.from("brokers").insert({ id: "BAdm" + stamp, name: "Bad", agency: "Bad Ag", verified: "verified", cities: ["Delhi"], areas: ["Dwarka"], policy: "x" });
await admin.from("reports").insert({ id: "RPB" + stamp, target_type: "broker", broker_id: "BAdm" + stamp, listing_id: null, reason: "Other", details: "Admin probe with sufficient detail.", reporter: "probe", status: "Open", date: "6 Oct 2026", owner_id: adm.id });
r = await req("PATCH", `/api/reports/RPB${stamp}`, ck2, { uphold: true });
const bstat = await admin.from("brokers").select("verified").eq("id", "BAdm" + stamp).single();
check("broker uphold suspends", r.status === 200 && bstat.data?.verified === "suspended", `${r.status}/${bstat.data?.verified}`);

// KYC blocks incomplete applicant
await admin.from("brokers").insert({ id: "BKYC" + stamp, name: "K", agency: "K Ag", verified: "pending", cities: ["Delhi"], areas: ["Dwarka"], policy: "x" });
r = await req("PATCH", `/api/brokers/BKYC${stamp}`, ck2, { action: "approve" });
check("approve incomplete → 409", r.status === 409, `${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);

// reporter reply + read
const seeker = await mkuser("s7", { role: "seeker" });
r = await req("POST", "/api/reports", seeker.ck, { targetType: "listing", listingId: "L001", reason: "Other", details: "Reporter probe with sufficient detail text." });
const repId = r.json.report?.id;
check("report filed", r.status === 201 && !!repId, `${r.status}`);
r = await req("POST", `/api/reports/${repId}/notes`, seeker.ck, { body: "Here is the extra evidence you asked for." });
check("reporter reply 201", r.status === 201, `${r.status}`);
r = await req("GET", `/api/reports/${repId}/notes`, seeker.ck);
check("reporter reads thread", r.status === 200 && r.json.notes?.length === 1, `${r.status}`);

// retention with aged fixture (2y boundary NOT touched; 4y IS)
await admin.from("leads").insert({ id: "LD-OLD" + stamp, listing_id: "L001", broker_id: "B1", user_name: "Old", phone: "9000000000", msg: "old", status: "New", created_at: new Date(Date.now() - 4 * 365 * 864e5).toISOString() });
await admin.from("leads").insert({ id: "LD-YOUNG" + stamp, listing_id: "L001", broker_id: "B1", user_name: "Young", phone: "9000000001", msg: "young", status: "New", created_at: new Date(Date.now() - 2 * 365 * 864e5).toISOString() });
await admin.from("lead_messages").insert({ id: "LM-OLD" + stamp, lead_id: "LD-OLD" + stamp, sender_id: adm.id, body: "old secret msg" });
const secret = process.env.CRON_SECRET;
r = await fetch(`${B}/api/cron/retention`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
const old = await admin.from("leads").select("user_name,phone").eq("id", "LD-OLD" + stamp).single();
const young = await admin.from("leads").select("user_name").eq("id", "LD-YOUNG" + stamp).single();
const oldMsgs = await admin.from("lead_messages").select("id").eq("lead_id", "LD-OLD" + stamp);
check("4y lead anonymized + msgs deleted", r.status === 200 && old.data?.user_name === "[redacted]" && (oldMsgs.data ?? []).length === 0, `${r.status}`);
check("2y lead untouched", young.data?.user_name === "Young", young.data?.user_name);
// decision log has entries
const logs = await admin.from("admin_actions").select("id").limit(5);
check("decision log written", (logs.data ?? []).length > 0, `${(logs.data ?? []).length}`);

console.log(`TOTAL pass=${pass} fail=${fail}`);
await admin.from("reports").delete().in("id", ["RPB" + stamp, repId].filter(Boolean));
await admin.from("leads").delete().in("id", ["LD-OLD" + stamp, "LD-YOUNG" + stamp]);
await admin.from("brokers").delete().in("id", ["BAdm" + stamp, "BKYC" + stamp]);
const { data: { users } } = await admin.auth.admin.listUsers();
for (const u of users.filter((u) => u.email.endsWith(`-${stamp}@example.com`))) await admin.auth.admin.deleteUser(u.id);
console.log("cleaned");
