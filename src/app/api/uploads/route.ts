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
      const brokerId = userBrokerId(user);
      if (!brokerId)
        return NextResponse.json(
          { error: "Broker approval required." },
          { status: 403 },
        );
      const { data: b, error } = await db
        .from("brokers")
        .select("verified")
        .eq("id", brokerId)
        .single();
      if (error) throw error;
      if (b.verified !== "verified")
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
