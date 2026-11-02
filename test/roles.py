import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio, json
from playwright.async_api import async_playwright
URL=(ROOT / 'dist' / 'preview.html').as_uri(); OUT=str(ROOT / 'shots') + '/'
async def main():
  async with async_playwright() as pw:
    br=await pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
    ctx=await br.new_context(viewport={'width':1280,'height':800}); p=await ctx.new_page(); p.set_default_timeout(5000)
    errs=[]; p.on('pageerror',lambda e:errs.append(str(e)))
    await p.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    await p.goto(URL); await p.wait_for_timeout(600)
    await p.evaluate('window.__unmQuick && window.__unmQuick()'); await p.wait_for_timeout(300)
    for kind in ['rescue','salvage','warlord']:
      await p.evaluate(f"""(()=>{{const {{s,UNM}}=window.__unm; if(s.tutorial.step<UNM.TUTORIAL.length) UNM.skipTutorial(s);
        const roles=['bulwark','longshot','drifter','sawbones','tinker','recruit'];
        while(UNM.living(s).length<6) s.crew.push({{...s.crew[0], id:'cx'+Math.random(), name:'Extra Hand', alive:true, away:null}});
        UNM.living(s).forEach((c,i)=>{{c.role=roles[i%6];c.level=3;c.injured=0;c.away=null;}});
        let m=s.missions.find(m=>m.kind==='{kind}'&&m.status==='open');
        if(!m){{ m={{...s.missions[0], id:'mt{kind}', kind:'{kind}', status:'open', squad:[], travel:0, from:s.warlords[0].id, rival:s.warlords[1].id}}; s.missions.push(m);}}
        m.travel=0; for(const o of s.missions) o.squad=[]; UNM.setSquad(s,m.id,UNM.living(s).slice(0,6).map(c=>c.id)); }})()""")
      await p.click('#phaseBtn'); await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(800)
      async def settle():
        for _ in range(150):
          if await p.evaluate("window.__unm.Battle.settled()"): return
          await p.click('.b-canvas', position={'x':5,'y':300}); await p.wait_for_timeout(60)
      await settle()
      used=set()
      for turn in range(12):
        if await p.evaluate("!window.__unm.s.battle||!!window.__unm.s.battle.over"): break
        ids=await p.evaluate("window.__unm.s.battle.units.filter(u=>u.side==='crew'&&u.kind!=='turret'&&window.__unm.TAC.standing(u)).map(u=>u.id)")
        for uid in ids:
          if await p.evaluate("!window.__unm.s.battle||!!window.__unm.s.battle.over"): break
          await p.click(f'.b-unit[data-id="{uid}"]')
          btns=p.locator('[data-b=ab]:not([disabled])')
          n=await btns.count()
          for i in range(n):
            ab=await btns.nth(i).get_attribute('data-ab')
            if ab in ('overwatch','hunker','extract') or ab in used: continue
            used.add(ab); await btns.nth(i).click(); await settle(); break
          # then move toward goal via API so fights happen
          await p.evaluate(f"""(()=>{{const T=window.__unm.TAC,b=window.__unm.s.battle,u=T.byId(b,'{uid}'); if(!b||b.over||!T.standing(u)||u.ap<=0) return;
             const ts=T.targets(b,u.id).sort((a,c)=>c.chance-a.chance); if(ts.length&&ts[0].chance>40) {{T.shoot(b,u.id,ts[0].id);return;}}
             const goal=b.objs.find(o=>!o.done&&!o.lost)||b.units.find(e=>e.side==='enemy'&&T.active(e)); if(!goal) return;
             const rc=T.reach(b,u); const t=rc.tiles.filter(t=>t.ap===1).sort((a,c)=>Math.hypot(a.x-goal.x,a.y-goal.y)-Math.hypot(c.x-goal.x,c.y-goal.y))[0]; if(t) T.move(b,u.id,t.x,t.y); }})()""")
        if turn==1:
          await p.reload(); await p.wait_for_timeout(500); await p.click('[data-act=menuPlay][data-arg="0"]'); await p.wait_for_timeout(900)
          print(kind,'reload reopened battle:', await p.evaluate("window.__unm.Battle.isOpen()"))
          await settle()
          await p.screenshot(path=OUT+f'roles-{kind}.png')
        if await p.evaluate("!window.__unm.s.battle||!!window.__unm.s.battle.over"): break
        await p.click('[data-b=end]'); await settle()
      if not await p.evaluate("!!window.__unm.s.battle.over"):
        await p.click('[data-b=retreat]'); await p.click('[data-b=retreatYes]'); await settle()
      print(kind,'used',sorted(used),'over',json.dumps(await p.evaluate("window.__unm.s.battle.over"))[:200])
      await p.wait_for_timeout(300); await p.click('[data-b=done]'); await p.wait_for_timeout(300)
      for _ in range(6):
        if not await p.locator('#sheet:not([hidden])').count(): break
        await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(100)
      await p.click('#phaseBtn'); await p.wait_for_timeout(300)
      for _ in range(6):
        if not await p.locator('#sheet:not([hidden])').count(): break
        await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(100)
      print(kind,'state',await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,battle:!!s.battle,crew:s.crew.filter(c=>c.alive).length}})()"))
    print('errors',errs)
    await br.close()
asyncio.run(main())
