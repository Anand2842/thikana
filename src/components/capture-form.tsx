"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-request";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `web-${Date.now()}`;
  }
}

interface Proposed {
  id: string;
  fields: Record<string, unknown>;
  excerpt: string;
}

// Message/screenshot capture: the broker explicitly selects text or up to
// three screenshots and taps Create drafts. Selected inputs go to the
// extraction provider once; results are proposed drafts the broker reviews
// and corrects — permission and fees are never filled in.
export default function CaptureForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [shots, setShots] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [proposed, setProposed] = useState<Proposed[]>([]);

  async function attachScreenshots(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    try {
      const sb = createBrowserSupabase();
      const next = [...shots];
      for (const file of Array.from(files).slice(0, 3 - next.length)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error(`${file.name}: choose JPEG, PNG or WEBP.`);
        if (file.size > 5 * 1024 * 1024)
          throw new Error(`${file.name}: must be under 5 MB.`);
        const slot = await request("/api/broker/drafts/assets", {
          kind: "screenshot",
          mime: file.type,
          bytes: file.size,
        });
        const { error: ue } = await sb.storage
          .from("inventory-media")
          .uploadToSignedUrl(slot.path, slot.token, file);
        if (ue) throw new Error(`${file.name}: upload failed. Try again.`);
        const done = await request(
          `/api/broker/drafts/assets/${slot.asset.id}/complete`,
          {},
          "POST",
        );
        if (done.asset?.state !== "ready")
          throw new Error(`${file.name}: could not be verified.`);
        next.push({ id: slot.asset.id, name: file.name });
      }
      setShots(next);
      setText("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createDrafts() {
    const useText = text.trim().length > 0;
    if (useText === (shots.length > 0)) {
      setMessage("Paste text or select screenshots — not both.");
      return;
    }
    setBusy(true);
    setMessage("");
    setNotice("");
    setProposed([]);
    try {
      const made = await request("/api/broker/capture", {
        clientRequestId: newRequestId(),
        ...(useText ? { text: text.trim() } : { screenshotIds: shots.map((s) => s.id) }),
      });
      const done = await request(
        `/api/broker/capture/${made.request.id}/extract`,
        {},
        "POST",
      );
      if (done.notice) setNotice(done.notice);
      setProposed(Array.isArray(done.drafts) ? done.drafts : []);
      if ((done.drafts ?? []).length)
        setMessage(
          `${done.drafts.length} proposed draft${done.drafts.length === 1 ? "" : "s"} — review every field before submitting.`,
        );
      setText("");
      setShots([]);
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 bg-cream border border-line rounded-3xl p-5">
      <h2 className="font-extrabold">From message or screenshot</h2>
      <p className="text-[13px] text-ink/65 mt-1">
        Paste a property message or select up to three screenshots, then create
        drafts. Only what you select is sent to the extraction provider, once.
        Review every proposed field — permission and fees always need your
        confirmation. <Link className="underline" href="/privacy">How extraction handles data</Link>.
      </p>
      <textarea
        className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] mt-3"
        rows={4}
        maxLength={10000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) setShots([]);
        }}
        placeholder="Paste the owner's message here…"
        aria-label="Property message text"
      />
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <label className="text-[13px]">
          Screenshots (max 3)
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="block mt-1"
            onChange={(e) => void attachScreenshots(e.target.files)}
            aria-label="Select screenshots"
          />
        </label>
        {shots.length > 0 && (
          <p className="text-[12px] text-ink/60">
            {shots.length} attached: {shots.map((s) => s.name).join(", ")}
          </p>
        )}
      </div>
      <button
        className="button mt-3"
        disabled={busy}
        onClick={() => void createDrafts()}
      >
        {busy ? "Working…" : "Create drafts"}
      </button>
      {message && (
        <p role="status" className="text-sm mt-2">
          {message}
        </p>
      )}
      {notice && <p className="text-sm mt-2 text-ink/70">{notice}</p>}
      {proposed.length > 0 && (
        <ul className="mt-3 space-y-2">
          {proposed.map((p) => (
            <li
              key={p.id}
              className="bg-white border border-line rounded-2xl p-3 text-[13px]"
            >
              <Link
                className="font-bold underline"
                href={`/broker/inventory?draft=${p.id}`}
              >
                Review proposed draft →
              </Link>
              {p.excerpt && (
                <p className="text-ink/60 mt-1">“{p.excerpt}”</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
