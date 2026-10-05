// Phase 2 helper: validate + persist uploaded photos.
// For now accepts remote URLs (Unsplash) or data-URLs and returns them unchanged.
// Wire to S3 / Vercel Blob when broker listing uploads go live.
export function acceptPhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((u): u is string => typeof u === "string" && u.length > 8).slice(0, 8);
}
