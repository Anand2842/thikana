import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

async function main() {
  if (existsSync(".local/qa-account.json"))
    throw new Error("Clean up the previous QA account first.");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const email = `qa-${crypto.randomUUID()}@thikana-demo.example`,
    password = randomBytes(24).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { thikana_qa: true },
    app_metadata: { role: "seeker" },
  });
  if (error) throw error;
  mkdirSync(".local", { recursive: true });
  writeFileSync(
    ".local/qa-account.json",
    JSON.stringify({ id: data.user.id, email, password }),
    { mode: 0o600 },
  );
  writeFileSync(".local/qa-created.json", "{}", { mode: 0o600 });
  console.log(
    "Isolated QA account ready. Credentials remain private in .local.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
