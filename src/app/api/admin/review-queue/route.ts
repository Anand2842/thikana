import { NextResponse } from "next/server";
import { requireAdmin, unavailable } from "@/lib/api";
import { fetchReviewQueue } from "@/lib/review-queue";

// Grouped moderation queue for programmatic/admin use. Approvals still go
// through the atomic moderate_listing path — a batch is never proof and
// never auto-verifies.
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  try {
    return NextResponse.json({ groups: await fetchReviewQueue() });
  } catch (e) {
    return unavailable(e);
  }
}
