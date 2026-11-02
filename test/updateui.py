# Update banner + accessibility + god mode in a real browser. Run: python3 build.py && python3 test/updateui.py
import os, pathlib, shutil, tempfile, threading, functools, http.server, asyncio, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None
from playwright.async_api import async_playwright
SHOTS = str(ROOT / 'shots') + '/'
site = pathlib.Path(tempfile.mkdtemp(prefix='unm-site-'))
shutil.copytree(ROOT / 'dist' / 'pwa', site, dirs_exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self): self.send_header('Cache-Control', 'max-age=600'); super().end_headers()  # like GitHub Pages
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(site)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
fails = []
def check(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = await br.new_context(viewport={'width': 900, 'height': 760}, service_workers='allow')
        p = await ctx.new_page(); p.set_default_timeout(6000); errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        await p.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await p.goto(URL); await p.wait_for_timeout(800)
        await p.evaluate("navigator.serviceWorker.ready")
        await p.reload(); await p.wait_for_timeout(800)   # now controlled by the first service worker
        first = await p.evaluate("window.__BUILD")
        check(bool(first), f'build id present ({first})')
        check(await p.evaluate("getComputedStyle(document.getElementById('update')).display") == 'none', 'no update banner on a current copy')

        # ---- a new version is published ----
        sw = (site / 'sw.js').read_text(); (site / 'sw.js').write_text(sw.replace("const CACHE = 'unm-", "const CACHE = 'unm-NEW"))
        html = (site / 'index.html').read_text(); (site / 'index.html').write_text(html.replace('__BUILD="' + first + '"', '__BUILD="NEWBUILD"'))
        await p.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
        await p.wait_for_function("getComputedStyle(document.getElementById('update')).display !== 'none'", timeout=8000)
        check(True, 'banner appears when a new version is downloaded')
        check(await p.evaluate("window.__BUILD") == first, 'running game is untouched until the player asks')
        await p.screenshot(path=SHOTS + 'update-banner.png')
        await p.click('[data-act=laterUpdate]')
        check(await p.evaluate("getComputedStyle(document.getElementById('update')).display") == 'none', 'Later hides the banner')
        # settings still offers the update
        await p.click('[data-act=menuSettings]'); await p.wait_for_timeout(200)
        check(await p.locator('[data-act=applyUpdate]').count() >= 1, 'Settings shows "Update now" while one is waiting')
        await p.click('[data-act=applyUpdate]')
        await p.wait_for_function("window.__BUILD === 'NEWBUILD'", timeout=10000)
        check(True, 'Update now swaps in the new version')
        keys = await p.evaluate("caches.keys()")
        check(any('NEW' in k for k in keys) and len(keys) == 1, f'old cache dropped: {keys}')

        # ---- accessibility ----
        await p.wait_for_timeout(600)
        await p.click('[data-act=menuSettings]'); await p.wait_for_timeout(200)
        for arg in ['text:xxl', 'font:easy', 'hold:tap']: await p.click(f'[data-act=pset][data-arg="{arg}"]')
        for arg in ['hc', 'loose', 'still', 'big', 'focus', 'cb']: await p.click(f'[data-act=ptoggle][data-arg={arg}]')
        cls = await p.evaluate("document.body.className")
        for c in ['text-xxl', 'font-easy', 'space-loose', 'hc', 'still', 'big-touch', 'focus-strong', 'cb']: check(c in cls.split(), f'body has {c}')
        check(await p.evaluate("window.__still") is True, 'reduce motion reaches the animation code')
        await p.evaluate("(() => { const r = document.querySelector('[data-vol=vMusic]'); r.value = 40; r.dispatchEvent(new Event('input', {bubbles: true})); })()")
        check('40%' in await p.inner_text('[data-vol=vMusic] + output'), 'volume slider updates its readout')
        await p.screenshot(path=SHOTS + 'a11y-settings.png', full_page=True)
        await p.reload(); await p.wait_for_timeout(900)
        cls = await p.evaluate("document.body.className")
        check('hc' in cls and 'text-xxl' in cls and 'font-easy' in cls, 'preferences survive a reload')
        await p.click('[data-act=menuSettings]'); await p.click('[data-act=resetAccess]'); await p.wait_for_timeout(200)
        check('hc' not in (await p.evaluate("document.body.className")).split(), 'reset returns to defaults')
        await p.click('[data-act=close]')

        # ---- god mode ----
        await p.evaluate("window.__unmQuick({tutorial:false})"); await p.wait_for_timeout(600)
        await p.click('#settingsBtn'); await p.wait_for_timeout(150)
        check(await p.locator('text=God mode').count() == 0, 'god mode is not visible in settings')
        for _ in range(7): await p.click('[data-act=godTap]', force=True)
        check(await p.locator('#godpw').count() == 1, 'seven taps on the footer ask for the passphrase')
        await p.fill('#godpw', 'wrong'); await p.click('[data-act=godTry]')
        check(await p.locator('#godpw').count() == 1 and not await p.evaluate("!!window.__unm.s.god"), 'wrong passphrase refused')
        await p.fill('#godpw', 'SicParvisMagna'); await p.press('#godpw', 'Enter'); await p.wait_for_timeout(200)
        check(await p.locator('text=God mode').count() >= 1, 'right passphrase (Enter key) opens god mode')
        await p.screenshot(path=SHOTS + 'god-switches.png', full_page=True)
        await p.click('[data-act=god][data-op=toggle][data-a=infinite]')
        check(await p.evaluate("window.__unm.s.res.buttons") >= 9999, 'infinite resources')
        await p.click('[data-act=godTab][data-arg=res]'); await p.fill('#g-salvage', '321'); await p.click('[data-act=god][data-op=setRes][data-a=salvage]')
        check(await p.evaluate("window.__unm.s.res.salvage") == 321 or await p.evaluate("window.__unm.s.res.salvage") >= 9999, 'set a resource')
        await p.click('[data-act=godTab][data-arg=crew]'); n = await p.evaluate("window.__unm.s.crew.length")
        await p.click('[data-act=god][data-op=addRecruit][data-a=tinker]')
        check(await p.evaluate("window.__unm.s.crew.length") == n + 1, 'add crew')
        await p.click('[data-act=godTab][data-arg=base]'); await p.click('[data-act=god][data-op=unlockTech]')
        check(await p.evaluate("window.__unm.UNM.TECH.every(t => window.__unm.UNM.hasTech(window.__unm.s, t.id))"), 'unlock all plans')
        await p.click('[data-act=godTab][data-arg=world]'); await p.screenshot(path=SHOTS + 'god-world.png', full_page=True)
        await p.click('[data-act=close]'); await p.click('[data-act=close]')
        # hidden again for a normal person after reload (session-only unlock)
        await p.reload(); await p.wait_for_timeout(800)
        check(await p.evaluate("!!window.__unm.s && !document.querySelector('.b-god:not([hidden])')"), 'battle god buttons hidden until unlocked')
        check(not errs, f'no page errors {errs}')
        await br.close()
asyncio.run(main())
srv.shutdown()
print('FAILED: ' + '; '.join(fails) if fails else 'updateui: all ok')
raise SystemExit(1 if fails else 0)
