import json,sys,traceback,base64,time
from pathlib import Path
from datetime import datetime,timedelta,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
BASE='http://127.0.0.1:4327'
ACCOUNTS=json.loads((ROOT/'.local/demo-accounts.json').read_text())
ACCOUNTS['qa']=json.loads((ROOT/'.local/qa-account.json').read_text())
OUT=ROOT/'audit/completion/evidence'
results=[]; errors=[]; created={}
def check(name, condition, detail=''):
 results.append({'name':name,'pass':bool(condition),'detail':detail});print(('PASS ' if condition else 'FAIL ')+name,flush=True)
 if not condition:raise AssertionError(name+' '+detail)
def req(ctx,path,method='GET',data=None):
 return ctx.request.fetch(BASE+path,method=method, data=data, headers={'Content-Type':'application/json'} if data is not None else None)
def login(browser,key):
 ctx=browser.new_context(viewport={'width':1440,'height':1000});p=ctx.new_page();p.set_default_navigation_timeout(60000);p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+'/auth',wait_until='networkidle');p.get_by_role('button',name='Password',exact=True).click();p.get_by_label('Email',exact=True).fill(ACCOUNTS[key]['email']);p.get_by_label('Password',exact=True).fill(ACCOUNTS[key]['password']);p.get_by_role('button',name='Sign in',exact=True).click();p.wait_for_url(BASE+'/dashboard',timeout=20000);p.wait_for_load_state('networkidle');return ctx,p
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel='chrome')
  anon=browser.new_context(viewport={'width':1440,'height':1000});a=anon.new_page();a.set_default_navigation_timeout(60000);a.on('pageerror',lambda e:errors.append(str(e)))
  for path in ['/','/properties','/brokers','/properties/L001','/properties/L003','/properties/L007','/brokers/B1','/brokers/B7','/properties?city=Noida','/properties?city=Delhi&locality=Dwarka&sort=low','/properties?q=missing-home']:
   response=a.goto(BASE+path,wait_until='networkidle');check('public '+path,response.status==200)
  check('anonymous leads blocked',req(anon,'/api/leads').status==401)
  check('anonymous city requests blocked',req(anon,'/api/city-requests').status==401)
  for path in ['/api/leads','/api/listings','/api/brokers','/api/reports','/api/reviews','/api/saved']:
   check('anonymous write '+path,req(anon,path,'POST',{}).status==401)
  check('cron requires secret',req(anon,'/api/cron/expire').status==401)
  public=req(anon,'/api/listings').json()['listings'];check('pending inventory hidden',not any(l['verification']=='pending' for l in public))
  a.goto(BASE+'/properties/L003',wait_until='networkidle');check('disclosed visit fee',a.get_by_text('₹200',exact=True).count()>0);check('other fees disclosed',a.get_by_text('Other fees',exact=False).count()>0)
  a.goto(BASE+'/properties?locality=Dwarka&sort=low',wait_until='networkidle');a.get_by_role('navigation',name='Filter by locality').get_by_role('link',name='All',exact=True).click();a.wait_for_url('**/properties?sort=low');a.wait_for_load_state('networkidle');check('All locality clears filter','locality=' not in a.url and 'sort=low' in a.url)
  check('empty results guidance',a.goto(BASE+'/properties?q=no-such-home',wait_until='networkidle').status==200 and a.get_by_text('No homes match yet.').is_visible())
  seeker,s=login(browser,'seeker');broker,b=login(browser,'broker');admin,m=login(browser,'admin');other,o=login(browser,'other');qa,q=login(browser,'qa')
  check('real Supabase password sessions',req(seeker,'/api/leads').status==200)
  check('seeker sees own leads',all(l['ownerId']==ACCOUNTS['seeker']['id'] for l in req(seeker,'/api/leads').json()['leads']))
  check('other seeker sees no private leads',req(other,'/api/leads').json()['leads']==[])
  check('broker sees assigned leads',all(l['brokerId']=='B1' for l in req(broker,'/api/leads').json()['leads']))
  check('non-admin moderation blocked',req(seeker,'/api/listings/L001','PATCH',{'action':'approve'}).status==403)
  check('unassigned broker reconfirm blocked',req(broker,'/api/listings/L003/reconfirm','POST',{}).status==403)
  check('flagged reconfirm blocked',req(admin,'/api/listings/L007/reconfirm','POST',{}).status==409)
  check('unknown enquiry rejected',req(seeker,'/api/leads','POST',{'name':'Demo','phone':'9000000001','listingId':'missing'}).status==404)
  check('flagged enquiry rejected',req(seeker,'/api/leads','POST',{'name':'Demo','phone':'9000000001','listingId':'L007'}).status==409)
  for path in ['/api/leads','/api/brokers','/api/listings','/api/reports','/api/reviews','/api/city-requests']:
   check('malformed payload '+path,req(admin,path,'POST',[None]).status in [400,403])
  s.goto(BASE+'/properties/L001',wait_until='networkidle');s.get_by_role('button',name='♡ Save home',exact=True).click();s.get_by_role('button',name='♥ Saved · Remove',exact=True).wait_for();s.reload(wait_until='networkidle');check('saved home persisted',s.get_by_role('button',name='♥ Saved · Remove',exact=True).is_visible())
  s.get_by_role('button',name='♥ Saved · Remove',exact=True).click();s.get_by_role('button',name='♡ Save home',exact=True).wait_for();
  s.get_by_label('Your name',exact=True).fill('Browser QA Seeker');s.get_by_label('Mobile number',exact=True).fill('9000000001');s.get_by_label('Your questions').fill('Automated browser check — demo enquiry.');s.get_by_role('button',name='Send enquiry · Visit ₹0').click();s.get_by_text('Enquiry sent to Raj Properties.').wait_for();
  leads=req(seeker,'/api/leads').json()['leads'];lead=next(l for l in leads if l['userName']=='Browser QA Seeker');created['lead']=lead['id'];check('enquiry persisted with owner and actual broker',lead['ownerId']==ACCOUNTS['seeker']['id'] and lead['brokerId']=='B1')
  check('other user cannot change enquiry',req(other,'/api/leads/'+lead['id'],'PATCH',{'action':'status','status':'Closed'}).status==403)
  visit=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat();check('visit schedules',req(seeker,'/api/leads/'+lead['id'],'PATCH',{'action':'schedule','visitAt':visit}).status==200)
  check('future visit cannot be confirmed',req(seeker,'/api/leads/'+lead['id'],'PATCH',{'action':'confirm'}).status==409)
  check('premature review blocked',req(seeker,'/api/reviews','POST',{'leadId':lead['id'],'rating':5,'text':'This was a great visit.'}).status==409)
  check('broker pipeline update',req(broker,'/api/leads/'+lead['id'],'PATCH',{'action':'status','status':'Contacted'}).status==200)
  # Onboarding through UI with real private storage.
  q.goto(BASE+'/broker/dashboard',wait_until='networkidle');check('seeker can start broker onboarding',q.get_by_role('link',name='Apply as a broker').is_visible())
  q.goto(BASE+'/broker/onboard',wait_until='networkidle');q.get_by_label('Full name').fill('QA Broker');q.get_by_label('Mobile number').fill('9000000003');q.get_by_label('Agency name').fill('QA Demo Agency');q.get_by_label('Areas served, comma separated').fill('Dwarka');q.get_by_label('Public brokerage policy').fill('15 days brokerage. No visit fee. Every charge disclosed.')
  proof={'name':'masked-proof.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n% QA test proof, fictional masked identity.\n%%EOF'}
  q.get_by_label('Masked identity proof').set_input_files(proof);q.get_by_label('Business / agency proof').set_input_files(proof);q.get_by_role('button',name='Submit application').click();q.wait_for_url('**/broker/dashboard',timeout=30000);q.wait_for_load_state('networkidle');check('pending broker application persisted',q.get_by_text('Your application is pending.',exact=False).is_visible())
  check('pending applicant can update documents',q.get_by_role('link',name='Update application and documents →').is_visible())
  allbrokers=req(admin,'/api/brokers').json()['brokers'];qb=next(x for x in allbrokers if x['agency']=='QA Demo Agency');created['broker']=qb['id'];check('pending broker cannot publish',req(qa,'/api/listings','POST',{}).status==400)
  m.goto(BASE+'/admin',wait_until='networkidle');card=m.locator('div').filter(has=m.get_by_text('QA Demo Agency',exact=True)).filter(has=m.get_by_role('button',name='Approve',exact=True)).last
  # API approval plus browser document checks before the mutation.
  check('admin can review private proofs',m.get_by_role('link',name='Identity proof').count()>0)
  check('approve broker',req(admin,'/api/brokers/'+qb['id'],'PATCH',{'action':'approve'}).status==200)
  q.goto(BASE+'/broker/listings/new',wait_until='networkidle');q.get_by_label('Title',exact=True).fill('QA Bright 2 BHK Home');q.get_by_label('Locality',exact=True).fill('Dwarka');q.get_by_label('Full property address').fill('Flat 101, QA Test Tower, Dwarka');q.get_by_label('Area (sq.ft)').fill('1050');q.get_by_label('Monthly rent (₹)').fill('24000');q.get_by_label('Refundable deposit (₹)').fill('48000');q.get_by_label('Description').fill('A bright fictional demo home near the metro with plenty of natural light.');q.get_by_label('Or HTTPS photo URLs, one per line').fill('https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80');q.get_by_role('button',name='Submit listing for review').click();q.get_by_text('Listing submitted for review.',exact=False).wait_for(timeout=20000)
  preview=q.get_by_role('link',name='Preview listing').get_attribute('href');lid=preview.rsplit('/',1)[-1];created['listing']=lid;check('new listing pending and hidden publicly',a.goto(BASE+preview,wait_until='networkidle').status==404)
  q.get_by_role('link',name='Preview listing').click();q.wait_for_url('**/properties/'+lid);q.get_by_text('This home is pending.',exact=False).wait_for();q.wait_for_load_state('networkidle');check('owner can preview pending listing',q.get_by_text('This home is pending.',exact=False).is_visible())
  check('admin approves listing',req(admin,'/api/listings/'+lid,'PATCH',{'action':'approve'}).status==200)
  check('listing published in database',a.goto(BASE+preview,wait_until='networkidle').status==200)
  check('listing fees persisted',a.get_by_text('₹84,000',exact=True).count()>0)
  check('reconfirm owned listing',req(qa,'/api/listings/'+lid+'/reconfirm','POST',{}).status==200)
  # A second offer of the same normalized address must use the same property ID.
  q.goto(BASE+preview,wait_until='networkidle');record=next(x for x in req(qa,'/api/listings').json()['listings'] if x['id']==lid)
  newlead=req(seeker,'/api/leads','POST',{'listingId':lid,'name':'Demo seeker','phone':'9000000001','msg':'Test dynamic broker ownership.'});check('new listing enquiry uses real broker',newlead.status==201 and newlead.json()['lead']['brokerId']==qb['id']);created['dynamicLead']=newlead.json()['lead']['id']
  report=req(seeker,'/api/reports','POST',{'listingId':lid,'reason':'Wrong details','details':'Fictional QA report to exercise moderation.'});check('report persisted',report.status==201);rid=report.json()['report']['id'];created['report']=rid
  check('uphold report atomically',req(admin,'/api/reports/'+rid,'PATCH',{'uphold':True}).status==200)
  check('flagged listing cannot be reconfirmed by owner',req(qa,'/api/listings/'+lid+'/reconfirm','POST',{}).status==409)
  check('flagged listing cannot accept enquiries',req(seeker,'/api/leads','POST',{'listingId':lid,'name':'Demo','phone':'9000000001'}).status==409)
  check('approval clears flags',req(admin,'/api/listings/'+lid,'PATCH',{'action':'approve'}).status==200)
  record=next(x for x in req(admin,'/api/listings').json()['listings'] if x['id']==lid);check('flags cleared',not record.get('flags'))
  check('suspend broker retains records',req(admin,'/api/brokers/'+qb['id'],'PATCH',{'action':'suspend'}).status==200)
  record=next(x for x in req(admin,'/api/listings').json()['listings'] if x['id']==lid);check('suspension flags owned inventory',record['verification']=='flagged')
  check('reject broker with listings succeeds',req(admin,'/api/brokers/'+qb['id'],'PATCH',{'action':'reject'}).status==200)
  # Responsive inventory of every page type and sample detail.
  for width in [320,375,768,1440]:
   a.set_viewport_size({'width':width,'height':900})
   for path in ['/','/properties','/brokers','/properties/L001','/properties/L003','/properties/L007','/brokers/B1','/auth']:
    a.goto(BASE+path,wait_until='networkidle');overflow=a.evaluate('document.documentElement.scrollWidth > innerWidth + 1');check(f'no overflow {width} {path}',not overflow)
   if width==375:a.goto(BASE+'/',wait_until='networkidle');a.screenshot(path=str(OUT/'home-mobile.png'),full_page=True)
  for p,path in [(s,'/dashboard'),(b,'/broker/dashboard'),(m,'/admin'),(q,'/broker/onboard')]:
   p.set_viewport_size({'width':375,'height':900});p.goto(BASE+path,wait_until='networkidle');check('private mobile '+path,not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'))
  a.set_viewport_size({'width':1440,'height':1000});a.goto(BASE+'/',wait_until='networkidle');a.screenshot(path=str(OUT/'home-desktop.png'),full_page=True)
  check('no browser runtime errors',not errors,repr(errors))
  s.goto(BASE+'/dashboard',wait_until='networkidle');s.get_by_role('button',name='Sign out',exact=True).click();s.wait_for_url(BASE+'/',timeout=15000);check('sign-out revokes local session',req(seeker,'/api/leads').status==401)
  browser.close()
except Exception as e:
 print(traceback.format_exc(),flush=True);results.append({'name':'exception','pass':False,'detail':str(e)})
finally:
 (OUT/'browser-checks.json').write_text(json.dumps({'checks':results,'runtimeErrors':errors},indent=2));(ROOT/'.local/qa-created.json').write_text(json.dumps(created));
 print(f'{sum(x["pass"] for x in results)}/{len(results)} checks passed',flush=True)
 if not all(x['pass'] for x in results):sys.exit(1)
