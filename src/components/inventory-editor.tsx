"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { draftReadiness } from "@/lib/inventory";

interface Draft {
  id: string;
  buildingId: string | null;
  fields: Record<string, unknown>;
  confirmations: Record<string, unknown>;
  revision: number;
  submittedListingId: string | null;
}
interface Building {
  id: string;
  label: string;
  city: string;
  locality: string;
  revision: number;
}

type SaveState = "saved" | "saving" | "unsaved";

function str(v: unknown): string {
  return typeof v === "string" ? v : (v ?? "").toString();
}

export default function InventoryEditor({
  drafts,
  buildings,
  activeDraft,
}: {
  drafts: (Draft & { updatedAt?: string })[];
  buildings: Building[];
  activeDraft: Draft | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function quickAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const f = new FormData(e.currentTarget);
      const num = (k: string) => {
        const n = Number(f.get(k));
        return Number.isFinite(n) && f.get(k) !== "" ? n : undefined;
      };
      const payload: Record<string, unknown> = {
        unit: str(f.get("unit")),
        bhk: num("bhk"),
        rent: num("rent"),
        area: num("area"),
        furnishing: str(f.get("furnishing")) || undefined,
        avail: str(f.get("avail")) || undefined,
      };
      for (const [k, v] of Object.entries(payload))
        if (v === undefined) delete payload[k];
      const bId = str(f.get("buildingId"));
      const data = await request("/api/broker/drafts", {
        ...payload,
        ...(bId ? { buildingId: bId } : {}),
      });
      router.push(`/broker/inventory?draft=${data.draft.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(id: string, rev: number) {
    setBusy(true);
    setMessage("");
    try {
      const data = await request(
        `/api/broker/drafts/${id}`,
        { expectedRevision: rev, duplicate: true },
        "PATCH",
      );
      router.push(`/broker/inventory?draft=${data.draft.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px]";

  return (
    <div className="mt-8 grid lg:grid-cols-[320px_1fr] gap-6 items-start">
      <div>
        <h2 className="font-extrabold">Drafts ({drafts.length})</h2>
        <form
          onSubmit={quickAdd}
          className="mt-3 bg-cream border border-line rounded-3xl p-4 space-y-2"
        >
          <b className="text-sm">Quick add</b>
          <select
            name="buildingId"
            defaultValue=""
            className={input}
            aria-label="Building (optional)"
          >
            <option value="">No building</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label || b.locality || b.id} · {b.city}
              </option>
            ))}
          </select>
          <input
            name="unit"
            maxLength={100}
            placeholder="Flat / unit ref, e.g. A-1203"
            className={input}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              name="bhk"
              defaultValue=""
              className={input}
              aria-label="BHK"
            >
              <option value="">BHK</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} BHK
                </option>
              ))}
            </select>
            <input
              name="rent"
              type="number"
              min={1}
              placeholder="Rent ₹/mo"
              className={input}
            />
            <input
              name="area"
              type="number"
              min={1}
              placeholder="Area sq.ft"
              className={input}
            />
            <select
              name="furnishing"
              defaultValue=""
              className={input}
              aria-label="Furnishing"
            >
              <option value="">Furnishing</option>
              <option>Unfurnished</option>
              <option>Semi-Furnished</option>
              <option>Fully Furnished</option>
            </select>
          </div>
          <input
            name="avail"
            type="date"
            className={input}
            aria-label="Available from"
          />
          <button className="button w-full" disabled={busy}>
            Save partial draft
          </button>
        </form>
        {message && (
          <p role="status" className="text-sm mt-2">
            {message}
          </p>
        )}
        <div className="mt-3 space-y-2">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-paper border border-line rounded-2xl p-3 text-[13px] flex items-center gap-2"
            >
              <Link
                href={`/broker/inventory?draft=${d.id}`}
                className="font-bold underline flex-1"
              >
                {str(d.fields.title) ||
                  str(d.fields.unit) ||
                  str(d.fields.locality) ||
                  d.id.slice(0, 8)}
              </Link>
              <span className="text-ink/55">r{d.revision}</span>
              <button
                className="underline text-[12px]"
                disabled={busy}
                onClick={() => void duplicate(d.id, d.revision)}
              >
                Similar
              </button>
            </div>
          ))}
          {!drafts.length && (
            <p className="text-sm text-ink/60">No drafts yet.</p>
          )}
        </div>
      </div>

      <div>
        {!activeDraft ? (
          <p className="text-ink/60">
            Select a draft to edit, or quick-add above.
          </p>
        ) : (
          <DraftEditor key={activeDraft.id} draft={activeDraft} />
        )}
      </div>
    </div>
  );
}

// Editor panel scoped to ONE draft: keyed by draft id at the call site, so
// selecting another draft remounts with that draft's fields, revision and
// confirmations. State here can never leak into a different draft.
function DraftEditor({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [fields, setFields] = useState<Record<string, unknown>>(draft.fields);
  const [confirmations, setConfirmations] = useState<Record<string, unknown>>(
    draft.confirmations,
  );
  const [revision, setRevision] = useState(draft.revision);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // Serialized saves: blur flushes immediately; overlapping saves chain
  // instead of racing, and the indicator only says Saved when no newer
  // snapshot is pending or in flight.
  const stateRef = useRef({ fields, confirmations, revision });
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function persistOnce(): Promise<number | null> {
    const snap = stateRef.current;
    setSaveState("saving");
    try {
      const data = await request(
        `/api/broker/drafts/${draft.id}`,
        {
          expectedRevision: snap.revision,
          fields: snap.fields,
          confirmations: snap.confirmations,
        },
        "PATCH",
      );
      return data.draft.revision as number;
    } catch (e) {
      setMessage((e as Error).message);
      return null;
    }
  }

  async function runSaveQueue(): Promise<number | null> {
    if (savingRef.current) {
      pendingRef.current = true;
      return null;
    }
    savingRef.current = true;
    let latest: number | null = null;
    try {
      for (;;) {
        pendingRef.current = false;
        const rev = await persistOnce();
        if (rev === null) {
          setSaveState("unsaved");
          return latest;
        }
        latest = rev;
        setRevision(rev);
        stateRef.current = { ...stateRef.current, revision: rev };
        if (!pendingRef.current) {
          setSaveState("saved");
          setMessage("");
          return latest;
        }
      }
    } finally {
      savingRef.current = false;
    }
  }

  function schedulePersist() {
    setSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSaveQueue();
    }, 900);
  }

  function flushPersist(): Promise<number | null> {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return runSaveQueue();
  }

  function setField(k: string, v: unknown) {
    setFields((prev) => {
      const next = { ...prev, [k]: v };
      return next;
    });
    // Schedule against the merged snapshot, not the stale closure.
    const next = { ...stateRef.current.fields, [k]: v };
    stateRef.current = { ...stateRef.current, fields: next };
    schedulePersist();
  }
  function setConf(k: string, v: boolean) {
    const next = { ...stateRef.current.confirmations, [k]: v };
    stateRef.current = { ...stateRef.current, confirmations: next };
    setConfirmations(next);
    schedulePersist();
  }

  function generateCopy() {
    // Editable suggestion built ONLY from confirmed facts — never invents
    // metro proximity, luxury finishes, or owner verification.
    const f = stateRef.current.fields;
    const parts = [
      f.bhk ? `${f.bhk} BHK` : "",
      typeof f.type === "string" && f.type ? f.type : "home",
      f.locality ? `in ${f.locality}` : "",
      f.city ? `, ${f.city}` : "",
    ].join(" ");
    const desc = [
      f.bhk ? `${f.bhk} BHK` : "Home",
      f.area ? `with ${f.area} sq.ft` : "",
      f.furnishing ? `, ${String(f.furnishing).toLowerCase()}` : "",
      f.avail ? `. Available from ${f.avail}` : ".",
      f.amenities ? ` Amenities: ${f.amenities}.` : "",
    ].join("");
    const next = {
      ...f,
      title: `${parts} for rent`.replace(/\s+/g, " ").trim(),
      desc: desc.replace(/\s+/g, " ").trim(),
    };
    stateRef.current = { ...stateRef.current, fields: next };
    setFields(next);
    schedulePersist();
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    try {
      const cur = stateRef.current.fields;
      const urls = Array.isArray(cur.photos) ? [...(cur.photos as string[])] : [];
      const hashes = Array.isArray(
        (cur as Record<string, unknown>).photoHashes,
      )
        ? [...((cur as Record<string, unknown>).photoHashes as string[])]
        : [];
      for (const file of Array.from(files).slice(0, 8 - urls.length)) {
        const upload = new FormData();
        upload.set("file", file);
        upload.set("kind", "photo");
        const done = await request("/api/uploads", upload);
        urls.push(done.url);
        if (typeof done.sha256 === "string") hashes.push(done.sha256);
      }
      const next = { ...cur, photos: urls, photoHashes: hashes };
      stateRef.current = { ...stateRef.current, fields: next };
      setFields(next);
      schedulePersist();
    } catch (e) {
      setMessage((e as Error).message);
      setSaveState("unsaved");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      // Flush pending edits first so submission validates what the broker sees.
      const rev = await flushPersist();
      if (rev === null) return;
      const data = await request(
        `/api/broker/drafts/${draft.id}/submit`,
        { expectedRevision: rev },
        "POST",
      );
      setMessage(`Submitted for review. Property ID: ${data.listing.propId}.`);
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const readiness = draftReadiness(fields, confirmations);
  const input =
    "w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px]";

  return (
    <div className="bg-cream border border-line rounded-3xl p-5 sm:p-7 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <b>Editor</b>
        <span
          className="text-[12px] font-bold px-2.5 py-1 rounded-full border border-line"
          role="status"
        >
          {saveState === "saved"
            ? "Saved"
            : saveState === "saving"
              ? "Saving…"
              : "Not saved"}
        </span>
        <span className="text-[12px] text-ink/55">revision {revision}</span>
        {draft.submittedListingId && (
          <span className="text-[12px] font-bold text-pine">
            submitted ✓
          </span>
        )}
      </div>

      <section>
        <h3 className="font-extrabold mb-2">Home details</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2">
            Title
            <input
              className={input}
              value={str(fields.title)}
              onChange={(e) => setField("title", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            City
            <select
              className={input}
              value={str(fields.city)}
              onChange={(e) => setField("city", e.target.value)}
              onBlur={() => void flushPersist()}
            >
              <option value="">—</option>
              {PHASE1_CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Locality
            <input
              className={input}
              value={str(fields.locality)}
              onChange={(e) => setField("locality", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label className="sm:col-span-2">
            Full address
            <input
              className={input}
              value={str(fields.address)}
              onChange={(e) => setField("address", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Property type
            <select
              className={input}
              value={str(fields.type)}
              onChange={(e) => setField("type", e.target.value)}
              onBlur={() => void flushPersist()}
            >
              <option value="">—</option>
              <option>Apartment</option>
              <option>Builder Floor</option>
              <option>Independent House</option>
              <option>Studio</option>
            </select>
          </label>
          <label>
            Rent ₹/mo
            <input
              className={input}
              type="number"
              min={1}
              value={str(fields.rent)}
              onChange={(e) => setField("rent", Number(e.target.value))}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Deposit ₹
            <input
              className={input}
              type="number"
              min={0}
              value={str(fields.deposit)}
              onChange={(e) => setField("deposit", Number(e.target.value))}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Area sq.ft
            <input
              className={input}
              type="number"
              min={1}
              value={str(fields.area)}
              onChange={(e) => setField("area", Number(e.target.value))}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Floor
            <input
              className={input}
              value={str(fields.floor)}
              onChange={(e) => setField("floor", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Available from
            <input
              className={input}
              type="date"
              value={str(fields.avail)}
              onChange={(e) => setField("avail", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label className="sm:col-span-2">
            Amenities (comma separated)
            <input
              className={input}
              value={str(fields.amenities)}
              onChange={(e) => setField("amenities", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label className="sm:col-span-2">
            Description
            <textarea
              className={input}
              rows={4}
              value={str(fields.desc)}
              onChange={(e) => setField("desc", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <button
            type="button"
            className="button secondary sm:col-span-2"
            onClick={generateCopy}
          >
            Generate title & description from facts
          </button>
        </div>
      </section>

      <section>
        <h3 className="font-extrabold mb-2">Photos</h3>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void uploadPhotos(e.target.files)}
          aria-label="Upload photos"
        />
        <p className="text-xs text-ink/60 mt-1">
          {(Array.isArray(fields.photos) ? fields.photos.length : 0)} photo(s)
          attached. Uploads are validated server-side.
        </p>
      </section>

      <section>
        <h3 className="font-extrabold mb-2">Finish missing details</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            Brokerage (days of rent)
            <input
              className={input}
              type="number"
              min={0}
              max={60}
              value={str(fields.brokDays)}
              onChange={(e) => setField("brokDays", Number(e.target.value))}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Visit fee ₹
            <input
              className={input}
              type="number"
              min={0}
              value={str(fields.visitFee)}
              onChange={(e) => setField("visitFee", Number(e.target.value))}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={fields.visitFeeRefundable === true}
              onChange={(e) => setField("visitFeeRefundable", e.target.checked)}
            />
            <span className="text-sm">Visit fee is refundable</span>
          </label>
          <label>
            Other fees ₹
            <input
              className={input}
              type="number"
              min={0}
              value={str(fields.otherFee)}
              onChange={(e) => setField("otherFee", Number(e.target.value))}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label className="sm:col-span-2">
            Other fee explanation
            <input
              className={input}
              value={str(fields.otherFeeNote)}
              onChange={(e) => setField("otherFeeNote", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Owner name
            <input
              className={input}
              value={str(fields.ownerName)}
              onChange={(e) => setField("ownerName", e.target.value)}
              onBlur={() => void flushPersist()}
            />
          </label>
          <label>
            Relationship to property
            <select
              className={input}
              value={str(fields.ownerRelationship) || "agent"}
              onChange={(e) => setField("ownerRelationship", e.target.value)}
              onBlur={() => void flushPersist()}
            >
              <option value="owner">I own this unit</option>
              <option value="agent">I am the owner&apos;s agent</option>
              <option value="subagent">I am a sub-agent</option>
            </select>
          </label>
          <label className="sm:col-span-2 flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmations.fees === true}
              onChange={(e) => setConf("fees", e.target.checked)}
            />
            <span className="text-sm">
              Fees confirmed — brokerage, visit and other charges are complete
              and correct.
            </span>
          </label>
          <label className="sm:col-span-2 flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmations.authority === true}
              onChange={(e) => setConf("authority", e.target.checked)}
            />
            <span className="text-sm">
              Owner permission confirmed — I am authorized to market this
              property.
            </span>
          </label>
        </div>
        {!readiness.ready && (
          <p className="text-sm text-ink/65 mt-3">
            Still missing: {readiness.missing.join(", ")}.
          </p>
        )}
        <button
          className="button mt-4"
          disabled={busy}
          onClick={() => void submit()}
        >
          Submit for review
        </button>
        {message && (
          <p role="status" className="text-sm mt-2">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
