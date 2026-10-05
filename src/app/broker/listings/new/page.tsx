import { redirect } from "next/navigation";
import { getSessionUser, userBrokerId } from "@/lib/supabase/role";
import { fetchBroker } from "@/lib/supabase/data";
import NewListingForm from "@/components/new-listing-form";
export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/auth?next=/broker/listings/new");
  const id = userBrokerId(user);
  if (!id) redirect("/broker/dashboard");
  const broker = await fetchBroker(id);
  if (broker?.verified !== "verified") redirect("/broker/dashboard");
  return <NewListingForm />;
}
