"""Exercise the unchanged application against fake_supabase.py on localhost."""
import json
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright
from fake_supabase import session

BASE = 'http://localhost:4317'
DB = 'http://127.0.0.1:4318'
OUT = Path(__file__).parent / 'evidence'
checks = []
errors = []

def record(name, expected, actual, passed):
    row = {'check':name,'expected':expected,'actual':actual,'passed':bool(passed)}
    checks.append(row)
    (OUT/'flows.json').write_text(json.dumps({'checks':checks,'page_errors':errors},indent=2))
    print(('PASS ' if passed else 'FAIL ') + name + ' ' + json.dumps(actual), flush=True)

def login(ctx, role, broker='B1'):
    ctx.clear_cookies()
    value = 'base64-' + base64.urlsafe_b64encode(json.dumps(session(role,broker)).encode()).decode().rstrip('=')
    ctx.add_cookies([{'name':'sb-127-auth-token','value':value,'domain':'localhost','path':'/'}])

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    ctx = browser.new_context(viewport={'width':1440,'height':1000})
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    def mode(value='working', reset=False):
        return ctx.request.post(DB+'/__audit', data={'mode':value,'reset':reset}).json()
    def api(method, path, data=None, headers=None):
        response = ctx.request.fetch(BASE+path,method=method,data=data,headers=headers or {},timeout=15000,max_redirects=0)
        try:
            body=response.json()
        except Exception:
            body={'error':'non-JSON response'}
        return response.status,body

    mode(reset=True)
    for path,key in [('/api/leads','leads'),('/api/city-requests','requests')]:
        status,body=api('GET',path)
        record('Anonymous read '+path,'401/403',{'status':status,'records':len(body.get(key,[])),'contains_phone':any('phone' in x for x in body.get(key,[]))},status in (401,403))
    page.goto(BASE+'/dashboard',wait_until='networkidle')
    record('Anonymous dashboard','sign-in redirect',{'url':page.url,'all_leads':page.get_by_text('All leads (shared pipeline)',exact=True).count()},'/auth' in page.url)
    page.get_by_role('link',name='Sign in',exact=True).click()
    page.wait_for_load_state('networkidle')
    record('Sign in navbar action','opens auth form',{'url':page.url,'email_fields':page.locator('input[type=email]').count()},'/auth' in page.url)
    for path in ('/admin','/broker/dashboard','/broker/onboard','/broker/listings/new'):
        page.goto(BASE+path,wait_until='networkidle')
        record('Anonymous route gate '+path,'/auth?next=…',page.url,'/auth?next=' in page.url)
    for path in ('/api/brokers/B7','/api/listings/L010','/api/reports/RP-331'):
        status,_=api('PATCH',path,{'action':'approve','uphold':True})
        record('Anonymous moderation '+path,401,status,status==401)
    status,body=api('POST','/api/listings/L007/reconfirm')
    record('Anonymous reconfirm flagged listing','401/403; retain flagged',{'status':status,'verification':body.get('listing',{}).get('verification')},status in (401,403))
    mode(reset=True)
    login(ctx,'broker','B1')
    status,body=api('POST','/api/listings/L007/reconfirm')
    record('Broker reconfirm someone else’s flagged listing','403; retain flagged',{'status':status,'verification':body.get('listing',{}).get('verification')},status==403)
    ctx.clear_cookies()
    payload={'title':'Audit test home','city':'Noida','locality':'Sector 137','rent':24000,'bhk':2,'brokerId':'B2'}
    status,body=api('POST','/api/listings',payload)
    new_id=body.get('listing',{}).get('id')
    record('Anonymous create listing as B2','401/403',{'status':status,'id_created':bool(new_id)},status in (401,403))
    if new_id:
        status,body=api('POST','/api/leads',{'name':'Audit Seeker','phone':'9876543210','listingId':new_id})
        record('Lead to newly created B2 listing','brokerId B2',{'status':status,'brokerId':body.get('lead',{}).get('brokerId')},body.get('lead',{}).get('brokerId')=='B2')
        record('New lead has user ownership','user id persisted',{'lead_keys':list(body.get('lead',{}))},'userId' in body.get('lead',{}))
    broker_payload={'name':'Audit Broker','agency':'Audit Agency','phone':'9876543210','city':'Delhi','areas':['Dwarka']}
    status,body=api('POST','/api/brokers',broker_payload)
    record('Broker registration retains phone','phone saved',{'status':status,'phone_present':'phone' in body.get('broker',{})},'phone' in body.get('broker',{}))
    invalids=[('POST','/api/leads',{'name':123,'phone':'9876543210','listingId':'L001'}),('POST','/api/leads',{'name':'Audit','phone':123,'listingId':'L001'}),('POST','/api/city-requests',{'name':123,'city':'Jaipur','phone':'9876543210'}),('POST','/api/brokers',None),('POST','/api/listings',None)]
    for i,(method,path,body) in enumerate(invalids):
        status,_=api(method,path,'null' if body is None else body,{'Content-Type':'application/json','x-forwarded-for':f'198.51.100.{i+1}'})
        record('Malformed value '+path+' '+str(i),'400',status,status==400)
    mode('failing')
    for path,data,key in [('/api/leads',{'name':'Audit Seeker','phone':'9876543210','listingId':'L001'},'lead'),('/api/brokers',broker_payload,'broker'),('/api/listings',payload,'listing'),('/api/city-requests',{'name':'Audit Seeker','phone':'9876543210','city':'Jaipur'},'request')]:
        before=mode('failing')['counts']
        status,body=api('POST',path,data,{'x-forwarded-for':'198.51.100.100'})
        after=mode('failing')['counts']
        record('Database unavailable '+path,'5xx; no success message',{'status':status,'source':body.get('source'),'persisted':before!=after,'returned_id':body.get(key,{}).get('id')},status>=500)
    status,body=api('POST','/api/listings/L013/reconfirm')
    record('Reconfirm with database unavailable','5xx',{'status':status,'source':body.get('source')},status>=500)
    mode(reset=True)

    # Controls on rendered pages; submission is to the isolated local backend.
    page.goto(BASE+'/properties?city=Delhi&locality=Dwarka',wait_until='networkidle')
    page.locator('main').get_by_role('link',name='All',exact=True).click()
    page.wait_for_load_state('networkidle')
    record('Locality All clears filter','no locality query',page.url,'locality=' not in page.url)
    for label,descending in [('Price ↑',False),('Price ↓',True)]:
        page.goto(BASE+'/properties',wait_until='networkidle')
        page.get_by_role('link',name=label,exact=True).click();page.wait_for_load_state('networkidle')
        rents=page.locator('main a[href^="/properties/L"] .font-black').all_text_contents()
        amounts=[int(x.split('/')[0].replace('₹','').replace(',','')) for x in rents]
        record('Sort '+label,'ordered prices',amounts,amounts==sorted(amounts,reverse=descending))
    page.goto(BASE+'/properties?city=Delhi&locality=NoMatches',wait_until='networkidle')
    record('Zero-result guidance','help and clear-filter action',{'text':page.locator('main').inner_text()[-200:],'clear_controls':page.get_by_role('link',name='Clear filters').count()},page.get_by_role('link',name='Clear filters').count()>0)
    page.goto(BASE+'/properties/L003',wait_until='networkidle')
    record('Enquiry button matches visit fee','Visit ₹200',page.get_by_role('button',name='Send enquiry').inner_text(),'₹200' in page.get_by_role('button',name='Send enquiry').inner_text())
    page.get_by_role('button',name='Send enquiry').click()
    page.get_by_text('Name must be at least 2 characters.',exact=False).wait_for()
    record('Contact form blank validation','name and phone errors',page.locator('form').last.inner_text(),'Name must be' in page.locator('form').last.inner_text())
    page.get_by_placeholder('Your name',exact=True).fill('Audit Seeker')
    page.get_by_placeholder('10-digit mobile',exact=True).fill('9876543210')
    page.get_by_role('button',name='Send enquiry').click()
    page.get_by_text('Enquiry',exact=False).filter(has_text='sent to').wait_for()
    record('Contact form submit','success after local write','success',True)
    page.goto(BASE+'/',wait_until='networkidle')
    page.get_by_role('button',name='Notify me at launch').click()
    page.get_by_text('Tell us which city you want.',exact=False).wait_for()
    record('City form blank validation','validation message','shown',True)
    page.get_by_placeholder('Which city? e.g. Jaipur').fill('Delhi')
    page.get_by_placeholder('Your name',exact=True).fill('Audit Seeker')
    page.get_by_placeholder('10-digit mobile',exact=True).fill('9876543210')
    page.get_by_role('button',name='Notify me at launch').click()
    page.get_by_text("We're already live there",exact=False).wait_for()
    record('Existing city validation','already live message','shown',True)
    page.get_by_placeholder('Which city? e.g. Jaipur').fill('Jaipur')
    page.get_by_role('button',name='Notify me at launch').click()
    page.get_by_text('Noted!',exact=False).wait_for()
    record('City request submit','persist and clear fields',page.get_by_placeholder('Which city? e.g. Jaipur').input_value(),page.get_by_placeholder('Which city? e.g. Jaipur').input_value()=='')

    login(ctx,'broker')
    page.goto(BASE+'/broker/onboard',wait_until='networkidle')
    page.get_by_role('button',name='Continue').click()
    record('Onboarding step 1 validation','validation message',page.locator('main').inner_text()[-100:],'Enter your full name' in page.locator('main').inner_text())
    page.get_by_placeholder('Full name').fill('Audit Broker')
    page.get_by_placeholder('10-digit mobile (OTP in Phase 2)').fill('9876543210')
    page.get_by_role('button',name='Continue').click()
    page.get_by_role('button',name='Continue').click()
    record('Onboarding step 2 validation','agency error',page.locator('main').inner_text()[-100:],'Enter your agency name' in page.locator('main').inner_text())
    page.get_by_placeholder('Agency name').fill('Audit Agency')
    page.locator('main select').select_option('Noida')
    page.get_by_placeholder('Areas, comma separated').fill('Sector 137, Sector 62')
    page.get_by_role('button',name='Continue').click()
    page.get_by_role('button',name='Back').click()
    record('Onboarding back retains inputs','Audit Agency',page.get_by_placeholder('Agency name').input_value(),page.get_by_placeholder('Agency name').input_value()=='Audit Agency')
    page.get_by_role('button',name='Continue').click()
    page.get_by_role('button',name='Submit for review').click()
    page.get_by_text('Application',exact=False).filter(has_text='received').wait_for()
    record('Onboarding submit','local application created','success',True)
    page.goto(BASE+'/broker/listings/new',wait_until='networkidle')
    page.get_by_placeholder('Rent',exact=True).fill('-1')
    page.get_by_role('button',name='Submit listing').click()
    page.get_by_text('rent must be a positive number.',exact=False).wait_for()
    record('New listing validation','positive rent required','shown',True)
    page.get_by_placeholder('Rent',exact=True).fill('21000')
    page.get_by_role('button',name='Submit listing').click()
    page.get_by_text('Listing',exact=False).filter(has_text='created as pending').wait_for()
    record('New listing submit','photo and fee fields present',{'success':True,'photo_upload':page.locator('input[type=file]').count(),'fee_fields':page.get_by_placeholder('Brokerage',exact=True).count()},False)
    page.goto(BASE+'/broker/dashboard',wait_until='networkidle')
    page.get_by_role('button',name='Reconfirm now').first.click()
    page.get_by_text('reconfirmed — ranking restored.',exact=False).wait_for()
    record('Reconfirm own listing button','updates freshness','success',True)
    page.get_by_role('link',name='Saket Homes',exact=True).click();page.wait_for_load_state('networkidle')
    record('Broker session cannot switch to another broker','Raj Properties',page.locator('main').inner_text()[:70],'Raj Properties' in page.locator('main').inner_text()[:70])

    # Every moderation action; dialog cancellation and auth denial included.
    mode(reset=True)
    login(ctx,'admin')
    dialogs=[]
    def accept(dialog):
        dialogs.append({'type':dialog.type,'message':dialog.message})
        dialog.accept()
    page.on('dialog',accept)
    for title,names in [('Broker approvals',['Suspend','Reject','Approve']),('Flagged listings',['Expire','Flag','Approve']),('Pending listings',['Expire','Flag','Approve'])]:
        for name in names:
            mode(reset=True)
            page.goto(BASE+'/admin',wait_until='networkidle')
            heading=page.get_by_role('heading',name=title,exact=False)
            section=heading.locator('xpath=following-sibling::div[1]')
            button=section.get_by_role('button',name=name,exact=True).first
            before=mode()['events']
            button.click();page.wait_for_timeout(350);page.wait_for_load_state('networkidle')
            after=mode()['events']
            record('Admin '+title+' '+name,'local write succeeds',{'writes':len(after)-len(before),'alerts':[x['message'] for x in dialogs if x['type']=='alert']},len(after)>len(before))
            dialogs.clear()
    for name in ('Uphold · flag listing','Dismiss'):
        mode(reset=True);page.goto(BASE+'/admin',wait_until='networkidle')
        before=mode()['events']
        page.get_by_role('button',name=name,exact=True).first.click();page.wait_for_timeout(350);page.wait_for_load_state('networkidle')
        after=mode()['events']
        record('Admin report '+name,'local write',{'writes':len(after)-len(before)},len(after)>len(before))
    login(ctx,'seeker')
    for path in ('/api/brokers/B7','/api/listings/L010','/api/reports/RP-331'):
        status,_=api('PATCH',path,{'action':'approve','uphold':True})
        record('Seeker moderation '+path,403,status,status==403)

    # Passwordless sign-in through a local Auth service, then actual form logout.
    ctx.clear_cookies();page.goto(BASE+'/auth',wait_until='networkidle')
    page.get_by_placeholder('you@example.com').fill('audit@example.test')
    page.get_by_role('button',name='Send code').click()
    page.get_by_placeholder('6-digit code').wait_for()
    page.get_by_role('button',name='Use a different email').click()
    page.wait_for_timeout(500)
    record('Use a different email','email form remains visible',page.locator('main').inner_text(),page.get_by_placeholder('you@example.com').count()==1)
    page.goto(BASE+'/auth',wait_until='networkidle')
    page.get_by_placeholder('you@example.com').fill('audit@example.test')
    page.get_by_role('button',name='Send code').click()
    page.get_by_placeholder('6-digit code').fill('000000')
    page.get_by_role('button',name='Verify & sign in').click()
    page.get_by_text('Invalid OTP',exact=True).wait_for()
    record('Invalid OTP feedback','error shown','shown',True)
    page.get_by_placeholder('6-digit code').fill('123456')
    page.get_by_role('button',name='Verify & sign in').click()
    page.wait_for_url('**/dashboard');page.wait_for_load_state('networkidle')
    record('OTP verification','dashboard and session cookie',{'url':page.url,'session_cookie':any(c['name']=='sb-127-auth-token' for c in ctx.cookies())},True)
    with page.expect_response(lambda r:r.url==BASE+'/' and r.request.method=='POST') as signout_response:
        page.get_by_role('button',name='Sign out',exact=True).click()
    page.wait_for_load_state('networkidle')
    record('POST sign out lands on home','GET / 200',{'status':signout_response.value.status,'method':signout_response.value.request.method,'url':page.url},signout_response.value.status==200)

    # Transport failures must release the submit button and explain retry.
    ctx.clear_cookies();page.goto(BASE+'/auth',wait_until='networkidle')
    page.route('**/auth/v1/otp*',lambda route:route.abort())
    page.get_by_placeholder('you@example.com').fill('audit@example.test')
    page.get_by_role('button',name='Send code').click();page.wait_for_timeout(500)
    record('Auth network failure','retry button enabled',{'buttons':page.locator('main button').all_text_contents(),'disabled':page.locator('main button').first.is_disabled()},not page.locator('main button').first.is_disabled())
    page.unroute('**/auth/v1/otp*')
    page.goto(BASE+'/properties/L001',wait_until='networkidle')
    page.route('**/api/leads',lambda route:route.abort())
    page.get_by_placeholder('Your name',exact=True).fill('Audit Seeker')
    page.get_by_placeholder('10-digit mobile',exact=True).fill('9876543210')
    page.get_by_role('button',name='Send enquiry').click();page.wait_for_timeout(500)
    record('Enquiry network failure','visible retry error',{'text':page.locator('main form').inner_text(),'uncaught':errors[-2:]},'Could not send' in page.locator('main form').inner_text())
    page.unroute('**/api/leads')
    mode('empty')
    response=page.goto(BASE+'/',wait_until='networkidle')
    record('Empty catalog home','200 with empty-state guidance',response.status,response.status==200)
    mode(reset=True)
    browser.close()

print('Flow audit complete',flush=True)
