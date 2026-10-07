// Run: node --env-file=.env scripts/policies-e2e.mjs
// Uses disposable accounts and fictitious documents. Cleans its own records only.
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const base = process.env.TEST_BASE_URL || "http://localhost:3001";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const version = readFileSync(new URL("../src/lib/policies.ts", import.meta.url), "utf8").match(/POLICY_VERSION = "([^"]+)"/)[1];
const users = [], cases = [], proofs = [];
const runId = randomUUID();
let brokerId, passed = 0;
function check(name, value) { assert.ok(value, name); passed++; console.log(`PASS ${name}`); }
function required(result, label) { if (result.error) throw new Error(`${label}: ${result.error.code || "provider error"}`); return result.data; }
async function account(role) {
  const email = `policy-check-${randomUUID()}@example.com`, password = `${randomUUID()}Aa!`;
  const { user } = required(await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } }), "create test account");
  users.push(user.id);
  const jar = new Map();
  const client = createServerClient(url, key, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: items => items.forEach(({ name, value }) => jar.set(name, value)),
  } });
  required(await client.auth.signInWithPassword({ email, password }), "test sign-in");
  return { user, client, cookie: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()].map(c => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const bytes = Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", bytes).update(counter).digest(), offset = hash.at(-1) & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
async function call(path, who, method = "GET", payload) {
  return fetch(`${base}${path}`, { method, redirect: "manual", headers: {
    "Content-Type": "application/json", ...(who ? { Cookie: who.cookie() } : {}),
    "x-forwarded-for": `policy-check-${runId}-${who?.user.id || "guest"}`,
  }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
}
async function newCase(who, extra = {}) {
  const response = await call("/api/privacy-requests", who, "POST", { kind: "Access", email: "policy-guest@example.com", details: "Fictitious request to exercise privacy access controls.", ...extra });
  assert.equal(response.status, 201, "privacy request creation");
  const data = (await response.json()).request;
  cases.push(data.id);
  return data.id;
}
const patch = (id, who, status, expectedStatus) => call(`/api/privacy-requests/${id}`, who, "PATCH", { status, expectedStatus, response: "Fictitious test response. No real account action requested." });
try {
  const seeker = await account("seeker"), other = await account("seeker"), staff = await account("admin");
  for (const path of ["/terms", "/privacy", "/broker-agreement", "/support/privacy"]) {
    const page = await call(path);
    check(`${path} renders`, page.status === 200 && (await page.text()).includes("Privacy"));
  }
  check("anonymous private requests blocked", (await call("/api/privacy-requests")).status === 401);
  check("invalid request rejected", (await call("/api/privacy-requests", null, "POST", { kind: "invalid", email: "bad", details: "short" })).status === 400);
  const guest = await newCase(null), mine = await newCase(seeker, { email: "spoof@example.com", owner_id: other.user.id }), theirs = await newCase(other);
  const stored = required(await db.from("privacy_requests").select("owner_id,contact_email").eq("id", mine).single(), "request lookup");
  check("owner and contact derived from session", stored.owner_id === seeker.user.id && stored.contact_email === seeker.user.email);
  check("guest ownership stays null", required(await db.from("privacy_requests").select("owner_id").eq("id", guest).single(), "guest lookup").owner_id === null);
  const owned = (await (await call("/api/privacy-requests", seeker)).json()).requests;
  check("requester sees own case only", owned.some(r => r.id === mine) && !owned.some(r => r.id === theirs || r.id === guest));
  check("private table RLS blocks direct reads", required(await seeker.client.from("privacy_requests").select("id"), "RLS read").length === 0);
  check("ordinary user cannot review", (await patch(mine, seeker, "Reviewing", "Open")).status === 403);
  check("password-only admin cannot review", (await patch(mine, staff, "Reviewing", "Open")).status === 403);
  for (const path of ["/admin/policy", "/admin/privacy-requests"]) {
    const denied = await call(path, staff);
    check(`${path} requires MFA`, denied.status === 307 && denied.headers.get("location").includes("/admin/mfa"));
    check(`${path} excludes tenants`, (await call(path, seeker)).status === 307);
  }
  const factor = required(await staff.client.auth.mfa.enroll({ factorType: "totp" }), "TOTP enrol");
  const challenge = required(await staff.client.auth.mfa.challenge({ factorId: factor.id }), "TOTP challenge");
  required(await staff.client.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: totp(factor.totp.secret) }), "TOTP verification");
  for (const path of ["/admin/policy", "/admin/privacy-requests"]) check(`${path} opens after MFA`, (await call(path, staff)).status === 200);
  check("cannot close without review", (await patch(mine, staff, "Closed", "Open")).status === 409);
  const race = await Promise.all([patch(mine, staff, "Reviewing", "Open"), patch(mine, staff, "Reviewing", "Open")]);
  check("concurrent review serialized", race.map(r => r.status).sort().join(",") === "200,409");
  check("single review audit recorded", required(await db.from("admin_actions").select("actor_id,actor_email").eq("target_id", mine), "review audit").length === 1);
  check("reviewed request closes", (await patch(mine, staff, "Closed", "Reviewing")).status === 200);
  check("closed request cannot reopen", (await patch(mine, staff, "Reviewing", "Open")).status === 409);
  const closed = (await (await call("/api/privacy-requests", seeker)).json()).requests.find(r => r.id === mine);
  check("owner sees outcome", closed.status === "Closed" && closed.response.includes("Fictitious test response"));
  check("closed queue renders case", (await (await call("/admin/privacy-requests?status=Closed", staff)).text()).includes(mine));
  check("case closure leaves underlying account intact", !!required(await db.auth.admin.getUserById(seeker.user.id), "account after closure").user);
  const rollback = await db.rpc("review_privacy_request", { target: theirs, next_status: "Reviewing", expected_status: "Open", reply: "Atomicity test response with a missing actor.", actor: randomUUID(), actor_email: "test@example.com" });
  check("audit failure rolls back case update", !!rollback.error && required(await db.from("privacy_requests").select("status").eq("id", theirs).single(), "rollback lookup").status === "Open");
  check("clients cannot invoke review RPC", !!(await seeker.client.rpc("review_privacy_request", { target: theirs, next_status: "Reviewing", expected_status: "Open", reply: "Unauthorised response blocked before any action.", actor: seeker.user.id, actor_email: seeker.user.email })).error);

  const application = { name: "Policy Test", agency: "Fictitious Agency", phone: "9000000001", city: "Delhi", areas: ["Dwarka"], policy: "Every fee is disclosed before a visit.", businessAddress: "Fictitious test address in Dwarka", exp: 3, cats: ["Family"], identityPath: `${seeker.user.id}/not-uploaded.pdf`, businessPath: `${seeker.user.id}/not-uploaded.pdf` };
  for (const extra of [{}, { acceptBrokerTerms: "true", consentVerification: true, policyVersion: version, privacyVersion: version }, { acceptBrokerTerms: true, consentVerification: true, policyVersion: "old", privacyVersion: version }, { acceptBrokerTerms: true, consentVerification: false, policyVersion: version, privacyVersion: version }]) {
    check("missing, stale or non-boolean consent rejected", (await call("/api/brokers", seeker, "POST", { ...application, ...extra })).status === 400);
  }
  check("rejected consent creates no broker application", required(await db.from("broker_applications").select("broker_id").eq("owner_id", seeker.user.id), "application lookup").length === 0);
  for (const name of ["identity", "business"]) {
    const form = new FormData(); form.set("kind", "proof"); form.set("file", new Blob(["%PDF-1.4\nFICTITIOUS TEST DOCUMENT — NO ID DATA\n%%EOF"], { type: "application/pdf" }), `${name}.pdf`);
    const response = await fetch(`${base}/api/uploads`, { method: "POST", headers: { Cookie: seeker.cookie() }, body: form });
    assert.equal(response.status, 201, "private proof upload");
    const path = (await response.json()).path; proofs.push(path); application[`${name}Path`] = path;
  }
  const before = Date.now();
  const submitted = await call("/api/brokers", seeker, "POST", { ...application, acceptBrokerTerms: true, consentVerification: true, policyVersion: version, privacyVersion: version, agreement_accepted_at: "2000-01-01", verification_consented_at: "2000-01-01" });
  assert.equal(submitted.status, 201, "broker application submission"); brokerId = (await submitted.json()).broker.id;
  const accepted = required(await db.from("broker_applications").select("agreement_version,agreement_accepted_at,privacy_version,verification_consented_at").eq("owner_id", seeker.user.id).single(), "stored consent");
  check("current agreement and privacy versions saved", accepted.agreement_version === version && accepted.privacy_version === version);
  check("acceptance times stamped by server", Date.parse(accepted.agreement_accepted_at) >= before - 2000 && Date.parse(accepted.verification_consented_at) >= before - 2000);
  const queueResponse = await call(`/admin?queue=brokers&q=${encodeURIComponent(brokerId)}`, staff);
  const consentQueue = await queueResponse.text();
  check("admin queue shows recorded acceptance", queueResponse.status === 200 && consentQueue.includes("Agreement accepted") && consentQueue.includes(version));
  check("private proofs are not publicly accessible", !(await fetch(`${url}/storage/v1/object/public/broker-proofs/${proofs[0]}`)).ok);
  check("broker profile fields survive application", required(await db.from("brokers").select("business_address,exp").eq("id", brokerId).single(), "broker profile").exp === 3);
  console.log(`${passed} policy and privacy checks passed.`);
} finally {
  if (cases.length) {
    required(await db.from("admin_actions").delete().in("target_id", cases).eq("target_type", "privacy_request"), "test audit cleanup");
    required(await db.from("privacy_requests").delete().in("id", cases), "test request cleanup");
  }
  if (proofs.length) required(await db.storage.from("broker-proofs").remove(proofs), "test proof cleanup");
  if (users.length) {
    // Lookup also covers a failure after the API committed but before returning an id.
    const apps = required(await db.from("broker_applications").select("broker_id").in("owner_id", users), "test application cleanup lookup");
    required(await db.from("broker_applications").delete().in("owner_id", users), "test application cleanup");
    const ids = [...new Set([brokerId, ...apps.map(a => a.broker_id)].filter(Boolean))];
    if (ids.length) required(await db.from("brokers").delete().in("id", ids), "test broker cleanup");
    for (const id of users) required(await db.auth.admin.deleteUser(id), "test account cleanup");
  }
  console.log("Disposable accounts, requests, proofs and decisions removed.");
}
