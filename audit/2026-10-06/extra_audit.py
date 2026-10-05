import base64,json
from pathlib import Path
from playwright.sync_api import sync_playwright
from fake_supabase import session

OUT=Path(__file__).parent/'evidence'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chrome')
    ctx=browser.new_context(viewport={'width':375,'height':900})
    page=ctx.new_page()
    def role(name):
        ctx.clear_cookies()
        val='base64-'+base64.urlsafe_b64encode(json.dumps(session(name)).encode()).decode().rstrip('=')
        ctx.add_cookies([{'name':'sb-127-auth-token','value':val,'domain':'localhost','path':'/'}])
    for route,name in [('/broker/listings/new','broker'),('/broker/onboard','broker'),('/broker/dashboard','broker'),('/admin','admin')]:
        role(name)
        page.goto('http://localhost:4317'+route,wait_until='networkidle')
        for width in (320,375,768,1024):
            page.set_viewport_size({'width':width,'height':900})
            metrics=page.evaluate('''() => ({width:innerWidth,document:document.documentElement.scrollWidth,main:document.querySelector('main').scrollWidth,controls:[...document.querySelectorAll('main input, main select')].map(e=>({value:e.value,label:e.labels?.[0]?.innerText||e.getAttribute('aria-label'),right:e.getBoundingClientRect().right}))})''')
            results.append({'route':route,**metrics})
            if width==375:
                page.screenshot(path=str(OUT/(route.strip('/').replace('/','-')+'-mobile-top.png')))
    ctx.clear_cookies()
    page.goto('http://localhost:4317/',wait_until='networkidle')
    page.emulate_media(reduced_motion='reduce')
    results.append({'check':'reduced motion','transition':page.locator('.card-hover').first.evaluate('(e)=>getComputedStyle(e).transition')})
    results.append({'check':'fonts','faces':page.evaluate('()=>[...document.fonts].map(f=>({family:f.family,status:f.status}))'),'display':page.locator('h1').evaluate('(e)=>getComputedStyle(e).fontFamily')})
    page.keyboard.press('Tab')
    results.append({'check':'keyboard focus','style':page.evaluate('()=>({name:document.activeElement.innerText,outline:getComputedStyle(document.activeElement).outline})')})
    for endpoint in ('/api/cron/expire',):
        denied=ctx.request.get('http://localhost:4317'+endpoint)
        allowed=ctx.request.get('http://localhost:4317'+endpoint,headers={'Authorization':'Bearer audit-cron-secret'})
        results.append({'check':'cron secret','without':denied.status,'with':allowed.status,'result':allowed.json()})
    statuses=[]
    for i in range(11):
        statuses.append(ctx.request.post('http://localhost:4317/api/city-requests',data={},headers={'x-forwarded-for':'198.51.100.230'}).status)
    results.append({'check':'rate limit','statuses':statuses})
    browser.close()

(OUT/'extra.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
