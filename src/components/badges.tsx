import type { BrokerStatus, Verification } from "@/lib/mock-data";
import { freshness, type Freshness } from "@/lib/trust";
import type { Listing } from "@/lib/mock-data";

export function VerifiedBadge({ status }: { status: BrokerStatus }) {
  if (status === "verified")
    return (
      <span className="bg-pine text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
        ✓ VERIFIED
      </span>
    );
  if (status === "pending")
    return (
      <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
        PENDING KYC
      </span>
    );
  return (
    <span className="bg-red-100 text-red-700 border border-red-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
      ⚑ FLAGGED
    </span>
  );
}

export function FreshBadge({ listing }: { listing: Listing }) {
  const f: Freshness = freshness(listing);
  const styles: Record<string, string> = {
    fresh: "bg-emerald-100 text-emerald-800 border-emerald-300",
    recent: "bg-mist text-pinedark border-pine/25",
    aging: "bg-amber-50 text-amber-800 border-amber-200",
    stale: "bg-zinc-100 text-zinc-600 border-zinc-300",
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    flagged: "bg-red-50 text-red-700 border-red-300",
  };
  return (
    <span
      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${styles[f.tone] ?? styles.recent}`}
    >
      {f.label}
    </span>
  );
}

export function VerificationPill({ v }: { v: Verification }) {
  const map: Record<Verification, string> = {
    verified: "bg-pine text-white",
    pending: "bg-amber-400 text-ink",
    flagged: "bg-red-600 text-white",
    stale: "bg-zinc-500 text-white",
  };
  return (
    <span
      className={`text-[10px] font-extrabold px-2 py-1 rounded-full uppercase tracking-wide ${map[v]}`}
    >
      {v}
    </span>
  );
}
