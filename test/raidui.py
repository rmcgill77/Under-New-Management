import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio, sys, json
from playwright.async_api import async_playwright
URL=(ROOT / 'dist' / 'preview.html').as_uri(); OUT=str(ROOT / 'shots') + '/'
async def run(pw,name,w,h,mobile,hide=False):
    br=await pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
    ctx=await br.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=2)
    p=await ctx.new_page(); p.set_default_timeout(6000); errs=[]
    p.on('pageerror',lambda e:errs.append(str(e)))
    await p.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    await p.goto(URL); await p.wait_for_timeout(600)
    await p.evaluate('window.__unmQuick && window.__unmQuick()'); await p.wait_for_timeout(300)
    # Skip ahead: tutorial done, a watchtower and wall staffed, evening of day 6, force a raid.
    await p.evaluate("""(()=>{const {s,UNM}=window.__unm; UNM.skipTutorial(s); s.day=6; s.res.buttons=200; s.res.salvage=200;
      for(const r of s.rooms.filter(r=>['wall','watchtower'].includes(r.type))) UNM.repairRoom(s,r.id);
      const c=s.crew; ['generator','water_pump','bar','watchtower'].forEach((t,i)=>UNM.assignJob(s,c[i].id,s.rooms.find(r=>r.type===t).id));
      UNM.endMorning(s,{auto:true}); s.raidChanceBoost=1;
      const res=UNM.endEvening(s,{forceRaid:true}); window.__res=res; localStorage.setItem('unm-slot-0',UNM.serialize(s)); })()""")
    await p.reload(); await p.wait_for_timeout(500); await p.click('[data-act=menuPlay][data-arg="0"]'); await p.wait_for_timeout(900)
    await p.screenshot(path=OUT+f'{name}-r0-alert.png')
    if hide:
        await p.click('[data-act=raidHide]'); await p.wait_for_timeout(400)
        await p.screenshot(path=OUT+f'{name}-r9-hid.png')
        print(name,'hid', await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,lastRaid:s.lastNight&&s.lastNight.raid}})()"))
        print(name,'errors',errs); await br.close(); return
    await p.click('[data-act=raidGo]'); await p.wait_for_timeout(1200)
    async def settle():
        for _ in range(200):
            if await p.evaluate("window.__unm.Battle.settled()"): return
            await p.wait_for_timeout(100)
    async def tap(x,y,lift=0):
        pt=await p.evaluate(f"window.__unm.Battle.screenOf({x},{y},{lift})")
        if mobile: await p.touchscreen.tap(pt['x'],pt['y'])
        else: await p.mouse.click(pt['x'],pt['y'])
        await p.wait_for_timeout(100)
    await settle()
    await p.screenshot(path=OUT+f'{name}-r1-battle.png')
    for turn in range(12):
        if await p.evaluate("!window.__unm.s.battle||!!window.__unm.s.battle.over"): break
        ids=await p.evaluate("window.__unm.s.battle.units.filter(u=>u.side==='crew'&&u.kind!=='turret'&&window.__unm.TAC.standing(u)&&u.ap>0).map(u=>u.id)")
        for uid in ids:
            if await p.evaluate("!window.__unm.s.battle||!!window.__unm.s.battle.over"): break
            await p.click(f'.b-unit[data-id="{uid}"]')
            t=await p.evaluate(f"(()=>{{const T=window.__unm.TAC,b=window.__unm.s.battle,u=T.byId(b,'{uid}');const ts=T.targets(b,u.id).sort((a,c)=>c.chance-a.chance);if(!ts.length)return null;const e=T.byId(b,ts[0].id);return {{x:e.x,y:e.y,lift:T.high(b,e.x,e.y)?16:0}}}})()")
            if t:
                await tap(t['x'],t['y'],14+t['lift'])
                if await p.locator('[data-b=shoot]').count(): await p.click('[data-b=shoot]')
            elif await p.locator('[data-b=ab][data-ab=overwatch]:not([disabled])').count():
                await p.click('[data-b=ab][data-ab=overwatch]')
            await settle()
        if await p.evaluate("!window.__unm.s.battle||!!window.__unm.s.battle.over"): break
        if turn==2: await p.screenshot(path=OUT+f'{name}-r2-mid.png')
        await p.click('[data-b=end]'); await p.wait_for_timeout(200); await settle()
    await settle(); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-r3-debrief.png')
    print(name,'over',json.dumps(await p.evaluate("window.__unm.s.battle&&window.__unm.s.battle.over"))[:300])
    await p.click('[data-b=done]'); await p.wait_for_timeout(500)
    await p.screenshot(path=OUT+f'{name}-r4-morning.png')
    print(name,'after',await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,battle:!!s.battle,pending:!!s.pendingRaid,over:s.gameOver,damaged:s.rooms.filter(r=>r.state==='damaged').map(r=>r.type)}})()"))
    print(name,'errors',errs); await br.close()
async def main():
    which=sys.argv[1:] or ['phone','desk']
    async with async_playwright() as pw:
        if 'desk' in which: await run(pw,'desk',1440,900,False)
        if 'phone' in which: await run(pw,'phone',390,844,True)
        if 'fold' in which: await run(pw,'fold',344,882,True)
        if 'hide' in which: await run(pw,'hide',390,844,True,hide=True)
asyncio.run(main())
