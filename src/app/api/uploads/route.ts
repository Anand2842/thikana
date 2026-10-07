import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorize, invalid, unavailable } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/server";
import { userBrokerId } from "@/lib/supabase/role";
import { checkRateLimit } from "@/lib/ratelimit";
export async function POST(req: Request) {
  const { user, response } = await authorize();
  if (response) return response;
  const limited = checkRateLimit(req, {
    limit: 20,
    windowMs: 60000,
    key: `uploads:${user!.id}`,
  });
  if (limited) return limited;
  if (Number(req.headers.get("content-length")) > 5_300_000)
    return invalid(["Files must be at most 5 MB."]);
  try {
    const form = await req.formData();
    const file = form.get("file"),
      kind = form.get("kind");
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 5242880 ||
      !["photo", "proof"].includes(String(kind))
    )
      return invalid(["Choose a file up to 5 MB."]);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Content hash lets listing intake flag the same file re-uploaded under
    // a different URL or filename. Resized/cropped variants hash differently
    // and remain a manual-review gap.
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const type =
      bytes[0] === 255 && bytes[1] === 216
        ? "image/jpeg"
        : bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          ? "image/png"
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
            ? "image/webp"
            : String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
              ? "application/pdf"
              : "";
    if (
      !type ||
      file.type !== type ||
      (kind === "photo" && type === "application/pdf") ||
      (kind === "proof" && type === "image/webp")
    )
      return invalid([
        "Use a valid JPEG or PNG, WEBP for photos, or PDF for proof.",
      ]);
    const db = createServiceClient();
    if (kind === "photo") {
      // DECISION: any caller with a broker row may upload kind=photo to their
      // own pending profile — no verified-status gate. The verified gate
      // blocked UNVERIFIED applicants from setting a profile photo at all
      // (onboard/edit flows submit photo as a public URL on their own row).
      // Abuse reasoning: rate-limited (20/min per user, like all uploads),
      // 5 MB + magic-byte checked as today, stored under the uploader's own
      // user-id prefix, and the URL only ever renders if saved on the
      // uploader's own broker row (self-update PATCH enforces ownership and
      // cities/areas edits never change verified status). Worst case is one
      // photo on one's own pending profile, which KYC reviews before
      // approval. Callers with no broker row keep the 403 below.
      const brokerId = userBrokerId(user);
      if (!brokerId)
        return NextResponse.json(
          { error: "Broker approval required." },
          { status: 403 },
        );
      const { data: b, error } = await db
        .from("brokers")
        .select("id")
        .eq("id", brokerId)
        .maybeSingle();
      if (error) throw error;
      if (!b)
        return NextResponse.json(
          { error: "Broker approval required." },
          { status: 403 },
        );
    }
    const bucket = kind === "photo" ? "listing-photos" : "broker-proofs",
      path = `${user!.id}/${crypto.randomUUID()}.${type === "application/pdf" ? "pdf" : type.split("/")[1]}`;
    const { error } = await db.storage
      .from(bucket)
      .upload(path, bytes, { contentType: type });
    if (error) throw error;
    return NextResponse.json(
      {
        path,
        sha256,
        url:
          kind === "photo"
            ? db.storage.from(bucket).getPublicUrl(path).data.publicUrl
            : undefined,
      },
      { status: 201 },
    );
  } catch (e) {
    return unavailable(e);
  }
}
