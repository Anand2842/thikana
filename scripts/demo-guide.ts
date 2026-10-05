import { readFileSync, writeFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".local/demo-accounts.json", "utf8"));
const lines = [
  "# Thikana demo",
  "",
  "Open http://localhost:3001/auth and choose **Password**.",
  "",
  "| Account | Email | Password |",
  "| --- | --- | --- |",
];
for (const role of ["seeker", "broker", "admin", "applicant", "other"])
  lines.push(
    `| ${role} | ${accounts[role].email} | ${accounts[role].password} |`,
  );
lines.push(
  "",
  "These accounts are in your Supabase project. Keep this file private; the admin has real moderation access.",
  "",
  "- Seeker: browse, save, enquire, schedule visits and review the completed demo visit.",
  "- Broker: B1 / Raj Properties; reconfirm owned inventory, create listings and update assigned enquiries.",
  "- Admin: review applications and listings, inspect reports, suspend brokers and view city demand.",
  "- Applicant: upload the two fictional demo PDFs below to test onboarding. The admin then reviews and approves this profile.",
  "- Other: a separate seeker, useful for checking that private enquiries remain isolated.",
  "",
  "Upload fixtures: `demo-identity-proof.pdf` and `demo-business-proof.pdf` beside this file. Both are clearly marked fictional. They are not real identity or business documents.",
  "",
  "For a new listing use full details, a photo upload or an HTTPS URL, and disclose all fees. Listings start pending; admin approval publishes them. Both parties confirm a visit only after its scheduled time.",
);
writeFileSync(".local/DEMO.md", lines.join("\n") + "\n", { mode: 0o600 });
function pdf(title: string) {
  const stream = `BT /F1 20 Tf 50 760 Td (${title}) Tj 0 -35 Td /F1 12 Tf (DEMO ONLY - Fictional upload fixture. Not valid proof.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let doc = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(doc));
    doc += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(doc);
  doc +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return doc;
}
writeFileSync(
  ".local/demo-identity-proof.pdf",
  pdf("Thikana - Demo Identity Fixture"),
  { mode: 0o600 },
);
writeFileSync(
  ".local/demo-business-proof.pdf",
  pdf("Thikana - Demo Business Fixture"),
  { mode: 0o600 },
);
console.log("Private demo guide and fictional upload PDFs prepared.");
