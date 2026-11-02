import pathlib
src = pathlib.Path(__file__).parent / 'src'
shell = (src/'shell.html').read_text()
css = (src/'style.css').read_text()
js = '\n'.join((src/f).read_text() for f in ['rules.js','tactics.js','god.js','audio.js','paint.js','sprites.js','structures.js','furniture.js','render.js','battle.js','dropdown.js','cinematic.js','brand.js','ui.js'])
out = shell.replace('/*CSS*/', css).replace('/*JS*/', js)
dist = pathlib.Path(__file__).parent / 'dist'; dist.mkdir(exist_ok=True)
(dist/'under-new-management.html').write_text(out)
# local preview wrapper with the publish skeleton
(dist/'preview.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + out + '</body></html>')
# ---- installable copy: dist/pwa (host these files anywhere over https) ----
import hashlib, json
pwa = dist / 'pwa'; pwa.mkdir(exist_ok=True)
ver = hashlib.sha1(out.encode()).hexdigest()[:10]
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  '<title>Under New Management</title><meta name="theme-color" content="#2c2219"><meta name="color-scheme" content="dark">'
  '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
  '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Under New Mgmt"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
  '<script>window.__PWA=true;window.__BUILD="' + ver + '"</script><style>html,body{margin:0;height:100%;background:#0d0907;overscroll-behavior:none}[hidden]{display:none!important}</style></head><body>')
body = out.replace('<title>Under New Management</title>\n', '', 1)
(pwa/'index.html').write_text(head + body + '</body></html>')
(pwa/'manifest.webmanifest').write_text(json.dumps({
  'name': 'Under New Management', 'short_name': 'Under New Mgmt', 'description': 'Run a waystation at the end of the world. Keep the lights on.',
  'start_url': './', 'scope': './', 'id': './', 'display': 'standalone', 'orientation': 'any', 'background_color': '#0d0907', 'theme_color': '#2c2219', 'categories': ['games'],
  'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'}, {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}, indent=2))
(pwa/'sw.js').write_text('''// Offline cache for the installed game. The cache name changes with every build.
const CACHE = 'unm-%s';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
// A new version installs quietly and waits. The game shows an "Update now" button; it posts SKIP_WAITING and the page reloads.
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) => fetch(new Request(f, { cache: 'reload' })).then((r) => { if (!r.ok) throw new Error(f); return c.put(f, r); }))))); });
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts and the like go straight to the network
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; }).catch(() => caches.match('index.html'))));
});
''' % ver)
import shutil
shutil.copytree(pathlib.Path(__file__).parent / 'assets' / 'icons', pwa / 'icons', dirs_exist_ok=True)
print(len(out), 'bytes; installable copy in dist/pwa (' + ver + ')')
