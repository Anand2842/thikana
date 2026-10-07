import "server-only";

// Slice 5 extraction: one server-side request with schema-constrained
// output. Native fetch only, 30s timeout, store:false. The model proposes
// partial property candidates; the server validates every value before
// anything is saved. Unknown stays null, ambiguous stays undecided.

export const MAX_CAPTURE_CHARS = 10_000;
export const MAX_CAPTURE_SCREENSHOTS = 3;
export const MAX_CANDIDATES = 10;
export const EXTRACT_TIMEOUT_MS = 30_000;
export const MAX_EXTRACT_ATTEMPTS = 3;
export const MAX_EXTRACT_PER_DAY = 20;

export type ExtractionFailure =
  | "off"
  | "timeout"
  | "refused"
  | "invalid"
  | "unavailable";

export class ExtractionError extends Error {
  kind: ExtractionFailure;
  constructor(kind: ExtractionFailure, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface RawCandidate {
  unit?: unknown;
  bhk?: unknown;
  rent?: unknown;
  deposit?: unknown;
  area?: unknown;
  furnishing?: unknown;
  type?: unknown;
  city?: unknown;
  locality?: unknown;
  address?: unknown;
  avail?: unknown;
  excerpt?: unknown;
}

export interface ProposedDraft {
  fields: Record<string, unknown>;
  excerpt: string;
}

const FURNISHINGS = ["Unfurnished", "Semi-Furnished", "Fully Furnished"];
const TYPES = ["Apartment", "Studio", "Independent House", "Villa", "PG", "Plot"];
const CITIES = ["Delhi", "Gurugram", "Noida", "Greater Noida", "Ghaziabad"];

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t ? t : null;
};
const cleanInt = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  return n >= min && n <= max ? n : null;
};
const cleanDate = (v: unknown): string | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : v;
};

// Server-side candidate validation: sizes, enums, numeric ranges, dates.
// Anything outside contract becomes null (unknown) instead of an error —
// one bad value must not discard the other nine candidates. Returns at most
// MAX_CANDIDATES proposed drafts; fewer when the provider over-promises.
export function validateCandidates(raw: unknown): ProposedDraft[] {
  if (!Array.isArray(raw)) throw new ExtractionError("invalid", "Extraction did not return candidates.");
  return raw.slice(0, MAX_CANDIDATES).map((item) => {
    const c = (item ?? {}) as RawCandidate;
    const fields: Record<string, unknown> = {};
    const unit = cleanText(c.unit, 100);
    if (unit) fields.unit = unit;
    const bhk = cleanInt(c.bhk, 1, 10);
    if (bhk !== null) fields.bhk = bhk;
    const rent = cleanInt(c.rent, 1, 100_000_000);
    if (rent !== null) fields.rent = rent;
    const deposit = cleanInt(c.deposit, 0, 100_000_000);
    if (deposit !== null) fields.deposit = deposit;
    const area = cleanInt(c.area, 1, 100_000);
    if (area !== null) fields.area = area;
    if (typeof c.furnishing === "string" && FURNISHINGS.includes(c.furnishing))
      fields.furnishing = c.furnishing;
    if (typeof c.type === "string" && TYPES.includes(c.type)) fields.type = c.type;
    if (typeof c.city === "string" && CITIES.includes(c.city)) fields.city = c.city;
    const locality = cleanText(c.locality, 100);
    if (locality) fields.locality = locality;
    const address = cleanText(c.address, 300);
    if (address) fields.address = address;
    const avail = cleanDate(c.avail);
    if (avail) fields.avail = avail;
    return { fields, excerpt: cleanText(c.excerpt, 500) ?? "" };
  });
}

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      maxItems: MAX_CANDIDATES,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          unit: { type: ["string", "null"] },
          bhk: { type: ["number", "null"] },
          rent: { type: ["number", "null"] },
          deposit: { type: ["number", "null"] },
          area: { type: ["number", "null"] },
          furnishing: { type: ["string", "null"] },
          type: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          locality: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          avail: { type: ["string", "null"] },
          excerpt: { type: ["string", "null"] },
        },
      },
    },
  },
  required: ["candidates"],
};

const SYSTEM_PROMPT = [
  "Extract rental property listings from the user's pasted message and/or screenshots.",
  "Return at most 10 candidates as partial facts. Use null for anything unknown or ambiguous — never guess.",
  "Do not invent metro proximity, luxury finishes, owner verification, fees, or contact details.",
  "Copy a short source excerpt per candidate when the input is text.",
  "Cities must be one of: Delhi, Gurugram, Noida, Greater Noida, Ghaziabad.",
  "Dates must be YYYY-MM-DD. Amounts are monthly rupees as numbers.",
].join(" ");

// One bounded provider call. Throws ExtractionError; never returns
// unvalidated content. Without a server key the workflow is off and the
// broker keeps manual entry.
export async function runProviderExtraction(opts: {
  text: string;
  images: { mime: string; base64: string }[];
}): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new ExtractionError(
      "off",
      "Automatic extraction is off. Add homes manually — quick add takes under a minute.",
    );
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const content: Record<string, unknown>[] = [];
  if (opts.text.trim())
    content.push({ type: "input_text", text: opts.text.slice(0, MAX_CAPTURE_CHARS) });
  for (const img of opts.images)
    content.push({
      type: "input_image",
      image_url: `data:${img.mime};base64,${img.base64}`,
    });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXTRACT_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/responses`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "property_candidates",
            strict: true,
            schema: EXTRACTION_SCHEMA,
          },
        },
      }),
    });
    if (res.status === 429 || res.status >= 500)
      throw new ExtractionError("unavailable", "Extraction service is busy. Try again or add homes manually.");
    if (!res.ok)
      throw new ExtractionError("unavailable", "Extraction failed. Your text is kept — try again or add homes manually.");
    const data = (await res.json().catch(() => null)) as {
      output_text?: string;
      output?: { content?: { text?: string }[] }[];
    } | null;
    const textOut =
      data?.output_text ??
      data?.output
        ?.flatMap((o) => o.content ?? [])
        .map((c) => c.text ?? "")
        .join("");
    if (!textOut) throw new ExtractionError("refused", "The message could not be read. Add the home manually.");
    const parsed = JSON.parse(textOut) as { candidates?: unknown };
    if (!parsed || !Array.isArray(parsed.candidates))
      throw new ExtractionError("invalid", "Extraction returned an unreadable result. Add the home manually.");
    return parsed.candidates;
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    if ((e as Error).name === "AbortError")
      throw new ExtractionError("timeout", "Extraction timed out after 30 seconds. Your text is kept — try again or add manually.");
    throw new ExtractionError("unavailable", "Extraction failed. Your text is kept — try again or add homes manually.");
  } finally {
    clearTimeout(timer);
  }
}
