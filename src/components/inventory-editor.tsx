"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
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
  // Assignment tray: this draft's private uploads, loaded on mount so a
  // reloaded editor resumes exactly where the broker left off.
  const [assets, setAssets] = useState<
    { id: string; kind: string; state: string; mime: string; bytes: number }[]
  >([]);
  useEffect(() => {
    void refreshAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);
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
    if (!files?.length || !draft) return;
    setBusy(true);
    setMessage("");
    try {
      // Private asset flow: reserve a server-chosen path, upload straight
      // to storage, then let the server verify bytes before trusting.
      const sb = createBrowserSupabase();
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error(`${file.name}: choose JPEG, PNG or WEBP.`);
        if (file.size > 5 * 1024 * 1024)
          throw new Error(`${file.name}: photo must be under 5 MB.`);
        const slot = await request("/api/broker/drafts/assets", {
          draftId: draft.id,
          kind: "photo",
          mime: file.type,
          bytes: file.size,
        });
        const { error: ue } = await sb.storage
          .from("inventory-media")
          .uploadToSignedUrl(slot.path, slot.token, file);
        if (ue) throw new Error(`${file.name}: upload failed. Try again.`);
        await request(`/api/broker/drafts/assets/${slot.asset.id}/complete`, {}, "POST");
      }
      await refreshAssets();
    } catch (e) {
      setMessage((e as Error).message);
      await refreshAssets();
    } finally {
      setBusy(false);
    }
  }

  async function refreshAssets() {
    if (!draft) return;
    try {
      const res = await fetch(
        `/api/broker/drafts/assets?draftId=${encodeURIComponent(draft.id)}`,
        { method: "GET" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load photos.");
      setAssets(
        (Array.isArray(data.assets) ? data.assets : []) as {
          id: string;
          kind: string;
          state: string;
          mime: string;
          bytes: number;
        }[],
      );
    } catch {
      // Tray is best-effort; drafts and autosave keep working.
    }
  }

  async function removeAsset(assetId: string) {
    setMessage("");
    try {
      await request(`/api/broker/drafts/assets/${assetId}`, {}, "DELETE");
      await refreshAssets();
    } catch (e) {
      setMessage((e as Error).message);
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

  const baseReadiness = draftReadiness(fields, confirmations);
  // Asset-backed photos count toward readiness exactly like pasted URLs:
  // the submit path resolves both. Only the photos gap can be filled this way.
  const readyAssets = assets.filter(
    (a) => a.kind === "photo" && a.state === "ready",
  ).length;
  const urlPhotos = Array.isArray(fields.photos) ? fields.photos.length : 0;
  const photosCovered = urlPhotos + readyAssets >= 1;
  const readiness = {
    ready:
      baseReadiness.ready ||
      (photosCovered &&
        baseReadiness.missing.every((m) => m === "photos")),
    missing: photosCovered
      ? baseReadiness.missing.filter((m) => m !== "photos")
      : baseReadiness.missing,
  };
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
        {assets.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 mt-3" aria-label="Attached photos">
            {assets.map((a) => (
              <li
                key={a.id}
                className="relative rounded-xl overflow-hidden border border-line bg-white"
              >
                {a.state === "ready" ? (
                  // Same-origin cookie auth: the browser sends the session.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/inventory-media/${a.id}`}
                    alt="Attached home photo"
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center text-xs text-ink/60 px-2 text-center">
                    {a.state === "failed"
                      ? "Failed — reselect this photo"
                      : "Uploading…"}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute top-1 right-1 text-xs bg-ink text-cream rounded-full px-2 py-0.5"
                  onClick={() => void removeAsset(a.id)}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink/60 mt-1">
          {urlPhotos + readyAssets} photo(s) attached — uploads stay private
          until the listing is approved.
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
