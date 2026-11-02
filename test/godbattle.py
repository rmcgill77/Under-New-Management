import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = (ROOT / 'dist' / 'preview.html').as_uri()
OUT = str(ROOT / 'shots') + '/'

async def run(pw, name, w, h, mobile):
    br = await pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = await br.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2)
    p = await ctx.new_page(); p.set_default_timeout(6000)
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    await p.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await p.goto(URL); await p.wait_for_timeout(700)
    await p.evaluate('window.__unmQuick && window.__unmQuick()'); await p.wait_for_timeout(300)
    await p.click('#settingsBtn')
    for _ in range(7): await p.click('[data-act=godTap]', force=True)
    await p.fill('#godpw', 'SicParvisMagna'); await p.click('[data-act=godTry]'); await p.wait_for_timeout(150)
    await p.click('[data-act=close]'); await p.click('[data-act=close]'); await p.wait_for_timeout(150)
    async def close_drawer():
        if w < 900 and await p.evaluate("!document.getElementById('side').classList.contains('closed')"):
            await p.click('#rail .tab.on')
    async def sheets():
        for _ in range(8):
            if not await p.locator('#sheet:not([hidden])').count(): return
            await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(120)
    # Tutorial up to the intro mission
    await p.evaluate("(()=>{const {s,UNM}=window.__unm; for(const r of s.rooms.filter(r=>r.free)) UNM.repairRoom(s,r.id); const c=s.crew; ['generator','water_pump','bar','guest_room'].forEach((t,i)=>UNM.assignJob(s,c[i].id,s.rooms.find(r=>r.type===t).id));})()")
    await p.click('#rail .tab[data-arg=log]'); await close_drawer()
    await p.click('#phaseBtn'); await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(200)
    await sheets(); await close_drawer()
    await p.click('#phaseBtn'); await p.wait_for_timeout(200); await sheets()
    await p.click('#rail .tab[data-arg=missions]'); await p.wait_for_timeout(200)
    boxes = p.locator('#drawer input[data-act=squad]')
    for i in range(4): await boxes.nth(i).check()
    await close_drawer()
    await p.click('#phaseBtn'); await p.wait_for_timeout(150)
    await p.screenshot(path=OUT+f'{name}-b0-depart.png')
    await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(1500)
    await p.wait_for_timeout(1500)
    vis = await p.evaluate("[...document.querySelectorAll('.b-god')].map(b=>!b.hidden)")
    print(name, 'god buttons visible in battle', vis)
    ok = vis == [True, True]
    await p.click('[data-b=godheal]'); await p.wait_for_timeout(200)
    await p.click('[data-b=godwin]'); await p.wait_for_timeout(2500)
    out = await p.evaluate("(window.__unm.s.battle||{}).over")
    print(name, 'outcome after god win', out and out['outcome'])
    ok = ok and bool(out) and out['outcome'] == 'success'
    await p.screenshot(path=OUT+f'{name}-god-win.png')
    await p.click('[data-b=done]'); await p.wait_for_timeout(500)
    print(name, 'back home, battle cleared:', await p.evaluate("!window.__unm.s.battle"))
    await br.close()
    return ok
async def main():
    async with async_playwright() as pw:
        r = [await run(pw, 'desk', 1280, 800, False), await run(pw, 'phone', 390, 800, True)]
    print('godbattle:', 'all ok' if all(r) else 'FAILED'); raise SystemExit(0 if all(r) else 1)
asyncio.run(main())
