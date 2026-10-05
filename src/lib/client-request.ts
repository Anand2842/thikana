export async function request(
  url: string,
  body: Record<string, unknown> | FormData,
  method = "POST",
) {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      ...(body instanceof FormData
        ? { body }
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error("Connection lost. Please try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.errors?.join(" ") ??
        data.error ??
        "Could not save. Please try again.",
    );
  return data;
}
