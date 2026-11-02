import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio
from playwright.async_api import async_playwright
URL=(ROOT / 'dist' / 'preview.html').as_uri(); OUT=str(ROOT / 'shots') + '/'
async def run(pw,name,w,h,mobile):
    br=await pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox'])
    ctx=await br.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=2)
    p=await ctx.new_page(); p.set_default_timeout(5000); errs=[]
    p.on('pageerror',lambda e:errs.append(str(e)))
    await p.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    await p.goto(URL); await p.wait_for_timeout(600)
    await p.evaluate('window.__unmQuick && window.__unmQuick()'); await p.wait_for_timeout(300)
    await p.evaluate("""(()=>{const {s,UNM}=window.__unm; UNM.skipTutorial(s); s.res.buttons=150; s.res.salvage=70; s.crew[1].level=3; s.crew[1].role='bulwark';
      const c=s.crew; ['generator','water_pump','bar','guest_room'].forEach((t,i)=>UNM.assignJob(s,c[i].id,s.rooms.find(r=>r.type===t).id));
      localStorage.setItem('unm-slot-0',UNM.serialize(s));})()""")
    await p.reload(); await p.wait_for_timeout(500); await p.click('[data-act=menuPlay][data-arg="0"]'); await p.wait_for_timeout(700)
    await p.click('#rail .tab[data-arg=plans]'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-t1-plans.png')
    await p.click('#drawer [data-act=research][data-arg=x1]'); await p.wait_for_timeout(200); await p.click('#sheet [data-act=confirmYes]'); await p.wait_for_timeout(200)
    print(name,'current',await p.evaluate("window.__unm.s.tech.current"))
    if w<900: await p.click('#rail .tab.on')
    for ph in range(2):
        await p.click('#phaseBtn'); await p.wait_for_timeout(200)
        if await p.locator('[data-act=confirmMorning]').count(): await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(300)
        if await p.locator('[data-act=raidHide]').count(): await p.click('[data-act=raidHide]')
        for _ in range(6):
            if not await p.locator('#sheet:not([hidden])').count(): break
            if ph==1 and _==0: await p.screenshot(path=OUT+f'{name}-t2-night.png')
            await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(120)
    print(name,'done',await p.evaluate("window.__unm.s.tech.done"))
    # build messenger post on an empty surface lot via API selection -> UI build list
    await p.evaluate("(()=>{})()")
    ok=await p.evaluate("(()=>{const {s,UNM}=window.__unm; for(let c=0;c<10;c++) if(!UNM.roomAt(s,0,c)) return UNM.buildRoom(s,'messenger_post',0,c)||'built'; return 'nolot'})()")
    print(name,'build',ok)
    await p.click('#rail .tab[data-arg=plans]'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-t3-plans-after.png')
    if w<900: await p.click('#rail .tab.on'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-t4-base.png')
    print(name,'errors',errs); await br.close()
async def main():
    async with async_playwright() as pw:
        await run(pw,'desk',1440,900,False)
        await run(pw,'phone',390,844,True)
asyncio.run(main())
