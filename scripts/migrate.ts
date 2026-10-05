import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env.");
const files = [
  "schema.sql",
  ...readdirSync("supabase")
    .filter((f) => f.startsWith("migration-") && f.endsWith(".sql"))
    .sort(),
];
for (const file of files) {
  const r = spawnSync(
    "psql",
    [
      process.env.DATABASE_URL,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      `supabase/${file}`,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stderr.replaceAll(process.env.DATABASE_URL, "[database]"));
    process.exit(1);
  }
  console.log(`Applied ${file}`);
}
