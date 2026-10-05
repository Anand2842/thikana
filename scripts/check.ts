import assert from "node:assert/strict";
import { safeNext } from "../src/lib/navigation";
import {
  validateLead,
  validateBroker,
  validateListing,
  validateCityRequest,
} from "../src/lib/validation";
import { isActive, moveInTotal } from "../src/lib/trust";
import { listings } from "../src/lib/mock-data";
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
};
assert.deepEqual(validateListing(valid), []);
assert.ok(validateListing({ ...valid, bhk: 1.5 }).length);
assert.ok(validateListing({ ...valid, avail: "2026-02-31" }).length);
assert.ok(validateListing({ ...valid, amenities: "a".repeat(1001) }).length);
assert.ok(
  validateListing({ ...valid, photos: ["javascript:alert(1)"] }).length,
);
assert.ok(validateListing({ ...valid, photos: [] }).length);
console.log("Validation, redirect safety, fee and availability checks passed.");
