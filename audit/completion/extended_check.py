import sys,json,base64,subprocess,traceback
from pathlib import Path
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'audit/completion'))
BASE='http://127.0.0.1:4327';OUT=ROOT/'audit/completion/evidence';A=json.loads((ROOT/'.local/demo-accounts.json').read_text());QA=json.loads((ROOT/'.local/qa-account.json').read_text());CREATED=json.loads((ROOT/'.local/qa-created.json').read_text());checks=[];errors=[]
def check(n,v,d=''):
 checks.append({'name':n,'pass':bool(v),'detail':d});print(('PASS ' if v else 'FAIL ')+n,flush=True)
 if not v:raise AssertionError(n+' '+d)
def node(code,args=[]):
 r=subprocess.run(['node','--env-file=.env','--input-type=module','-e',code,*args],cwd=ROOT,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return json.loads(r.stdout) if r.stdout else None
def req(ctx,p,method='GET',data=None):return ctx.request.fetch(BASE+p,method=method,data=data,headers={'Content-Type':'application/json'} if data is not None else None)
def login(browser,account):
 ctx=browser.new_context(viewport={'width':1440,'height':1000});p=ctx.new_page();p.set_default_navigation_timeout(60000);p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'/auth',wait_until='networkidle');p.get_by_role('button',name='Password',exact=True).click();p.get_by_label('Email',exact=True).fill(account['email']);p.get_by_label('Password',exact=True).fill(account['password']);p.get_by_role('button',name='Sign in',exact=True).click();p.wait_for_url(BASE+'/dashboard');p.wait_for_load_state('networkidle');return ctx,p
SDK="import {createClient} from '@supabase/supabase-js';const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});"
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel='chrome');seeker,s=login(browser,A['seeker']);broker,b=login(browser,A['broker']);admin,m=login(browser,A['admin']);qa,q=login(browser,QA)
  # Simulate the passage of time only on the isolated QA enquiry.
  lead=CREATED['lead'];node(SDK+"await db.from('reviews').delete().eq('lead_id',process.argv[1]);const r=await db.from('leads').update({visit_at:new Date(Date.now()-60000).toISOString(),status:'Visit Scheduled',seeker_visited:false,broker_visited:false}).eq('id',process.argv[1]);if(r.error)throw r.error;",[lead])
  s.goto(BASE+'/dashboard',wait_until='networkidle');card=s.locator('article').filter(has_text='Automated browser check — demo enquiry.');card.get_by_role('button',name='Confirm I visited').click();card.get_by_text('Seeker confirmed',exact=False).wait_for();check('seeker confirms past visit',next(l for l in req(seeker,'/api/leads').json()['leads'] if l['id']==lead)['seekerVisited'])
  b.goto(BASE+'/broker/dashboard',wait_until='networkidle');card=b.locator('article').filter(has_text='Automated browser check — demo enquiry.');card.get_by_role('button',name='Confirm I visited').click();card.get_by_text('Broker confirmed',exact=False).wait_for();state=next(l for l in req(seeker,'/api/leads').json()['leads'] if l['id']==lead);check('both confirmations advance pipeline',state['seekerVisited'] and state['brokerVisited'] and state['status']=='Visited')
  s.reload(wait_until='networkidle');card=s.locator('article').filter(has_text='Automated browser check — demo enquiry.');card.get_by_text('Write a verified-visit review',exact=True).click();card.get_by_label('Your experience').fill('Clear fees and a helpful broker. This is a fictional QA review.');card.get_by_role('button',name='Publish review').click();card.get_by_text('Review published',exact=True).wait_for();check('review persists',req(seeker,'/api/reviews','POST',{'leadId':lead,'rating':5,'text':'Duplicate review must fail.'}).status==409)
  b.goto(BASE+'/brokers/B1',wait_until='networkidle');check('review appears on broker profile',b.get_by_text('Clear fees and a helpful broker. This is a fictional QA review.').is_visible())
  # Check real Supabase OTP verification without sending mail to anyone.
  otp=node(SDK+"const r=await db.auth.admin.generateLink({type:'magiclink',email:process.argv[1]});if(r.error)throw r.error;console.log(JSON.stringify({otp:r.data.properties.email_otp}));",[A['other']['email']])['otp']
  otpc=browser.new_context();o=otpc.new_page();calls=[]
  def intercept(route):calls.append(1);route.fulfill(status=200,content_type='application/json',body='{}')
  o.route('**/auth/v1/otp*',intercept)
  o.goto(BASE+'/auth?next=/dashboard',wait_until='networkidle');o.get_by_label('Email',exact=True).fill(A['other']['email']);o.get_by_role('button',name='Send sign-in email').click();o.get_by_label('Email code').wait_for();o.get_by_role('button',name='Use a different email').click();o.get_by_label('Email',exact=True).wait_for();check('different-email button does not resubmit',len(calls)==1)
  o.get_by_label('Email',exact=True).fill(A['other']['email']);o.get_by_role('button',name='Send sign-in email').click();o.get_by_label('Email code').fill(otp);o.get_by_role('button',name='Verify & sign in').click();o.wait_for_url(BASE+'/dashboard',timeout=20000);check('real Supabase OTP verifies',req(otpc,'/api/leads').status==200)
  # API authorization and privacy directly at Supabase REST.
  privacy=node("import {createClient} from '@supabase/supabase-js';const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});const out={};for(const t of ['leads','reports','city_requests','broker_applications','listing_addresses','saved_listings']){const r=await db.from(t).select('*');out[t]=r.error?'denied':r.data.length;}const r=await db.from('reviews').select('owner_id,lead_id');out.reviewPrivateDenied=!!r.error;console.log(JSON.stringify(out));")
  check('private tables protected by RLS',all(privacy[t] in ['denied',0] for t in ['leads','reports','city_requests','broker_applications','listing_addresses','saved_listings']))
  check('review account identifiers protected',privacy['reviewPrivateDenied'])
  check('cross-origin logout blocked',seeker.request.post(BASE+'/auth/signout',headers={'Origin':'https://evil.example'},max_redirects=0).status==403)
  check('GET cannot log out',req(seeker,'/auth/signout').status==405)
  s.goto(BASE+'/dashboard',wait_until='networkidle');s.get_by_role('button',name='Sign out',exact=True).click();s.wait_for_url(BASE+'/',timeout=20000);check('logout works on current hostname',req(seeker,'/api/leads').status==401)
  # Reapprove only the temporary QA broker, then upload a real image file.
  check('restore QA broker approval',req(admin,'/api/brokers/'+CREATED['broker'],'PATCH',{'action':'approve'}).status==200)
  png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXx8AAAAASUVORK5CYII=')
  photo=qa.request.post(BASE+'/api/uploads',multipart={'kind':'photo','file':{'name':'qa.png','mimeType':'image/png','buffer':png}});check('photo upload persists in Supabase Storage',photo.status==201)
  check('uploaded photo publicly loads',qa.request.get(photo.json()['url']).status==200)
  bad=qa.request.post(BASE+'/api/uploads',multipart={'kind':'photo','file':{'name':'bad.png','mimeType':'image/png','buffer':b'not a PNG'}});check('fake image rejected',bad.status==400)
  big=qa.request.post(BASE+'/api/uploads',multipart={'kind':'photo','file':{'name':'large.png','mimeType':'image/png','buffer':png+b'0'*(5242880)}});check('oversize upload rejected',big.status==400)
  payload={'title':'QA second offer','city':'Delhi','locality':'Dwarka','address':'Flat 101, QA Test Tower, Dwarka','rent':24000,'bhk':2,'deposit':48000,'brokDays':15,'visitFee':0,'otherFee':0,'area':1050,'type':'Apartment','furnishing':'Unfurnished','avail':'2026-10-06','desc':'A second fictional offer used to check address identity.','photos':[photo.json()['url']]}
  second=req(qa,'/api/listings','POST',payload);check('second offer saves',second.status==201);record=second.json()['listing'];first=next(x for x in req(admin,'/api/listings').json()['listings'] if x['id']==CREATED['listing']);check('same address shares property identity',record['propId']==first['propId'])
  # Age a QA listing and call the actual protected cron.
  check('approve QA offer',req(admin,'/api/listings/'+record['id'],'PATCH',{'action':'approve'}).status==200)
  node(SDK+"const r=await db.from('listings').update({last_confirmed_at:new Date(Date.now()-8*86400000).toISOString()}).eq('id',process.argv[1]);if(r.error)throw r.error;",[record['id']])
  state=next(x for x in req(admin,'/api/listings').json()['listings'] if x['id']==record['id']);check('timestamp aging works without cron',state['verification']=='stale' and state['hrs']>=168)
  cron=node("const r=await fetch('http://127.0.0.1:4327/api/cron/expire',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}});console.log(JSON.stringify({status:r.status,body:await r.json()}));")
  check('protected cron expires timestamp-based listing',cron['status']==200 and record['id'] in cron['body']['expired'])
  check('owner reconfirms stale listing',req(qa,'/api/listings/'+record['id']+'/reconfirm','POST',{}).status==200)
  # Form and gallery browser interaction checks.
  a=browser.new_context(viewport={'width':375,'height':900}).new_page();a.goto(BASE+'/properties/L001',wait_until='networkidle');photos=a.get_by_role('button',name='View photo',exact=False)
  if photos.count()>1:photos.nth(1).click();check('gallery switches photo',photos.nth(1).get_attribute('aria-pressed')=='true')
  a.goto(BASE+'/',wait_until='networkidle');a.get_by_label('City',exact=True).fill('QA Demo City');a.get_by_label('Your name',exact=True).fill('QA City Request');a.get_by_label('Mobile number',exact=True).fill('9000000001');a.get_by_role('button',name='Request my city').click();a.get_by_text('Your request for QA Demo City was saved. Thank you!').wait_for();check('city demand persists',any(r['name']=='QA City Request' for r in req(admin,'/api/city-requests').json()['requests']))
  a.goto(BASE+'/',wait_until='networkidle');a.screenshot(path=str(OUT/'home-mobile-top.png'));a.set_viewport_size({'width':1440,'height':1000});a.screenshot(path=str(OUT/'home-desktop-top.png'))
  a.goto(BASE+'/properties/L003',wait_until='networkidle');a.screenshot(path=str(OUT/'property-fees.png'),full_page=True)
  for width in [320,375,768,1440]:
   q.set_viewport_size({'width':width,'height':900});q.goto(BASE+'/broker/listings/new',wait_until='networkidle');check('new listing form fits '+str(width),not q.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
  check('no runtime errors during extended checks',not errors,str(errors));browser.close()
except Exception as e:
 checks.append({'name':'exception','pass':False,'detail':str(e)});print(traceback.format_exc(),flush=True)
finally:
 (OUT/'extended-checks.json').write_text(json.dumps({'checks':checks,'runtimeErrors':errors},indent=2));print(f'{sum(c["pass"] for c in checks)}/{len(checks)} passed',flush=True)
 if not all(c['pass'] for c in checks):sys.exit(1)
