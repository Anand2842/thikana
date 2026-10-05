import json,sys,traceback,subprocess,base64
from datetime import datetime,timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];BASE='http://127.0.0.1:4327';OUT=ROOT/'audit/completion/evidence';A=json.loads((ROOT/'.local/demo-accounts.json').read_text());QA=json.loads((ROOT/'.local/qa-account.json').read_text());C=json.loads((ROOT/'.local/qa-created.json').read_text());checks=[];errors=[]
def check(n,v):checks.append({'name':n,'pass':bool(v)});print(('PASS ' if v else 'FAIL ')+n,flush=True);assert v,n
def request(ctx,path,method='GET',body=None):return ctx.request.fetch(BASE+path,method=method,data=body)
def login(browser,account):
 ctx=browser.new_context(viewport={'width':1440,'height':1000});p=ctx.new_page();p.set_default_navigation_timeout(60000);p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'/auth',wait_until='networkidle');p.get_by_role('button',name='Password',exact=True).click();p.get_by_label('Email',exact=True).fill(account['email']);p.get_by_label('Password',exact=True).fill(account['password']);p.get_by_role('button',name='Sign in',exact=True).click();p.wait_for_url(BASE+'/dashboard');p.wait_for_load_state('networkidle');return ctx,p
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel='chrome');admin,m=login(browser,A['admin']);qa,q=login(browser,QA);seeker,s=login(browser,A['seeker']);alerts=[]
  def dialog(d):
   if d.type=='alert':alerts.append(d.message)
   d.accept()
  m.on('dialog',dialog)
  def broker_action(label):
   m.goto(BASE+'/admin',wait_until='networkidle');card=m.get_by_role('link',name='QA Demo Agency',exact=True).locator('..')
   with m.expect_response(lambda r:r.url.endswith('/api/brokers/'+C['broker']) and r.request.method=='PATCH') as pending:card.get_by_role('button',name=label,exact=True).click()
   check('broker button '+label,pending.value.status==200)
  for label in ['Suspend','Reject','Approve']:broker_action(label)
  def listing_action(label):
   m.goto(BASE+'/admin',wait_until='networkidle');link=m.locator('a[href="/properties/'+C['listing']+'"]');card=link.locator('..')
   with m.expect_response(lambda r:r.url.endswith('/api/listings/'+C['listing']) and r.request.method=='PATCH') as pending:card.get_by_role('button',name=label,exact=True).click()
   check('listing button '+label,pending.value.status==200)
  for label in ['Approve','Expire','Flag','Approve']:listing_action(label)
  q.goto(BASE+'/broker/dashboard',wait_until='networkidle');card=q.locator('article').filter(has_text='QA Bright 2 BHK Home')
  with q.expect_response(lambda r:r.url.endswith('/reconfirm') and r.request.method=='POST') as pending:card.get_by_role('button',name='Reconfirm now').click()
  check('reconfirm button persists availability',pending.value.status==200)
  report=request(seeker,'/api/reports','POST',{'listingId':C['listing'],'reason':'Other','details':'Fictional QA report for the dismiss control.'}).json()['report']['id']
  sdk="import {createClient} from '@supabase/supabase-js';const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const r=await db.from('reports').update({status:'Open · auto-escalated'}).eq('id',process.argv[1]);if(r.error)throw r.error;"
  r=subprocess.run(['node','--env-file=.env','--input-type=module','-e',sdk,report],cwd=ROOT,capture_output=True);assert r.returncode==0
  m.goto(BASE+'/admin',wait_until='networkidle');card=m.get_by_text(report,exact=True).locator('..')
  with m.expect_response(lambda r:r.url.endswith('/api/reports/'+report) and r.request.method=='PATCH') as pending:card.get_by_role('button',name='Dismiss',exact=True).click()
  check('dismiss accepts legacy open report states',pending.value.status==200)
  s.goto(BASE+'/properties/'+C['listing'],wait_until='networkidle');s.get_by_text('Report this listing',exact=True).click();s.get_by_label('Reason').select_option('Wrong details');s.get_by_label('Describe the issue').fill('Fictional QA report submitted using the visible form.')
  with s.expect_response(lambda r:r.url.endswith('/api/reports') and r.request.method=='POST') as pending:s.get_by_role('button',name='Submit report',exact=True).click()
  check('report form persists issue',pending.value.status==201);report=pending.value.json()['report']['id'];s.get_by_text('Report received. Our team will review it.').wait_for()
  m.goto(BASE+'/admin',wait_until='networkidle');card=m.get_by_text(report,exact=True).locator('..')
  with m.expect_response(lambda r:r.url.endswith('/api/reports/'+report) and r.request.method=='PATCH') as pending:card.get_by_role('button',name='Uphold · flag listing',exact=True).click()
  check('uphold report button flags listing',pending.value.status==200)
  listing_action('Approve')
  s.goto(BASE+'/dashboard',wait_until='networkidle');card=s.locator('article').filter(has_text='Test dynamic broker ownership.');card.get_by_text('Schedule a visit',exact=True).click();card.get_by_label('Visit date and time').fill((datetime.now()+timedelta(days=2)).strftime('%Y-%m-%dT%H:%M'))
  with s.expect_response(lambda r:r.url.endswith('/api/leads/'+C['dynamicLead']) and r.request.method=='PATCH') as pending:card.get_by_role('button',name='Save visit',exact=True).click()
  check('schedule visit button persists',pending.value.status==200);card.get_by_text('Reschedule visit',exact=True).wait_for();card.get_by_label('Visit date and time').fill((datetime.now()+timedelta(days=3)).strftime('%Y-%m-%dT%H:%M'))
  with s.expect_response(lambda r:r.url.endswith('/api/leads/'+C['dynamicLead']) and r.request.method=='PATCH') as pending:card.get_by_role('button',name='Save visit',exact=True).click()
  check('reschedule visit button persists',pending.value.status==200)
  q.goto(BASE+'/broker/dashboard',wait_until='networkidle');card=q.locator('article').filter(has_text='Test dynamic broker ownership.');check('scheduled pipeline requires an explicit next stage',not card.get_by_label('Pipeline').evaluate('e=>e.validity.valid'));card.get_by_label('Pipeline').select_option('Contacted')
  with q.expect_response(lambda r:r.url.endswith('/api/leads/'+C['dynamicLead']) and r.request.method=='PATCH') as pending:card.get_by_role('button',name='Update stage',exact=True).click()
  check('pipeline stage button persists',pending.value.status==200)
  q.goto(BASE+'/broker/listings/new',wait_until='networkidle');q.get_by_label('Title',exact=True).fill('QA Uploaded Photo Home');q.get_by_label('Locality',exact=True).fill('Dwarka');q.get_by_label('Full property address').fill('Flat 202, QA Photo Tower, Dwarka');q.get_by_label('Area (sq.ft)').fill('1000');q.get_by_label('Monthly rent (₹)').fill('24000');q.get_by_label('Description').fill('A fictional home that tests the actual photo upload form.');png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXx8AAAAASUVORK5CYII=');q.locator('input[name="files"]').set_input_files({'name':'qa-photo.png','mimeType':'image/png','buffer':png})
  with q.expect_response(lambda r:r.url.endswith('/api/listings') and r.request.method=='POST') as pending:q.get_by_role('button',name='Submit listing for review').click()
  check('listing form uploads photo and persists',pending.value.status==201);q.get_by_role('button',name='Add another home',exact=True).wait_for();q.get_by_role('button',name='Add another home',exact=True).click();check('add another home returns fresh form',q.get_by_label('Title',exact=True).input_value()=='')
  check('admin actions produced no error alerts',not alerts)
  # All user forms recover from network loss without success messages or uncaught errors.
  s.goto(BASE+'/properties/L001',wait_until='networkidle');s.route('**/api/leads',lambda r:r.abort());s.get_by_label('Your name',exact=True).fill('QA Network');s.get_by_label('Mobile number',exact=True).fill('9000000001');s.get_by_role('button',name='Send enquiry · Visit ₹0').click();s.get_by_text('Connection lost. Please try again.').wait_for();check('enquiry network error is visible',s.get_by_label('Your name',exact=True).input_value()=='QA Network');s.unroute('**/api/leads')
  s.goto(BASE+'/',wait_until='networkidle');s.route('**/api/city-requests',lambda r:r.abort());s.get_by_label('City',exact=True).fill('Demo City');s.get_by_label('Your name',exact=True).fill('QA Network');s.get_by_label('Mobile number',exact=True).fill('9000000001');s.get_by_role('button',name='Request my city').click();s.get_by_text('Connection lost. Please try again.').wait_for();check('city request network error is visible',True);s.unroute('**/api/city-requests')
  q.goto(BASE+'/broker/onboard',wait_until='networkidle');q.route('**/api/uploads',lambda r:r.abort());q.get_by_label('Full name').fill('QA Retry');q.get_by_label('Mobile number').fill('9000000001');q.get_by_label('Agency name').fill('QA Retry');q.get_by_label('Areas served, comma separated').fill('Dwarka');q.get_by_label('Public brokerage policy').fill('15 days brokerage with every fee disclosed.');proof={'name':'masked.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n%%EOF'};q.get_by_label('Masked identity proof').set_input_files(proof);q.get_by_label('Business / agency proof').set_input_files(proof);q.get_by_role('button',name='Submit application').click();q.get_by_text('Connection lost. Please try again.').wait_for();check('application upload network error is visible',True);q.unroute('**/api/uploads')
  q.goto(BASE+'/broker/listings/new',wait_until='networkidle');q.route('**/api/listings',lambda r:r.abort());q.get_by_label('Title',exact=True).fill('QA Retry Home');q.get_by_label('Locality',exact=True).fill('Dwarka');q.get_by_label('Full property address').fill('Flat 101, QA Retry Building');q.get_by_label('Area (sq.ft)').fill('1000');q.get_by_label('Monthly rent (₹)').fill('24000');q.get_by_label('Description').fill('A fictional home for testing network recovery.');q.get_by_label('Or HTTPS photo URLs, one per line').fill('https://example.com/photo.jpg');q.get_by_role('button',name='Submit listing for review').click();q.get_by_text('Connection lost. Please try again.').wait_for();check('listing network error preserves input',q.get_by_label('Title',exact=True).input_value()=='QA Retry Home');q.unroute('**/api/listings')
  # Labels, native validation, keyboard focus and reduced motion.
  q.set_viewport_size({'width':320,'height':900});check('listing failure state fits mobile',not q.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
  s.goto(BASE+'/auth',wait_until='networkidle');s.locator('body').press('Tab');check('visible keyboard focus',s.evaluate("getComputedStyle(document.activeElement).outlineStyle!='none'"))
  s.emulate_media(reduced_motion='reduce');s.goto(BASE+'/properties',wait_until='networkidle');check('reduced motion respected',s.locator('main a.card-hover').first.evaluate("e=>getComputedStyle(e).transitionDuration")=='0s')
  check('no runtime errors',not errors);browser.close()
except Exception as e:checks.append({'name':'exception','pass':False,'detail':str(e)});print(traceback.format_exc(),flush=True)
finally:
 (OUT/'control-checks.json').write_text(json.dumps({'checks':checks,'runtimeErrors':errors},indent=2));print(f'{sum(x["pass"] for x in checks)}/{len(checks)} passed',flush=True)
 if not all(c['pass'] for c in checks):sys.exit(1)
