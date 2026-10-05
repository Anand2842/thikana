import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path(__file__).parent/'evidence'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chrome')
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:4319/index.html',wait_until='networkidle')
    for view in ('home','properties','brokers','property','broker','enquiries','saved','brokerdash','admin'):
        page.evaluate('(view)=>showView(view)',view)
        results.append({'view':view,'visible':page.locator('.view.active').get_attribute('id'),'buttons':page.locator('.view.active button').count(),'errors':errors[:]})
    page.evaluate("showView('home')")
    page.get_by_role('button',name='2 BHK under ₹25k in Dwarka',exact=True).click()
    results.append({'check':'advertised natural-language search','results':page.locator('#propCount').inner_text()})
    page.evaluate("showView('home')")
    page.get_by_role('button',name='Verified brokers in Saket',exact=True).click()
    results.append({'check':'verified broker quick-search','active':page.locator('.view.active').get_attribute('id')})
    page.evaluate("showView('properties');clearFilters()")
    page.locator('#propertiesGrid button[onclick^="toggleSave"]').first.click()
    page.evaluate("showView('saved')")
    results.append({'check':'save property','cards':page.locator('#savedGrid > div').count()})
    page.evaluate("openAuth()")
    page.locator('#authPhone').fill('9876543210')
    page.locator('#authModal').get_by_role('button',name='Send OTP').click()
    page.locator('#authOTP').fill('123456')
    page.locator('#authName').fill('Audit Seeker')
    page.locator('#authModal').get_by_role('button',name='Verify & continue').click()
    page.evaluate("openContact('L001')")
    page.locator('#cMsg').fill('Audit enquiry')
    page.locator('#contactModal').get_by_role('button',name='Send enquiry').click()
    results.append({'check':'prototype enquiry','active':page.locator('.view.active').get_attribute('id'),'contains_new':page.locator('#enquiriesList').inner_text().find('Audit enquiry')>=0})
    page.evaluate("openReport('L001')")
    page.locator('#reportDetails').fill('Audit report')
    page.locator('#reportModal').get_by_role('button',name='Submit report').click()
    results.append({'check':'prototype report','reports':page.evaluate('reports.length')})
    for tab in ('overview','listings','add','leads','profile'):
        page.evaluate("(tab)=>{showView('brokerdash');state.brokerTab=tab;renderBrokerDash()}",tab)
        results.append({'check':'broker tab '+tab,'controls':page.locator('#brokerDashContent button').count(),'errors':errors[:]})
    for tab in ('overview','verify','listings','reports','dup'):
        page.evaluate("(tab)=>{showView('admin');state.adminTab=tab;renderAdmin()}",tab)
        results.append({'check':'admin tab '+tab,'controls':page.locator('#adminContent button').count(),'errors':errors[:]})
    page.evaluate("showView('properties');clearFilters();renderProperties()")
    page.locator('#propertiesGrid button[onclick^="openProperty"]').first.click()
    page.locator('#propertyDetailContent img[onclick]').nth(1).click()
    results.append({'check':'gallery thumbnail','src':page.locator('#galMain').get_attribute('src')})
    page.evaluate("showView('home')")
    page.screenshot(path=str(OUT/'prototype-home-top.png'))
    page.reload(wait_until='networkidle')
    results.append({'check':'prototype persistence','new_enquiry_remains':page.evaluate("leads.some(x=>x.msg==='Audit enquiry')"),'errors':errors[:]})
    browser.close()
(OUT/'prototype.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
