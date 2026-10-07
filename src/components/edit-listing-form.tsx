"use client";
import { useState } from "react";
import Link from "next/link";
import { request } from "@/lib/client-request";
import type { Listing } from "@/lib/mock-data";

export default function EditListingForm({ listing }: { listing: Listing }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [rereview, setRereview] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setRereview(false);
    const f = new FormData(e.currentTarget);
    try {
      const patch: Record<string, unknown> = {};
      const str = (k: string, cur: string) => {
        const v = String(f.get(k) ?? "");
        if (v !== cur) patch[k] = v;
      };
      const num = (k: string, cur: number) => {
        const raw = String(f.get(k) ?? "");
        if (raw !== "" && Number(raw) !== cur) patch[k] = Number(raw);
      };
      str("title", listing.title);
      num("rent", listing.rent);
      num("deposit", listing.deposit);
      num("brokDays", listing.brokDays);
      num("visitFee", listing.visitFee);
      const refundable = f.get("visitFeeRefundable") === "on";
      if (refundable !== !!listing.visitFeeRefundable)
        patch.visitFeeRefundable = refundable;
      num("otherFee", listing.otherFee);
      str("otherFeeNote", listing.otherFeeNote ?? "");
      str("locality", listing.locality);
      str("sector", listing.sector ?? "");
      num("area", listing.area);
      str("floor", listing.floor ?? "");
      if (String(f.get("furnishing")) !== listing.furnishing)
        patch.furnishing = String(f.get("furnishing"));
      str("avail", listing.avail);
      str("desc", listing.desc);
      const amenities = String(f.get("amenities") ?? "");
      if (amenities !== (listing.amenities ?? []).join(", "))
        patch.amenities = amenities;
      str("ownerName", listing.ownerName ?? "");
      if (String(f.get("ownerRelationship")) !== (listing.ownerRelationship ?? "agent"))
        patch.ownerRelationship = String(f.get("ownerRelationship"));
      if (String(f.get("availabilityStatus")) !== (listing.availabilityStatus ?? "Available"))
        patch.availabilityStatus = String(f.get("availabilityStatus"));

      const photos = String(f.get("photos"))
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const photoHashes: string[] = [];
      for (const file of f.getAll("files")) {
        if (file instanceof File && file.size) {
          const upload = new FormData();
          upload.set("file", file);
          upload.set("kind", "photo");
          const done = await request("/api/uploads", upload);
          photos.push(done.url);
          if (typeof done.sha256 === "string") photoHashes.push(done.sha256);
        }
      }
      if (JSON.stringify(photos) !== JSON.stringify(listing.photos)) {
        patch.photos = photos;
        if (photoHashes.length) patch.photoHashes = photoHashes;
      }
      if (!Object.keys(patch).length) {
        setMessage("No changes to save.");
        return;
      }
      const data = await request(`/api/listings/${listing.id}`, patch, "PATCH");
      const v = data.listing?.verification;
      setRereview(v === "pending");
      setMessage(
        v === "pending"
          ? "Saved. Price, fee or photo changes sent the listing back for review."
          : "Saved.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 bg-cream border border-line rounded-3xl p-5 sm:p-8 grid sm:grid-cols-2 gap-4"
    >
      <label className="sm:col-span-2">
        Title
        <input
          name="title"
          required
          minLength={4}
          maxLength={160}
          defaultValue={listing.title}
        />
      </label>
      <label>
        Availability status
        <select
          name="availabilityStatus"
          defaultValue={listing.availabilityStatus ?? "Available"}
        >
          {["Available", "Taken", "OnHold"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Available from
        <input name="avail" type="date" required defaultValue={listing.avail} />
      </label>
      <label>
        Locality
        <input
          name="locality"
          required
          minLength={2}
          maxLength={100}
          defaultValue={listing.locality}
        />
      </label>
      <label>
        Sector / neighbourhood
        <input name="sector" maxLength={100} defaultValue={listing.sector} />
      </label>
      <label>
        Area (sq.ft)
        <input
          name="area"
          type="number"
          min={1}
          max={100000}
          required
          defaultValue={listing.area}
        />
      </label>
      <label>
        Floor
        <input name="floor" maxLength={100} defaultValue={listing.floor} />
      </label>
      <label>
        Furnishing
        <select name="furnishing" defaultValue={listing.furnishing}>
          {["Unfurnished", "Semi-Furnished", "Fully Furnished"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Amenities, comma separated
        <input
          name="amenities"
          maxLength={1000}
          defaultValue={(listing.amenities ?? []).join(", ")}
        />
      </label>
      {[
        ["rent", "Monthly rent (₹)", 1],
        ["deposit", "Refundable deposit (₹)", 0],
        ["brokDays", "Brokerage (days of rent)", 0],
        ["visitFee", "Visit fee (₹)", 0],
        ["otherFee", "Other fees (₹)", 0],
      ].map(([k, title, min]) => (
        <label key={k}>
          {title}
          <input
            name={String(k)}
            type="number"
            required
            min={Number(min)}
            max={k === "brokDays" ? 60 : 10000000}
            step={1}
            defaultValue={String(
              listing[k as keyof Listing] as number,
            )}
          />
        </label>
      ))}
      <label className="flex items-start gap-2">
        <input
          name="visitFeeRefundable"
          type="checkbox"
          className="mt-1"
          defaultChecked={!!listing.visitFeeRefundable}
        />
        <span>Visit fee is refundable</span>
      </label>
      <label>
        Other fee explanation
        <input
          name="otherFeeNote"
          maxLength={500}
          defaultValue={listing.otherFeeNote ?? ""}
        />
      </label>
      <label className="sm:col-span-2">
        Description
        <textarea
          name="desc"
          required
          minLength={20}
          maxLength={4000}
          rows={4}
          defaultValue={listing.desc}
        />
      </label>
      <label>
        Owner name (as per ownership proof)
        <input
          name="ownerName"
          required
          minLength={2}
          maxLength={100}
          defaultValue={listing.ownerName ?? ""}
        />
      </label>
      <label>
        Your relationship to the property
        <select
          name="ownerRelationship"
          defaultValue={listing.ownerRelationship ?? "agent"}
        >
          {["owner", "agent", "subagent"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        Add photos (up to 8 total)
        <input
          name="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
        />
      </label>
      <label className="sm:col-span-2">
        Photo URLs, one per line (1–8)
        <textarea
          name="photos"
          rows={3}
          defaultValue={(listing.photos ?? []).join("\n")}
        />
      </label>
      <p className="sm:col-span-2 text-xs text-ink/65">
        Only changed fields are sent. Changing rent, deposit, brokerage, fees
        or photos sends the listing back for review.
      </p>
      <button className="button sm:col-span-2" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
      {message && (
        <p role="alert" className="sm:col-span-2 text-sm text-red-700">
          {message}{" "}
          {rereview ? null : (
            <Link href={`/properties/${listing.id}`} className="underline">
              Preview listing
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
