import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / 'evidence'
BASE = 'http://localhost:4317'
results = {'pages': [], 'api': [], 'errors': []}
def save():
    (OUT / 'inspection.json').write_text(json.dumps(results, indent=2))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chrome')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.on('pageerror', lambda error: results['errors'].append({'url': page.url, 'error': str(error)}))
    catalogs = {}
    for route, key in [('/api/listings', 'listings'), ('/api/brokers', 'brokers'), ('/api/leads', 'leads'), ('/api/city-requests', 'requests')]:
        response = context.request.get(BASE + route)
        data = response.json()
        results['api'].append({'route': route, 'status': response.status, 'source': data.get('source'), 'count': len(data.get(key, [])), 'fields': list(data.get(key, [{}])[0]) if data.get(key) else []})
        if key in ('listings', 'brokers'):
            catalogs[key] = data.get(key, [])
    routes = ['/', '/properties', '/brokers', '/dashboard', '/auth', '/admin', '/broker/dashboard', '/broker/onboard', '/broker/listings/new']
    routes += ['/properties/' + x['id'] for x in catalogs['listings']]
    routes += ['/brokers/' + x['id'] for x in catalogs['brokers']]
    routes += ['/properties/unknown-audit-id', '/brokers/unknown-audit-id', '/does-not-exist', '/robots.txt', '/sitemap.xml']
    links = set()
    for route in routes:
        response = page.goto(BASE + route, wait_until='networkidle', timeout=30000)
        for href in page.locator('a[href^="/"]').evaluate_all('(els) => els.map(e => e.getAttribute("href"))'):
            if not href.startswith('/auth/signout'):
                links.add(href)
        record = {'route': route, 'status': response.status if response else None, 'final': page.url.removeprefix(BASE), 'h1': page.locator('h1').all_text_contents(), 'buttons': page.locator('main button').all_text_contents(), 'links': page.locator('main a').count()}
        if route not in ('/robots.txt', '/sitemap.xml'):
            record['forms'] = page.locator('main input, main textarea, main select').evaluate_all('(els) => els.map(e => ({tag:e.tagName, type:e.type, placeholder:e.placeholder, label: e.getAttribute("aria-label") || e.labels?.[0]?.innerText || null}))')
            record['font'] = page.locator('h1').evaluate_all('(els) => els.map(e => getComputedStyle(e).fontFamily)')
        results['pages'].append(record)
        save()
        print(json.dumps({k:record[k] for k in ('route','status','final')}), flush=True)
        if route in ('/', '/properties', '/properties/L003', '/properties/L007', '/brokers', '/dashboard', '/auth', '/admin'):
            page.screenshot(path=str(OUT / (route.strip('/').replace('/', '-') or 'home')) + '-desktop.png', full_page=True)
    for href in sorted(links - set(routes)):
        response = page.goto(BASE + href, wait_until='networkidle', timeout=30000)
        results['pages'].append({'route': href, 'status': response.status, 'final': page.url.removeprefix(BASE), 'h1': page.locator('h1').all_text_contents(), 'result': page.locator('main > p').all_text_contents()})
        save()
    results['responsive'] = []
    for width in (320, 375, 768):
        page.set_viewport_size({'width': width, 'height': 900})
        for route in ('/', '/properties', '/brokers', '/properties/L003', '/auth'):
            page.goto(BASE + route, wait_until='networkidle')
            metrics = page.evaluate('''() => ({width:innerWidth, document:document.documentElement.scrollWidth, overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && e.getBoundingClientRect().width>0).slice(0,12).map(e=>({tag:e.tagName,text:e.innerText?.slice(0,60),right:Math.round(e.getBoundingClientRect().right)}))})''')
            results['responsive'].append({'route': route, **metrics})
            save()
            if width == 375:
                page.screenshot(path=str(OUT / (route.strip('/').replace('/', '-') or 'home')) + '-mobile.png', full_page=True)
                page.screenshot(path=str(OUT / (route.strip('/').replace('/', '-') or 'home')) + '-mobile-top.png')
    browser.close()

(OUT / 'inspection.json').write_text(json.dumps(results, indent=2))
print('Saved inspection.json', flush=True)
