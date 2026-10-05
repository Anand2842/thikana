import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = 'http://127.0.0.1:4338'
accounts = json.loads((ROOT/'.local/demo-accounts.json').read_text())
checks = []
def check(name, passed):
 checks.append({'name': name, 'pass': bool(passed)})
 print(('PASS ' if passed else 'FAIL ')+name, flush=True)

with sync_playwright() as pw:
 browser = pw.chromium.launch(headless=True, channel='chrome')
 ctx = browser.new_context(); p = ctx.new_page()
 p.goto(BASE+'/auth', wait_until='networkidle')
 p.get_by_role('button', name='Password', exact=True).click()
 p.get_by_label('Email', exact=True).fill(accounts['seeker']['email'])
 p.get_by_label('Password', exact=True).fill(accounts['seeker']['password'])
 p.get_by_role('button', name='Sign in', exact=True).click()
 p.wait_for_url(BASE+'/dashboard')
 public = browser.new_context()
 for path in ['/', '/properties', '/brokers', '/properties/L001']:
  r = public.request.get(BASE+path); check('public reads work with invalid service key '+path, r.status==200 and 'We couldn’t load this page.' not in r.text())
 check('private read returns 503 rather than demo data', ctx.request.get(BASE+'/api/leads').status==503)
 writes = [
  ('/api/leads', {'listingId':'L001','name':'Failure QA','phone':'9000000001'}),
  ('/api/saved', {'listingId':'L001','saved':True}),
  ('/api/reports', {'listingId':'L001','reason':'Other','details':'Failure QA only; no report should save.'}),
  ('/api/reviews', {'leadId':'LD-DEMO-VISIT','rating':5,'text':'Failure QA only; no review should save.'}),
  ('/api/city-requests', {'city':'Failure QA City','name':'Failure QA','phone':'9000000001','userType':'seeker'})
 ]
 for path, payload in writes:
  r = ctx.request.post(BASE+path, data=payload)
  check('failed write returns 503 '+path, r.status==503 and 'error' in r.json())
 p.goto(BASE+'/', wait_until='networkidle')
 p.get_by_label('City', exact=True).fill('Failure QA City')
 p.get_by_label('Your name', exact=True).fill('Failure QA')
 p.get_by_label('Mobile number', exact=True).fill('9000000001')
 p.get_by_role('button', name='Request my city').click()
 p.get_by_text('Could not save changes. Please try again.').wait_for()
 check('provider failure is visible and preserves input', p.get_by_label('Your name', exact=True).input_value()=='Failure QA')
 statuses = [ctx.request.post(BASE+'/api/city-requests',data={},headers={'x-forwarded-for':'192.0.2.42'}).status for _ in range(11)]
 check('rate limit rejects eleventh request', statuses==[400]*10+[429])
 p.screenshot(path=str(ROOT/'audit/completion/evidence/provider-failure.png'))
 browser.close()
(ROOT/'audit/completion/evidence/failure-checks.json').write_text(json.dumps({'checks':checks},indent=2))
print(f'{sum(c["pass"] for c in checks)}/{len(checks)} passed')
if not all(c['pass'] for c in checks): sys.exit(1)
