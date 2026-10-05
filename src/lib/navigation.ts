export function safeNext(raw: string | null, fallback = "/dashboard") {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(raw)
  )
    return fallback;
  try {
    const u = new URL(raw, "https://thikana.invalid");
    return u.origin === "https://thikana.invalid"
      ? u.pathname + u.search + u.hash
      : fallback;
  } catch {
    return fallback;
  }
}
