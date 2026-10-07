"use client";
import { useState } from "react";
import Link from "next/link";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { request } from "@/lib/client-request";
export default function NewListingPage() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [id, setId] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
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
      const b: Record<string, unknown> = Object.fromEntries(f);
      delete b.files;
      for (const k of [
        "bhk",
        "rent",
        "deposit",
        "brokDays",
        "visitFee",
        "otherFee",
        "area",
      ])
        b[k] = Number(f.get(k));
      b.photos = photos;
      b.photoHashes = photoHashes;
      b.visitFeeRefundable = f.get("visitFeeRefundable") === "on";
      const data = await request("/api/listings", b);
      setId(data.listing.id);
      setMessage(
        `Listing submitted for review. Property ID: ${data.listing.propId}.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/broker/dashboard" className="text-sm underline">
        ← Broker dashboard
      </Link>
      <h1 className="display text-4xl font-black mt-4">
        List a home, with every fee.
      </h1>
      <p className="text-ink/65 mt-2">
        Starts as pending. The address gives this property a consistent ID; our
        team reviews the details before publication.
      </p>
      {id ? (
        <div
          role="status"
          className="mt-6 bg-mist rounded-3xl border border-pine/25 p-8"
        >
          <b>{message}</b>
          <Link href={`/properties/${id}`} className="button block mt-4">
            Preview listing
          </Link>
          <button
            className="button secondary w-full mt-3"
            onClick={() => {
              setId("");
              setMessage("");
            }}
          >
            Add another home
          </button>
        </div>
      ) : (
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
              placeholder="Bright 2 BHK near Dwarka Metro"
            />
          </label>
          <label>
            City
            <select name="city">
              {PHASE1_CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Locality
            <input name="locality" required minLength={2} maxLength={100} />
          </label>
          <label className="sm:col-span-2">
            Full property address
            <input
              name="address"
              required
              minLength={8}
              maxLength={300}
              placeholder="Flat, floor, building and street"
            />
            <span className="block text-xs mt-1 text-ink/60">
              Used for property matching. The address is not displayed publicly.
            </span>
          </label>
          <label>
            Sector / neighbourhood
            <input name="sector" maxLength={100} />
          </label>
          <label>
            Property type
            <select name="type">
              {[
                "Apartment",
                "Builder Floor",
                "Independent House",
                "Studio",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Bedrooms (BHK)
            <input
              name="bhk"
              type="number"
              min={1}
              max={10}
              required
              defaultValue={2}
            />
          </label>
          <label>
            Area (sq.ft)
            <input name="area" type="number" min={1} max={100000} required />
          </label>
          <label>
            Floor
            <input name="floor" maxLength={100} placeholder="3 of 6" />
          </label>
          <label>
            Furnishing
            <select name="furnishing">
              {["Unfurnished", "Semi-Furnished", "Fully Furnished"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Available from
            <input
              name="avail"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label>
            Amenities, comma separated
            <input
              name="amenities"
              maxLength={500}
              placeholder="Parking, Lift"
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
                defaultValue={
                  k === "brokDays" ? 15 : k === "rent" ? undefined : 0
                }
              />
            </label>
          ))}
          <label className="flex items-start gap-2">
            <input
              name="visitFeeRefundable"
              type="checkbox"
              className="mt-1"
            />
            <span>Visit fee is refundable</span>
          </label>
          <label>
            Other fee explanation
            <input
              name="otherFeeNote"
              maxLength={500}
              placeholder="Required when other fees are non-zero"
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
            />
          </label>
          <label className="sm:col-span-2">
            Owner name (as per ownership proof)
            <input
              name="ownerName"
              required
              minLength={2}
              maxLength={100}
              placeholder="Full name of owner/landlord"
            />
          </label>
          <label>
            Your relationship to this property
            <select name="ownerRelationship" defaultValue="agent">
              <option value="owner">I own this unit</option>
              <option value="agent">I am the owner&apos;s agent</option>
              <option value="subagent">I am a sub-agent</option>
            </select>
          </label>
          <label className="sm:col-span-2 flex items-start gap-2">
            <input name="authorized" type="checkbox" required className="mt-1" />
            <span>
              I confirm I am authorized by the owner/landlord to market this
              property
            </span>
          </label>
          <label className="sm:col-span-2">
            Upload photos (up to 8)
            <input
              name="files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <label className="sm:col-span-2">
            Or HTTPS photo URLs, one per line
            <textarea name="photos" rows={3} placeholder="https://…" />
          </label>
          <p className="sm:col-span-2 text-xs text-ink/65">
            At least one photo is required. Each upload must be at most 5 MB.
            Publish photos you have permission to use.
          </p>
          <button className="button sm:col-span-2" disabled={busy}>
            {busy ? "Uploading & saving…" : "Submit listing for review"}
          </button>
          {message && (
            <p role="alert" className="sm:col-span-2 text-sm text-red-700">
              {message}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
