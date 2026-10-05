import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const file = ".local/demo-accounts.json";
const previous = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const accounts: Record<
  string,
  { email: string; password: string; id: string }
> = {};
async function main() {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const [label, role, broker] of [
    ["seeker", "seeker", null],
    ["broker", "broker", "B1"],
    ["admin", "admin", null],
    ["other", "seeker", null],
    ["applicant", "seeker", null],
  ]) {
    const email = `${label}@thikana-demo.example`,
      existing = data.users.find((u) => u.email === email);
    if (existing && !existing.user_metadata.thikana_demo)
      throw new Error("Existing account is not a Thikana demo user.");
    const password =
      previous[label!]?.password ?? randomBytes(18).toString("base64url");
    const attrs = {
      password,
      email_confirm: true,
      app_metadata: { role, broker_id: broker },
      user_metadata: { thikana_demo: true },
    };
    const result = existing
      ? await db.auth.admin.updateUserById(existing.id, attrs)
      : await db.auth.admin.createUser({ email, ...attrs });
    if (result.error) throw result.error;
    accounts[label!] = { email, password, id: result.data.user.id };
  }
  mkdirSync(".local", { recursive: true });
  writeFileSync(file, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  const { error: leadError } = await db
    .from("leads")
    .upsert(
      {
        id: "LD-DEMO-SEEKER",
        listing_id: "L001",
        broker_id: "B1",
        owner_id: accounts.seeker.id,
        user_name: "Demo Home Seeker",
        phone: "9000000001",
        msg: "Looking for a bright 2 BHK near the metro. Demo enquiry.",
        date: new Date().toISOString().slice(0, 10),
      },
      { ignoreDuplicates: true },
    );
  if (leadError) throw leadError;
  const rows = [
    {
      id: "LD-DEMO-VISIT",
      listing_id: "L001",
      broker_id: "B1",
      owner_id: accounts.seeker.id,
      user_name: "Demo Home Seeker",
      phone: "9000000001",
      msg: "Demo completed visit — both parties confirmed.",
      status: "Visited",
      date: new Date().toISOString().slice(0, 10),
      visit_at: new Date(Date.now() - 86400000).toISOString(),
      seeker_visited: true,
      broker_visited: true,
    },
  ];
  const { error: ve } = await db
    .from("leads")
    .upsert(rows, { ignoreDuplicates: true });
  if (ve) throw ve;
  console.log(
    "Demo accounts ready. Credentials saved privately in .local/demo-accounts.json",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
