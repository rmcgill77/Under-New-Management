import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio, sys
from playwright.async_api import async_playwright
URL = (ROOT / 'dist' / 'preview.html').as_uri()
OUT = str(ROOT / 'shots') + '/'
async def run(pw, name, w, h, mobile):
    b = await pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2)
    p = await ctx.new_page(); p.set_default_timeout(5000)
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    await p.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await p.goto(URL); await p.wait_for_timeout(900)
    await p.screenshot(path=OUT+f'{name}-1-start.png')
    # Tap the guest room on the canvas via the tap API: compute screen point from scene camera is internal, so use rules + rerender
    async def close_drawer():
        if w < 900 and await p.evaluate("!document.getElementById('side').classList.contains('closed')"):
            await p.click('#rail .tab.on')
    async def do(js):
        await p.evaluate("(()=>{const {s,UNM}=window.__unm;" + js + "})()")
        await p.click('#rail .tab[data-arg=log]'); await close_drawer()
    # real tap on canvas center of guest room: find via scene not exposed; click canvas where guest room likely is
    await do("for(const r of s.rooms.filter(r=>r.free)) UNM.repairRoom(s,r.id); const c=s.crew; ['generator','water_pump','bar','guest_room'].forEach((t,i)=>UNM.assignJob(s,c[i].id,s.rooms.find(r=>r.type===t).id));")
    await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-2-repaired.png')
    # End morning through the real button flow
    await close_drawer()
    await p.click('#phaseBtn'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-3-depart.png')
    await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-4-midday.png')
    await p.click('[data-act=close]'); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-5-evening.png')
    await p.click('#phaseBtn'); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-6-night.png')
    for _ in range(8):
        if not await p.locator('#sheet:not([hidden])').count(): break
        print(name,'sheet:', (await p.evaluate("document.getElementById('sheet').innerText"))[:80].replace('\n',' | '), flush=True)
        await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(150)
    st = await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,tut:s.tutorial.step,missions:s.missions.map(m=>m.site+':'+m.status),res:s.res}})()")
    print(name, st, flush=True)
    # Intro mission: open Missions tab, pick 4
    await p.click('#rail .tab[data-arg=missions]'); await p.wait_for_timeout(200)
    boxes = p.locator('#drawer input[data-act=squad]')
    for i in range(4): await boxes.nth(i).check()
    await p.screenshot(path=OUT+f'{name}-7-missions.png')
    await close_drawer()
    await p.click('#phaseBtn'); await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-8-intro-report.png')
    await p.click('[data-act=close]')
    await close_drawer()
    await p.click('#rail .tab[data-arg=team]'); await p.wait_for_timeout(200)
    await p.locator('#drawer [data-act=hire]').first.click(); await p.wait_for_timeout(200)
    st = await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,tut:s.tutorial.step,crew:s.crew.filter(c=>c.alive).length,missions:s.missions.length}})()")
    print(name, 'after intro', st, flush=True)
    await p.screenshot(path=OUT+f'{name}-9-team.png')
    # Play 12 more days with simple choices
    for d in range(12):
        # close sheets
        for _ in range(6):
            if await p.locator('#sheet:not([hidden])').count()==0: break
            btn = p.locator('#sheet button:not([disabled])').first
            await btn.click(); await p.wait_for_timeout(80)
        if await p.locator('#sheet:not([hidden])').count(): continue
        await close_drawer()
        ph = await p.evaluate("window.__unm.s.phase")
        await p.click('#phaseBtn'); await p.wait_for_timeout(80)
        if ph=='morning':
            await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(80)
    await p.wait_for_timeout(300)
    st = await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,over:s.gameOver,res:s.res,trust:s.trust}})()")
    print(name, 'later', st, flush=True)
    await p.screenshot(path=OUT+f'{name}-10-later.png')
    print(name, 'errors:', errs[:5])
    await b.close()
async def main():
    async with async_playwright() as pw:
        await run(pw, 'phone', 390, 844, True)
        await run(pw, 'fold', 344, 882, True)
        await run(pw, 'desk', 1440, 900, False)
asyncio.run(main())
