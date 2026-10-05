import { NextResponse } from "next/server";

// ponytail: per-instance abuse friction; use shared storage for strict multi-instance limits.
//
// NOTE (Vercel caveat): this lives in per-instance memory, so limits are
// enforced per serverless instance, not globally. Fine for basic spam
// friction; upgrade to Upstash Redis (@upstash/ratelimit) if you need
// exact global limits.
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

export function checkRateLimit(
  req: Request,
  opts: { limit: number; windowMs: number; key?: string },
): NextResponse | null {
  const id = `${opts.key ?? "global"}:${clientIp(req)}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  if (buckets.size > 1000)
    for (const [key, value] of buckets)
      if (value.hits.at(-1)! <= cutoff) buckets.delete(key);
  if (buckets.size > 10_000)
    return NextResponse.json(
      { error: "Please try again later." },
      { status: 429 },
    );
  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(id, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  if (bucket.hits.length >= opts.limit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }
  bucket.hits.push(now);
  return null;
}
