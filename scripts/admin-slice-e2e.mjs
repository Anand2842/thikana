// Admin slice verification: MFA gate, broker-report resolve, KYC prereqs,
// investigation workflow, KPIs render, decision log, retention cron.
// Deletes all fixtures after run.
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
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error("bad b32");
    bits += v.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{1,8}/g).map((b) => parseInt(b.padEnd(8, "0"), 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(t));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]).toString().slice(-6).padStart(6, "0");
}

const email = `adm-${stamp}@example.com`;
const pw = `Str0ng!${stamp}zz`;
await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, app_metadata: { role: "admin" } });
const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const { data: sess } = await userClient.auth.signInWithPassword({ email, password: pw });
const ck1 = CK(sess.session);
const H1 = { "Content-Type": "application/json", Cookie: ck1 };

// 1. password-only admin blocked from moderation API
let r = await fetch(`${B}/api/brokers/B1`, { method: "PATCH", headers: H1, body: JSON.stringify({ action: "suspend", note: "x" }) });
check("aal1 admin PATCH → 403 MFA", r.status === 403, `${r.status} ${(await r.text()).slice(0, 80)}`);
r = await fetch(`${B}/admin`, { headers: { Cookie: ck1 }, redirect: "manual" });
check("aal1 /admin → redirect to mfa", r.status === 307 && (r.headers.get("location") || "").includes("/admin/mfa"), `${r.status}`);

// 2. enroll + verify TOTP → aal2
const { data: enr, error: ee } = await userClient.auth.mfa.enroll({ factorType: "totp" });
check("totp enroll", !ee && !!enr?.totp?.secret, ee?.message ?? "");
const secret = enr.totp.secret;
const ch = await userClient.auth.mfa.challenge({ factorId: enr.id });
const vr = await userClient.auth.mfa.verify({ factorId: enr.id, challengeId: ch.data.id, code: totp(secret) });
check("totp verify", !vr.error, vr.error?.message ?? "");
const { data: sess2 } = await userClient.auth.getSession();
const ck2 = CK(sess2.session);
const H2 = { "Content-Type": "application/json", Cookie: ck2 };
r = await fetch(`${B}/admin`, { headers: { Cookie: ck2 }, redirect: "manual" });
check("aal2 /admin → 200", r.status === 200, `${r.status}`);

// 3. broker-report uphold suspends broker
const { data: { users } } = await admin.auth.admin.listUsers();
const adminId = users.find((u) => u.email === email).id;
await admin.from("brokers").insert({ id: "BADM" + stamp, name: "Bad Actor", agency: "Bad Agency", verified: "verified", cities: ["Delhi"], areas: ["Dwarka"], policy: "x" });
await admin.from("reports").insert({ id: "RPB" + stamp, target_type: "broker", broker_id: "BADM" + stamp, listing_id: null, reason: "Other", details: "Admin slice probe against broker conduct with sufficient detail.", reporter: "probe", status: "Open", date: "6 Oct 2026", owner_id: adminId });
r = await fetch(`${B}/api/reports/RPB${stamp}`, { method: "PATCH", headers: H2, body: JSON.stringify({ uphold: true, reason: "Confirmed misconduct" }) });
check("broker uphold 200", r.status === 200, `${r.status}`);
const bstat = await admin.from("brokers").select("verified").eq("id", "BADM" + stamp).single();
check("broker suspended", bstat.data?.verified === "suspended", bstat.data?.verified);
// investigate + note on another report
await admin.from("reports").insert({ id: "RPI" + stamp, target_type: "listing", listing_id: "L001", reason: "Other", details: "Investigation probe with sufficient detail text.", reporter: "probe", status: "Open", date: "6 Oct 2026", owner_id: adminId });
r = await fetch(`${B}/api/reports/RPI${stamp}`, { method: "PATCH", headers: H2, body: JSON.stringify({ status: "Investigating" }) });
check("mark investigating 200", r.status === 200, `${r.status}`);
r = await fetch(`${B}/api/reports/RPI${stamp}/notes`, { method: "POST", headers: H2, body: JSON.stringify({ body: "Requested fresh photos from broker." }) });
check("investigator note 201", r.status === 201, `${r.status}`);

// 4. KYC approve blocked when incomplete (no application row/docs)
await admin.from("brokers").insert({ id: "BKYC" + stamp, name: "Kyc Probe", agency: "Kyc Agency", verified: "pending", cities: ["Delhi"], areas: ["Dwarka"], policy: "x" });
r = await fetch(`${B}/api/brokers/BKYC${stamp}`, { method: "PATCH", headers: H2, body: JSON.stringify({ action: "approve" }) });
check("approve incomplete → 409 with missing list", r.status === 409, `${r.status} ${(await r.text()).slice(0, 100)}`);

// 5. KPIs + decisions render
r = await fetch(`${B}/admin`, { headers: { Cookie: ck2 } });
const html = await r.text();
check("KPIs render", html.includes("Freshness") && html.includes("Response"), `${r.status}`);
check("decisions render", html.includes("Recent decisions"), `${r.status}`);

// 6. retention cron guarded + health
r = await fetch(`${B}/api/cron/retention`, { method: "POST" });
check("retention w/o secret → 401", r.status === 401, `${r.status}`);
r = await fetch(`${B}/api/health`);
check("health 200", r.status === 200, `${r.status}`);

console.log(`TOTAL pass=${pass} fail=${fail}`);
// cleanup
await admin.from("report_notes").delete().eq("report_id", "RPI" + stamp);
await admin.from("reports").delete().in("id", ["RPB" + stamp, "RPI" + stamp]);
await admin.from("brokers").delete().in("id", ["BADM" + stamp, "BKYC" + stamp]);
await admin.auth.admin.deleteUser(adminId);
console.log("cleaned");
