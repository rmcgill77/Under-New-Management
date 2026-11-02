import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio, json
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
    await p.evaluate("""(()=>{const {s,UNM}=window.__unm; UNM.skipTutorial(s); s.res.buttons=150; s.gear=['vest','scope','kit'];
      const f=s.warlords.find(w=>w.temperament==='friendly'); f.disposition=60;
      const n=s.warlords.find(w=>w.temperament!=='friendly'&&w.temperament!=='aggressive')||s.warlords.find(w=>w!==f&&w.temperament!=='aggressive'); if(n) n.disposition=20;
      localStorage.setItem('unm-slot-0',UNM.serialize(s));})()""")
    await p.reload(); await p.wait_for_timeout(500); await p.click('[data-act=menuPlay][data-arg="0"]'); await p.wait_for_timeout(700)
    await p.click('#rail .tab[data-arg=warlords]'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-p1-warlords.png')
    # pact with the friendly one
    await p.locator('#drawer [data-act=pact]:not([disabled])').first.click(); await p.wait_for_timeout(200)
    # oppose the aggressive one via confirm
    agg=await p.evaluate("window.__unm.s.warlords.find(w=>w.temperament==='aggressive').id")
    await p.click(f'#drawer [data-act=askOppose][data-arg="{agg}"]'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-p2-confirm.png')
    await p.click('[data-act=confirmYes]'); await p.wait_for_timeout(200)
    # conspire with someone cordial
    if await p.locator('#drawer [data-act=conspire]').count():
        await p.locator('#drawer [data-act=conspire]').first.click(); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-p3-stances.png', full_page=False)
    st=await p.evaluate("(()=>{const s=window.__unm.s;return {stances:s.warlords.map(w=>w.stance),cons:s.conspiracy}})()")
    print(name,'stances',st)
    # end the day to get strikes on the board
    if w<900:
        await p.click('#rail .tab.on')
    await p.click('#phaseBtn'); await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(300)
    for _ in range(6):
        if not await p.locator('#sheet:not([hidden])').count(): break
        await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(120)
    if w<900 and await p.evaluate("!document.getElementById('side').classList.contains('closed')"): await p.click('#rail .tab.on')
    await p.click('#phaseBtn'); await p.wait_for_timeout(300)
    if await p.locator('[data-act=raidHide]').count(): await p.click('[data-act=raidHide]'); await p.wait_for_timeout(300)
    for _ in range(6):
        if not await p.locator('#sheet:not([hidden])').count(): break
        await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(120)
    await p.click('#rail .tab[data-arg=missions]'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-p4-missions.png')
    print(name,'board',await p.evaluate("window.__unm.s.missions.map(m=>m.site+(m.strike?' [strike]':'')+(m.from?' [contract]':''))"))
    # gear
    await p.click('#rail .tab[data-arg=team]'); await p.wait_for_timeout(200)
    sel=p.locator('#drawer select[data-act=gear]').first
    await sel.evaluate("(el)=>el._dd.click()"); await p.wait_for_timeout(150)
    await p.locator('.dd-opt', has_text='cope').first.dispatch_event('pointerup'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-p5-team.png')
    print(name,'gear',await p.evaluate("(()=>{const s=window.__unm.s;return {inv:s.gear,eq:s.crew.filter(c=>c.gear).map(c=>c.name+':'+c.gear)}})()"))
    print(name,'errors',errs); await br.close()
async def main():
    async with async_playwright() as pw:
        await run(pw,'desk',1440,900,False)
        await run(pw,'phone',390,844,True)
asyncio.run(main())
