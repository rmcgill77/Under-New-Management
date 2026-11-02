import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = (ROOT / 'dist' / 'preview.html').as_uri()
OUT = str(ROOT / 'shots') + '/'

async def run(pw, name, w, h, mobile, days_after=0):
    br = await pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    ctx = await br.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2)
    p = await ctx.new_page(); p.set_default_timeout(6000)
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    await p.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await p.goto(URL); await p.wait_for_timeout(700)
    await p.evaluate('window.__unmQuick && window.__unmQuick()'); await p.wait_for_timeout(300)
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
    await p.screenshot(path=OUT+f'{name}-b1-battle.png')
    async def settle():
        for _ in range(200):
            if await p.evaluate("window.__unm.Battle.settled()"): return
            await p.wait_for_timeout(100)
    await settle()
    shots = 0
    async def tap(x, y, lift=0):
        pt = await p.evaluate(f"window.__unm.Battle.screenOf({x},{y},{lift})")
        if mobile: await p.touchscreen.tap(pt['x'], pt['y'])
        else: await p.mouse.click(pt['x'], pt['y'])
        await p.wait_for_timeout(120)
    for turn in range(25):
        b_over = await p.evaluate("!window.__unm.s.battle || !!window.__unm.s.battle.over")
        if b_over: break
        units = await p.evaluate("window.__unm.s.battle.units.filter(u=>u.side==='crew'&&u.kind!=='turret'&&window.__unm.TAC.standing(u)&&u.ap>0).map(u=>u.id)")
        for uid in units:
            if await p.evaluate("!window.__unm.s.battle || !!window.__unm.s.battle.over"): break
            await p.click(f'.b-unit[data-id="{uid}"]'); await p.wait_for_timeout(100)
            plan = await p.evaluate(f"""(()=>{{const T=window.__unm.TAC,b=window.__unm.s.battle,u=T.byId(b,'{uid}');
              if(!u||!T.standing(u)||u.ap<=0) return null;
              const ts=T.targets(b,u.id).sort((a,c)=>c.chance-a.chance);
              if(ts.length&&ts[0].chance>=35){{const e=T.byId(b,ts[0].id);return {{k:'shoot',x:e.x,y:e.y}}}}
              const foes=b.units.filter(e=>e.side==='enemy'&&T.active(e));
              const goal=b.objs.find(o=>!o.done&&!o.lost)||foes.sort((a,c)=>Math.hypot(a.x-u.x,a.y-u.y)-Math.hypot(c.x-u.x,c.y-u.y))[0];
              if(!goal) return null;
              const rc=T.reach(b,u); const t=rc.tiles.filter(t=>t.ap===1).sort((a,c)=>(Math.hypot(a.x-goal.x,a.y-goal.y)-T.coverFrom(b,a,goal.x,goal.y)*2)-(Math.hypot(c.x-goal.x,c.y-goal.y)-T.coverFrom(b,c,goal.x,goal.y)*2))[0];
              return t?{{k:'move',x:t.x,y:t.y}}:null}})()""")
            if not plan: continue
            if plan['k'] == 'shoot':
                pt = await p.evaluate(f"window.__unm.Battle.screenOf({plan['x']},{plan['y']},14)")
                if 0 < pt['x'] < w and 0 < pt['y'] < h: await tap(plan['x'], plan['y'], 14)
                else: await p.click('[data-b=nextTarget]')  # off screen: use the Aim button
                if await p.locator('[data-b=shoot]').count():
                    if shots == 0: await p.screenshot(path=OUT+f'{name}-b2-aim.png')
                    await p.click('[data-b=shoot]'); shots += 1
            else:
                await tap(plan['x'], plan['y'])
                if mobile:
                    if turn == 0: await p.screenshot(path=OUT+f'{name}-b2-preview.png')
                    await tap(plan['x'], plan['y'])
            await settle()
            # take a second action if possible
            again = await p.evaluate(f"(()=>{{const T=window.__unm.TAC,b=window.__unm.s.battle; if(!b||b.over) return null; const u=T.byId(b,'{uid}'); if(!u||!T.standing(u)||u.ap<=0) return null; const ts=T.targets(b,u.id).sort((a,c)=>c.chance-a.chance); return ts.length?ts[0].id:'ow'}})()")
            if again == 'ow':
                if await p.locator('[data-b=ab][data-ab=overwatch]:not([disabled])').count(): await p.click('[data-b=ab][data-ab=overwatch]')
            elif again:
                e = await p.evaluate(f"(()=>{{const b=window.__unm.s.battle,e=window.__unm.TAC.byId(b,'{again}');return {{x:e.x,y:e.y}}}})()")
                await tap(e['x'], e['y'], 14)
                if await p.locator('[data-b=shoot]').count(): await p.click('[data-b=shoot]'); shots += 1
            await settle()
        if await p.evaluate("!window.__unm.s.battle || !!window.__unm.s.battle.over"): break
        if turn == 1: await p.screenshot(path=OUT+f'{name}-b3-turn2.png')
        await p.click('[data-b=end]'); await p.wait_for_timeout(300)
        if turn == 1: await p.screenshot(path=OUT+f'{name}-b4-enemy.png')
        await settle()
    await settle(); await p.wait_for_timeout(400)
    st = await p.evaluate("(()=>{const b=window.__unm.s.battle;return b?{turn:b.turn,over:b.over}:null})()")
    print(name, 'battle', json.dumps(st)[:400], 'shots', shots, flush=True)
    await p.screenshot(path=OUT+f'{name}-b5-debrief.png')
    if await p.locator('[data-b=done]').count(): await p.click('[data-b=done]'); await p.wait_for_timeout(400)
    await p.screenshot(path=OUT+f'{name}-b6-midday.png')
    st = await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,crew:s.crew.filter(c=>c.alive).length,intro:s.introDone,battle:!!s.battle,tut:s.tutorial.step}})()")
    print(name, 'after', st, flush=True)
    print(name, 'errors:', errs[:5], flush=True)
    await br.close()

async def main():
    which = sys.argv[1:] or ['phone', 'fold', 'desk']
    async with async_playwright() as pw:
        if 'phone' in which: await run(pw, 'phone', 390, 844, True)
        if 'fold' in which: await run(pw, 'fold', 344, 882, True)
        if 'desk' in which: await run(pw, 'desk', 1440, 900, False)
        if 'foldopen' in which: await run(pw, 'foldopen', 884, 1104, True)
asyncio.run(main())
