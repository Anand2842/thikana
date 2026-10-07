import assert from "node:assert/strict";
import { safeNext } from "../src/lib/navigation";
import {
  validateLead,
  validateBroker,
  validateListing,
  validateCityRequest,
  validateMessage,
  validateReport,
} from "../src/lib/validation";
import { isActive, moveInTotal } from "../src/lib/trust";
import { listings } from "../src/lib/mock-data";
import { POLICY_VERSION, validateBrokerAcceptance, validatePrivacyRequest } from "../src/lib/policies";
for (const value of [
  null,
  [],
  1,
  "x",
  { name: 12, phone: 3 },
  { name: "A", phone: "not a phone" },
])
  assert.ok(validateLead(value).length);
for (const value of [null, [], 1, { name: 4, areas: [null] }])
  assert.ok(validateBroker(value).length);
for (const value of [null, [], 1, { city: "Delhi", name: null }])
  assert.ok(validateCityRequest(value).length);
assert.ok(
  validateCityRequest({
    city: " delhi ",
    name: "Demo",
    phone: "9000000001",
    userType: "seeker",
  }).length,
);
assert.deepEqual(
  validateLead({ name: "Demo", phone: "9000000001", listingId: "L1" }),
  [],
);
for (const path of [
  "//evil.test",
  "/\\evil.test",
  "/\nevil.test",
  "https://evil.test",
  null,
])
  assert.equal(safeNext(path), "/dashboard");
assert.equal(safeNext("/properties?q=dwarka"), "/properties?q=dwarka");
const l = listings[0];
assert.equal(isActive({ ...l, hrs: 168 }), false);
assert.equal(isActive({ ...l, verification: "flagged", hrs: 1 }), false);
assert.equal(
  moveInTotal({
    ...l,
    rent: 24000,
    deposit: 48000,
    brokDays: 15,
    visitFee: 200,
    otherFee: 500,
  }),
  84700,
);
const valid = {
  title: "Test home",
  city: "Delhi",
  locality: "Dwarka",
  address: "Flat 101, Test Tower",
  rent: 24000,
  bhk: 2,
  deposit: 48000,
  brokDays: 15,
  visitFee: 0,
  otherFee: 0,
  area: 1000,
  type: "Apartment",
  furnishing: "Unfurnished",
  avail: "2026-10-06",
  desc: "A bright, spacious demo home.",
  photos: ["https://example.com/photo.jpg"],
  ownerName: "Demo Owner",
  authorized: "on",
  ownerRelationship: "agent",
};
assert.deepEqual(validateListing(valid), []);
assert.ok(validateListing({ ...valid, ownerRelationship: "stranger" }).length);
assert.ok(validateListing({ ...valid, ownerName: "X" }).length);
assert.ok(validateListing({ ...valid, authorized: false }).length);
assert.ok(validateListing({ ...valid, bhk: 1.5 }).length);
assert.ok(validateListing({ ...valid, avail: "2026-02-31" }).length);
assert.ok(validateListing({ ...valid, amenities: "a".repeat(1001) }).length);
assert.ok(
  validateListing({ ...valid, photos: ["javascript:alert(1)"] }).length,
);
assert.ok(validateListing({ ...valid, photos: [] }).length);
assert.deepEqual(
  validateListing({ ...valid, visitFee: 100, visitFeeRefundable: true }),
  [],
);
assert.ok(
  validateListing({ ...valid, otherFee: 500, otherFeeNote: "" }).length,
);
assert.deepEqual(
  validateListing({
    ...valid,
    otherFee: 500,
    otherFeeNote: "Society move-in charge",
  }),
  [],
);
assert.ok(validateMessage(null).length);
assert.ok(validateMessage({ body: "" }).length);
assert.deepEqual(validateMessage({ body: "Hello, confirming visit." }), []);
assert.ok(
  validateReport({ targetType: "broker", reason: "Other", details: "ok" })
    .length,
);
assert.deepEqual(
  validateReport({
    targetType: "broker",
    brokerId: "B1",
    reason: "Other",
    details: "Agent demanded cash before the visit.",
  }),
  [],
);
assert.deepEqual(
  validateReport({
    targetType: "listing",
    listingId: "L1",
    reason: "Wrong details",
    details: "Rent on the page differs from the visit quote.",
  }),
  [],
);
const acceptance = { acceptBrokerTerms: true, consentVerification: true, policyVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION };
assert.deepEqual(validateBrokerAcceptance(acceptance), []);
for (const change of [{ acceptBrokerTerms: false }, { acceptBrokerTerms: "true" }, { consentVerification: false }, { policyVersion: "old-version" }, { privacyVersion: "old-version" }])
  assert.ok(validateBrokerAcceptance({ ...acceptance, ...change }).length);
const privacyRequest = { kind: "Deletion", email: "person@example.com", details: "Please close my account and explain any retained records." };
assert.deepEqual(validatePrivacyRequest(privacyRequest), []);
for (const change of [{ kind: "Delete everyone" }, { email: "not-an-email" }, { details: "short" }, { details: "x".repeat(2001) }])
  assert.ok(validatePrivacyRequest({ ...privacyRequest, ...change }).length);
console.log("Validation, redirect safety, fees, availability and policy checks passed.");
