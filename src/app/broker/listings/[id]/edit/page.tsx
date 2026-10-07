import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAssurance, getSessionUser, userBrokerId, userRole } from "@/lib/supabase/role";
import { createServiceClient } from "@/lib/supabase/server";
import { mapListing } from "@/lib/supabase/data";
import EditListingForm from "@/components/edit-listing-form";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/auth?next=/broker/listings/${id}/edit`);
  const role = userRole(user);
  if (role !== "admin" && role !== "broker") redirect("/broker/dashboard");
  // Admins bypass ownership below — that privilege needs a TOTP session.
  if (role === "admin") {
    const { current } = await getAssurance();
    if (current !== "aal2") redirect("/admin/mfa");
  }
  const { data: row } = await createServiceClient()
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  const listing = mapListing(row);
  if (role !== "admin" && listing.brokerId !== userBrokerId(user))
    notFound();
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/broker/dashboard" className="text-sm underline">
        ← Broker dashboard
      </Link>
      <h1 className="display text-4xl font-black mt-4">Edit listing</h1>
      <p className="text-ink/65 mt-2">
        {listing.propId} · {listing.title}
      </p>
      {listing.moderationNote ? (
        <div
          role="note"
          className="mt-6 bg-mist border border-line rounded-3xl p-5"
        >
          <b className="text-sm">Note from our review team</b>
          <p className="text-sm mt-2">{listing.moderationNote}</p>
        </div>
      ) : null}
      <EditListingForm listing={listing} />
    </main>
  );
}
