import base64,json
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
from fake_supabase import session

BASE='http://localhost:4317'
OUT=Path(__file__).parent/'evidence'
results=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,channel='chrome');ctx=b.new_context();page=ctx.new_page()
    def login(role,broker='B1'):
        ctx.clear_cookies()
        value='base64-'+base64.urlsafe_b64encode(json.dumps(session(role,broker)).encode()).decode().rstrip('=')
        ctx.add_cookies([{'name':'sb-127-auth-token','value':value,'domain':'localhost','path':'/'}])
    def mode(name='working'):
        ctx.request.post('http://127.0.0.1:4318/__audit',data={'mode':name,'reset':True})
    mode()
    for route in ('/admin','/broker/dashboard','/broker/onboard','/broker/listings/new'):
        response=ctx.request.get(BASE+route,max_redirects=0)
        results.append({'check':'latest proxy '+route,'status':response.status,'location':response.headers.get('location')})
    login('seeker')
    response=ctx.request.get(BASE+'/broker/onboard',max_redirects=0)
    results.append({'check':'new seeker can start onboarding','status':response.status,'location':response.headers.get('location')})
    login('broker','')
    page.goto(BASE+'/broker/dashboard?broker=B2',wait_until='networkidle')
    results.append({'check':'broker without profile association','url':page.url,'header':page.locator('main').inner_text()[:140]})
    ctx.clear_cookies()
    response=ctx.request.get(BASE+'/api/leads')
    results.append({'check':'latest anonymous lead access','status':response.status,'count':len(response.json()['leads'])})
    response=ctx.request.post(BASE+'/api/listings/L007/reconfirm')
    results.append({'check':'latest anonymous reconfirm','status':response.status,'verification':response.json().get('listing',{}).get('verification')})
    mode()
    # Auth requests go only to the local test double. Never contact audit.invalid.
    page.goto(BASE+'/auth',wait_until='networkidle')
    page.get_by_placeholder('you@example.com').fill('audit@example.test')
    page.get_by_role('button',name='Send code').click()
    page.get_by_placeholder('6-digit code').wait_for()
    response=ctx.request.get(BASE+'/auth/callback?code=audit-code&next='+quote('/\\audit.invalid',safe=''),max_redirects=0)
    results.append({'check':'callback redirect backslash','status':response.status,'location':response.headers.get('location')})
    mode('failing')
    for route in ('/api/leads','/api/listings','/api/city-requests'):
        data={'name':'Audit','phone':'9876543210','listingId':'L001','title':'Audit listing','city':'Jaipur' if route.endswith('city-requests') else 'Delhi','locality':'Dwarka','rent':20000,'bhk':2,'brokerId':'B1'}
        response=ctx.request.post(BASE+route,data=data)
        results.append({'check':'latest failed database '+route,'status':response.status,'source':response.json().get('source')})
    mode('empty')
    response=ctx.request.get(BASE+'/')
    results.append({'check':'latest empty home','status':response.status})
    mode()
    b.close()
(OUT/'final-checks.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
