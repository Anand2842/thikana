import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:4337';OUT=ROOT/'audit/completion/evidence';accounts=json.loads((ROOT/'.local/demo-accounts.json').read_text());results=[];errors=[]
def check(n,v,d=''):results.append({'name':n,'pass':bool(v),'detail':d});print(('PASS ' if v else 'FAIL ')+n,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,channel='chrome');context=browser.new_context(viewport={'width':1440,'height':1000});p=context.new_page();p.set_default_navigation_timeout(60000);p.on('pageerror',lambda e:errors.append(str(e)))
 catalog=context.request.get(BASE+'/api/listings').json()['listings'];brokers=context.request.get(BASE+'/api/brokers').json()['brokers']
 paths=['/','/properties','/brokers','/auth','/properties?q=not-a-home','/robots.txt','/sitemap.xml']+[f"/properties/{l['id']}" for l in catalog]+[f"/brokers/{b['id']}" for b in brokers]
 for city in ['Delhi','Gurugram','Noida','Greater Noida','Ghaziabad']:
  paths.extend(['/properties?city='+city,'/brokers?city='+city])
 for l in catalog:
  if l['verification']=='verified':paths.append('/properties?city='+l['city']+'&locality='+l['locality']+'&sort=low')
 for path in dict.fromkeys(paths):
  r=p.goto(BASE+path,wait_until='networkidle');check('production route '+path,r.status==200,str(r.status))
  if 'xml' not in path and 'txt' not in path:check('no error boundary '+path,p.get_by_text('We couldn’t load this page.').count()==0)
 # Follow every actual internal link on every public page.
 hrefs=set()
 for path in ['/','/properties','/brokers','/properties/L001','/brokers/B1']:
  p.goto(BASE+path,wait_until='networkidle');hrefs.update(p.locator('a[href]').evaluate_all('(as)=>as.map(a=>a.getAttribute("href")).filter(h=>h.startsWith("/")&&!h.startsWith("//"))'))
 for href in sorted(hrefs):
  r=context.request.get(BASE+href);check('internal link '+href,r.status==200,str(r.status))
 for width in [320,375,768,1440]:
  p.set_viewport_size({'width':width,'height':900})
  for path in ['/','/properties','/brokers','/properties/L001','/properties/L003','/brokers/B1','/auth']:
   p.goto(BASE+path,wait_until='networkidle');check('production layout '+str(width)+' '+path,not p.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
 p.goto(BASE+'/auth',wait_until='networkidle');p.get_by_role('button',name='Password',exact=True).click();p.get_by_label('Email',exact=True).fill(accounts['admin']['email']);p.get_by_label('Password',exact=True).fill(accounts['admin']['password']);p.get_by_role('button',name='Sign in',exact=True).click();p.wait_for_url(BASE+'/dashboard');
 for path in ['/admin','/dashboard','/broker/dashboard','/broker/dashboard?broker=B1','/broker/onboard','/properties/L010']:
  r=p.goto(BASE+path,wait_until='networkidle');check('production authenticated '+path,r.status==200 and not p.get_by_text('We couldn’t load this page.').count())
  for width in [320,768]:p.set_viewport_size({'width':width,'height':900});check('private layout '+str(width)+' '+path,not p.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
  if path!='/properties/L010':check('private pages use noindex '+path,'noindex' in (p.locator('meta[name="robots"]').get_attribute('content') or ''))
 for path in ['/properties/not-a-real-home','/brokers/not-a-real-broker','/not-a-route']:
  r=p.goto(BASE+path,wait_until='networkidle');check('unknown route returns 404 '+path,r.status==404)
 sitemap=context.request.get(BASE+'/sitemap.xml').text();check('sitemap excludes private routes',not any(x in sitemap for x in ['/admin','/dashboard','/broker/']))
 for listing in catalog:
  active=listing['verification']=='verified' and next(b for b in brokers if b['id']==listing['brokerId'])['verified']=='verified'
  check('sitemap matches listing availability '+listing['id'],('/properties/'+listing['id']+'</loc>') in sitemap if active else ('/properties/'+listing['id']+'</loc>') not in sitemap)
 preview=browser.new_context(viewport={'width':1440,'height':1000});p=preview.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'/',wait_until='networkidle');p.screenshot(path=str(OUT/'final-home-desktop.png'));p.set_viewport_size({'width':375,'height':900});p.screenshot(path=str(OUT/'final-home-mobile.png'))
 check('production runtime errors',not errors,str(errors));browser.close()
(OUT/'production-checks.json').write_text(json.dumps({'base':BASE,'checks':results,'runtimeErrors':errors},indent=2));print(f'{sum(x["pass"] for x in results)}/{len(results)} passed',flush=True)
if not all(x['pass'] for x in results):sys.exit(1)
