# Rerun this audit locally

These checks target an isolated Next.js app on port 4317, a Supabase test double on port 4318, and the legacy prototype on port 4319. They deliberately exercise mutations and failure states; their application URL is fixed to localhost. `seed.json` contains only the repository's sample dataset.

The existing sanitized application copy is at `/tmp/settle-audit-20261006/app`. If it is missing, recreate it without copying `.env` or `.git`:

```sh
mkdir -p /tmp/settle-audit-20261006/app
rsync -a --exclude node_modules --exclude .next --exclude .git --exclude '.env*' /Users/anand/Downloads/settle/ /tmp/settle-audit-20261006/app/
cp -cR /Users/anand/Downloads/settle/node_modules /tmp/settle-audit-20261006/app/node_modules
```

`cp -cR` uses macOS copy-on-write cloning. The dependencies must physically reside inside the copied app: Turbopack rejected an external `node_modules` symlink in the first harness setup attempt. That setup error was corrected and is not an application finding.

Start the local test double in one terminal:

```sh
/Users/anand/.pyenv/versions/3.11.10/bin/python3 /Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/fake_supabase.py
```

Build and start the isolated app in another terminal. These are dummy credentials for the local test double:

```sh
cd /tmp/settle-audit-20261006/app
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4318 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=audit-public-key npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4318 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=audit-public-key SUPABASE_SERVICE_ROLE_KEY=audit-service-key CRON_SECRET=audit-cron-secret npm run start -- --port 4317
```

Run the checks sequentially; the flow suite resets and mutates the local sample tables:

```sh
cd /Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06
/Users/anand/.pyenv/versions/3.11.10/bin/python3 browser_audit.py
/Users/anand/.pyenv/versions/3.11.10/bin/python3 flow_audit.py
/Users/anand/.pyenv/versions/3.11.10/bin/python3 extra_audit.py
/Users/anand/.pyenv/versions/3.11.10/bin/python3 final_checks.py
```

For prototype checks, start a static server and run the additional script:

```sh
/Users/anand/.pyenv/versions/3.11.10/bin/python3 -m http.server 4319 --bind 127.0.0.1 --directory /tmp/settle-audit-20261006/app
```

```sh
/Users/anand/.pyenv/versions/3.11.10/bin/python3 /Users/anand/.codex/worktrees/efbf/settle/audit/2026-10-06/prototype_audit.py
```

The Python runtime used here already has Playwright installed, and the scripts launch the installed Chrome in headless mode. Results and screenshots are written to this folder's `evidence` directory. `FAIL` in `flow_audit.py` means the observed behavior failed its stated expectation; it is not a suite crash. JSON files record the expected and actual result of each case. Stop the three local servers after the run.
