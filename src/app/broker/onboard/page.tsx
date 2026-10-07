"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PHASE1_CITIES } from "@/lib/mock-data";
import { request } from "@/lib/client-request";
import { createClient } from "@/lib/supabase/client";
import { POLICY_VERSION } from "@/lib/policies";

interface EditInitial {
  agency: string;
  city: string;
  areas: string;
  policy: string;
  businessAddress: string;
  exp: string;
  cats: string;
  photo: string;
}

export default function BrokerOnboardPage() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [photoUrl, setPhotoUrl] = useState(""),
    [mode, setMode] = useState<"unknown" | "create" | "edit">("unknown"),
    [editId, setEditId] = useState<string | null>(null),
    [initial, setInitial] = useState<EditInitial | null>(null);

  // Edit mode (?state=edit&broker=<id>): prefill from the public catalog and
  // save via self-update PATCH. Ownership is enforced server-side (403).
  // Sync setState on mount is intentional here: the query param can only be
  // read client-side, and starting from "unknown" keeps SSR/hydration output
  // identical (loading shell) in both modes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("state") !== "edit") {
      setMode("create");
      return;
    }
    const bid = sp.get("broker");
    if (!bid) {
      setMode("create");
      setMessage("Missing broker reference — showing a new application.");
      return;
    }
    setEditId(bid);
    fetch("/api/brokers")
      .then((r) => r.json())
      .then((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const br = ((d.brokers ?? []) as any[]).find((x) => x.id === bid);
        if (!br) throw new Error("not found");
        setInitial({
          agency: br.agency ?? "",
          city: br.cities?.[0] ?? PHASE1_CITIES[0],
          areas: (br.areas ?? []).join(", "),
          policy: br.policy ?? "",
          businessAddress: br.businessAddress ?? "",
          exp: br.exp === undefined || br.exp === null ? "" : String(br.exp),
          cats: (br.cats ?? []).join(", "),
          photo: br.photo ?? "",
        });
        setMode("edit");
      })
      .catch(() => {
        setMode("create");
        setMessage("Could not load your profile — showing a new application.");
      });
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const areas = String(f.get("areas"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        cats = String(f.get("cats") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        businessAddress = String(f.get("businessAddress") ?? "").trim(),
        expRaw = String(f.get("exp") ?? "").trim(),
        exp = expRaw === "" ? undefined : Number(expRaw);
      let photo = String(f.get("photo") ?? "").trim();
      const photoFile = f.get("photoFile");
      if (photoFile instanceof File && photoFile.size > 0) {
        const upload = new FormData();
        upload.set("file", photoFile);
        upload.set("kind", "photo");
        try {
          photo = (await request("/api/uploads", upload)).url;
        } catch {
          throw new Error(
            "Profile photo upload failed — submit first, then add your photo via Edit profile.",
          );
        }
        setPhotoUrl(photo);
      }
      if (editId) {
        await request(
          `/api/brokers/${editId}`,
          {
            agency: f.get("agency"),
            photo: photo || undefined,
            businessAddress,
            areas,
            policy: f.get("policy"),
            exp,
            cities: [f.get("city")],
            cats,
          },
          "PATCH",
        );
        window.location.assign(`/brokers/${editId}`);
        return;
      }
      const paths: string[] = [];
      for (const key of ["identity", "business"]) {
        const upload = new FormData();
        upload.set("file", f.get(key)!);
        upload.set("kind", "proof");
        paths.push((await request("/api/uploads", upload)).path);
      }
      await request("/api/brokers", {
        name: f.get("name"),
        agency: f.get("agency"),
        phone: f.get("phone"),
        city: f.get("city"),
        areas,
        policy: f.get("policy"),
        identityPath: paths[0],
        businessPath: paths[1],
        photo: photo || undefined,
        businessAddress,
        exp,
        cats,
        acceptBrokerTerms: f.get("acceptBrokerTerms") === "on",
        consentVerification: f.get("consentVerification") === "on",
        policyVersion: POLICY_VERSION,
        privacyVersion: POLICY_VERSION,
      });
      const { error } = await createClient().auth.refreshSession();
      if (error) throw error;
      // The role changed; discard pages prefetched with the old session.
      window.location.assign("/broker/dashboard");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (mode === "unknown")
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-ink/65">Loading…</p>
      </main>
    );
  const editing = mode === "edit" && !!editId && !!initial;
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="eyebrow">FOR LOCAL BROKERS</div>
      <h1 className="display text-4xl font-black">
        {editing ? "Update your profile." : "Build trust before the visit."}
      </h1>
      <p className="mt-3 text-ink/65">
        {editing
          ? "Edit your public profile below. Changes never affect your verification status."
          : "Apply for a broker profile. Our team checks your identity and business documents before granting verification."}
      </p>
      <form
        onSubmit={submit}
        className="mt-6 bg-cream border border-line rounded-3xl p-5 sm:p-8 grid sm:grid-cols-2 gap-4"
      >
        {!editing && (
          <>
            <label>
              Full name
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label>
              Mobile number
              <input
                name="phone"
                required
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
              />
            </label>
          </>
        )}
        <label>
          Agency name
          <input
            name="agency"
            required
            minLength={2}
            maxLength={100}
            defaultValue={initial?.agency}
          />
        </label>
        <label>
          City
          <select name="city" defaultValue={initial?.city}>
            {PHASE1_CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          Areas served, comma separated
          <input
            name="areas"
            required
            maxLength={1000}
            placeholder="Dwarka, Janakpuri"
            defaultValue={initial?.areas}
          />
        </label>
        <label className="sm:col-span-2">
          Business address
          <input
            name="businessAddress"
            maxLength={300}
            placeholder="Shop 4, Main Market, Dwarka Sector 6, Delhi"
            defaultValue={initial?.businessAddress}
          />
        </label>
        <label>
          Experience (years)
          <input
            name="exp"
            required
            type="number"
            min={0}
            max={50}
            step={1}
            placeholder="5"
            defaultValue={initial?.exp}
          />
        </label>
        <label>
          Specialties, comma separated
          <input
            name="cats"
            maxLength={500}
            placeholder="Family, 2BHK"
            defaultValue={initial?.cats}
          />
        </label>
        <label className="sm:col-span-2">
          Public brokerage policy
          <textarea
            name="policy"
            required
            minLength={10}
            maxLength={1000}
            placeholder="15 days brokerage, no visit fee, all charges disclosed"
            rows={3}
            defaultValue={initial?.policy}
          />
        </label>
        <label className="sm:col-span-2">
          Profile photo
          <input
            name="photoFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <input type="hidden" name="photo" value={photoUrl || initial?.photo || ""} readOnly />
        {!editing && (
          <>
            <label>
              Masked identity proof
              <input
                name="identity"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                required
              />
            </label>
            <label>
              Business / agency proof
              <input
                name="business"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                required
              />
            </label>
            <p className="sm:col-span-2 text-xs text-ink/65">
              JPEG, PNG or PDF, up to 5 MB each. Mask sensitive ID numbers
              before uploading. Documents are private and available only to our
              review team.
            </p>
            <div className="sm:col-span-2 border-t border-line pt-4 space-y-3 text-sm">
              <label className="flex items-start gap-3">
                <input className="mt-1 w-4 h-4 shrink-0" type="checkbox" name="acceptBrokerTerms" required />
                <span>I am at least 18 and authorised to represent this agency. I accept the <Link className="underline" href="/broker-agreement" target="_blank" rel="noopener noreferrer">Broker Agreement</Link> and <Link className="underline" href="/terms" target="_blank" rel="noopener noreferrer">Terms of use</Link>.</span>
              </label>
              <label className="flex items-start gap-3">
                <input className="mt-1 w-4 h-4 shrink-0" type="checkbox" name="consentVerification" required />
                <span>I consent to private review of my identity and business proof for verification and related case handling described in the <Link className="underline" href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</Link>. I can request withdrawal through Privacy &amp; appeals.</span>
              </label>
              <p className="text-xs text-ink/55">Version {POLICY_VERSION}. No marketing permission is included. The team cannot approve an application without the required verification checks.</p>
            </div>
          </>
        )}
        <button className="button sm:col-span-2" disabled={busy}>
          {busy
            ? "Uploading & submitting…"
            : editing
              ? "Save profile changes"
              : "Submit application"}
        </button>
        {message && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {message}
          </p>
        )}
      </form>
      <Link className="block mt-6 underline text-sm" href="/broker/dashboard">
        Already applied? View application status →
      </Link>
    </main>
  );
}
