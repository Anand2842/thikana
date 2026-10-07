import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import InventoryEditor from "@/components/inventory-editor";
import BuildingManager from "@/components/building-manager";
import CaptureForm from "@/components/capture-form";

export const metadata = { robots: { index: false, follow: false } };

interface DraftRow {
  id: string;
  building_id: string | null;
  fields: Record<string, unknown>;
  confirmations: Record<string, unknown>;
  revision: number;
  archived: boolean;
  submitted_listing_id: string | null;
  updated_at: string;
}

interface BuildingRow {
  id: string;
  label: string;
  city: string;
  locality: string;
  revision: number;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/broker/inventory");
  const role = userRole(user);
  if (role !== "broker" && role !== "admin") redirect("/broker/dashboard");
  const brokerId = role === "admin" ? null : userBrokerId(user);
  if (!brokerId && role !== "admin") redirect("/broker/dashboard");
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" ? sp.draft : "";
  const buildingFilter = typeof sp.building === "string" ? sp.building : "";
  const showArchived = sp.archived === "1";

  const db = createServiceClient();
  // Admins previewing the workspace see nothing by default (no broker
  // selected); brokers always see only their own rows (broker_id filter).
  const scopeId = brokerId ?? "";
  const [{ data: drafts }, { data: buildings }, { data: broker }] =
    await Promise.all([
      scopeId
        ? db
            .from("listing_drafts")
            .select("*")
            .eq("broker_id", scopeId)
            .eq("archived", showArchived)
            .order("updated_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
      scopeId
        ? db
            .from("broker_buildings")
            .select("id,label,city,locality,revision")
            .eq("broker_id", scopeId)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      scopeId
        ? db.from("brokers").select("verified").eq("id", scopeId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const draftRows = ((drafts ?? []) as unknown as DraftRow[])
    .filter((d) => !buildingFilter || d.building_id === buildingFilter)
    .map((d) => ({
      id: d.id,
      buildingId: d.building_id,
      fields: d.fields,
      confirmations: d.confirmations,
      revision: d.revision,
      submittedListingId: d.submitted_listing_id,
    }));
  const buildingRows = (buildings ?? []) as unknown as BuildingRow[];
  const activeDraft =
    draftId && scopeId
      ? (
          await db
            .from("listing_drafts")
            .select("*")
            .eq("id", draftId)
            .eq("broker_id", scopeId)
            .maybeSingle()
        ).data
      : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/broker/dashboard" className="text-sm underline">
        ← Broker dashboard
      </Link>
      <h1 className="display text-4xl font-black mt-4">Add homes fast</h1>
      <p className="text-ink/65 mt-2 max-w-2xl">
        Save partial drafts from memory or duplicate similar units, then
        finish and submit. Drafts stay private until submitted for review.
        {broker && (broker as { verified: string }).verified !== "verified" && (
          <span className="block mt-1 font-bold">
            Your account is under review: you can view drafts, but saving and
            submitting unlock after approval.
          </span>
        )}
      </p>
      <InventoryEditor
        drafts={draftRows}
        buildings={buildingRows}
        activeDraft={
          activeDraft
            ? {
                id: (activeDraft as DraftRow).id,
                buildingId: (activeDraft as DraftRow).building_id,
                fields: (activeDraft as DraftRow).fields,
                confirmations: (activeDraft as DraftRow).confirmations,
                revision: (activeDraft as DraftRow).revision,
                submittedListingId: (activeDraft as DraftRow)
                  .submitted_listing_id,
              }
            : null
        }
      />
      <BuildingManager buildings={buildingRows} />
      <CaptureForm />
    </main>
  );
}
