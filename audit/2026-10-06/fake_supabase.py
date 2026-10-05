"""Local test double; no production credentials or external writes."""
import json
import time
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).parent
original = json.loads((ROOT / 'seed.json').read_text())
tables = json.loads(json.dumps(original))
mode = 'working'
events = []

def b64(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')

def user(role='seeker', broker='B1'):
    return {'id': '00000000-0000-4000-8000-000000000001', 'aud': 'authenticated', 'role': 'authenticated', 'email': 'audit@example.test', 'app_metadata': {'role': role, 'broker_id': broker}, 'user_metadata': {}, 'created_at': '2026-10-05T00:00:00Z'}

def session(role='seeker', broker='B1'):
    u = user(role, broker)
    token = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': u['id'], 'role': 'authenticated', 'exp': int(time.time())+3600, 'app_metadata': u['app_metadata']}) + '.audit'
    return {'access_token': token, 'refresh_token': 'audit-refresh-token', 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time())+3600, 'user': u}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.reply(200, {})

    def handle_request(self):
        global mode, tables
        url = urlparse(self.path)
        q = parse_qs(url.query)
        raw = self.rfile.read(int(self.headers.get('content-length', 0)))
        body = json.loads(raw or b'{}')
        if url.path == '/__audit':
            if self.command == 'POST':
                mode = body.get('mode', 'working')
                if body.get('reset'):
                    tables = json.loads(json.dumps(original))
                    events.clear()
            return self.reply(200, {'mode': mode, 'counts': {k:len(v) for k,v in tables.items()}, 'events': events})
        if url.path.startswith('/auth/v1/'):
            action = url.path.removeprefix('/auth/v1/')
            if action == 'user':
                token = self.headers.get('Authorization', '').removeprefix('Bearer ')
                try:
                    claim = json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '==='))
                    meta = claim['app_metadata']
                    return self.reply(200, user(meta['role'], meta['broker_id']))
                except Exception:
                    return self.reply(401, {'msg':'Invalid test session'})
            if action in ('verify', 'token'):
                return self.reply(400, {'msg':'Invalid OTP', 'error_code':'otp_expired'}) if body.get('token') == '000000' else self.reply(200, session())
            if action == 'otp':
                return self.reply(200, {})
            if action == 'logout':
                return self.reply(200, {})
            return self.reply(404, {})
        table = url.path.removeprefix('/rest/v1/')
        if table not in tables:
            return self.reply(404, {'message':'Unknown test table'})
        if mode == 'failing':
            return self.reply(503, {'message':'Audit database unavailable'})
        rows = [] if mode == 'empty' else tables[table]
        selected = rows
        for key, values in q.items():
            val = values[0]
            if val.startswith('eq.'):
                selected = [r for r in selected if str(r.get(key, '')).lower() == val[3:].lower()]
            elif val.startswith('gte.'):
                selected = [r for r in selected if float(r.get(key, 0)) >= float(val[4:])]
            elif val.startswith('in.('):
                selected = [r for r in selected if str(r.get(key)) in val[4:-1].split(',')]
        if self.command == 'POST':
            row = dict(body)
            defaults = {'brokers': {'rating':0,'reviews_count':0,'recommend':0,'accuracy':0,'response_rate':0,'response_time':'—','exp':0,'tenure':'','policy':'','vdate':'','complaints':0,'resolved':0,'kyc':''}, 'listings':{'sector':'','type':'Apartment','deposit':0,'furnishing':'','area':0,'floor':'','amenities':[],'avail':'','brok':'','brok_days':0,'visit_fee':0,'other_fee':0,'description':'','views':0,'enq':0,'flags':[]},'leads':{'req':'','time':'','visit':'—','mine':False}}
            row = {**defaults.get(table, {}), **row}
            if table == 'leads' and not any(r['id'] == row.get('listing_id') for r in tables['listings']):
                return self.reply(409, {'message':'listing FK violation'})
            rows.append(row)
            selected = [row]
        elif self.command == 'PATCH':
            for row in selected:
                row.update(body)
        elif self.command == 'DELETE':
            if table == 'brokers' and any(l['broker_id'] in [r['id'] for r in selected] for l in tables['listings']):
                return self.reply(409, {'message':'broker FK violation'})
            tables[table] = [r for r in rows if r not in selected]
        if self.command != 'GET':
            events.append({'method':self.command,'table':table,'ids':[r.get('id') for r in selected],'fields':list(body)})
        order = q.get('order', [''])[0].split('.')
        if order[0]:
            selected = sorted(selected, key=lambda r:r.get(order[0],0), reverse=len(order)>1 and order[1]=='desc')
        single = 'application/vnd.pgrst.object+json' in self.headers.get('Accept', '')
        if single and len(selected) != 1:
            return self.reply(406, {'message':'Expected one row'})
        self.reply(201 if self.command == 'POST' else 200, selected[0] if single else selected)

    do_GET = handle_request
    do_POST = handle_request
    do_PATCH = handle_request
    do_DELETE = handle_request

if __name__ == '__main__':
    print('Local Supabase test double on 4318', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 4318), Handler).serve_forever()
