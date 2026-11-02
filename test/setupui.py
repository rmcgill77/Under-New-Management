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
    await p.goto(URL); await p.wait_for_timeout(700)
    await p.click('[data-act=menuNew][data-arg="0"]'); await p.wait_for_timeout(300)
    await p.fill('#savename','Test run')
    await p.screenshot(path=OUT+f'{name}-n1-setup.png')
    await p.click('[data-act=setdiff][data-arg=hard]')
    await p.check('[data-act=setupopt][data-arg=ironman]'); await p.uncheck('[data-act=setupopt][data-arg=tutorial]')
    await p.click('[data-act=newgame]'); await p.wait_for_timeout(500); await p.click('.cine-skip'); await p.wait_for_timeout(500)
    st=await p.evaluate("(()=>{const s=window.__unm.s;return {d:s.difficulty,iron:s.ironman,tut:s.tutorial.step,b:s.res.buttons}})()")
    print(name,'new game',st)
    # settings: accessibility
    await p.click('#settingsBtn'); await p.click('[data-act=textsize][data-arg=xl]'); await p.click('[data-act=cb]'); await p.click('[data-act=fast]'); await p.wait_for_timeout(150)
    await p.screenshot(path=OUT+f'{name}-n2-settings.png')
    await p.click('[data-act=help]'); await p.wait_for_timeout(150)
    await p.screenshot(path=OUT+f'{name}-n3-help.png')
    await p.click('[data-act=close]'); await p.click('[data-act=close]')
    print(name,'body',await p.evaluate("document.body.className"))
    # room list in the panel (keyboard access)
    await p.click('#rail .tab[data-arg=room]'); await p.wait_for_timeout(150)
    await p.locator('#drawer [data-act=selroom]').first.click(); await p.wait_for_timeout(150)
    print(name,'selected via list',await p.evaluate("!!window.__unm.sel"))
    # ironman loss wipes the save
    await p.evaluate("(()=>{const {s}=window.__unm; s.res.buttons=1; s.warlords.forEach(w=>w.stance='pact');})()")
    if w<900 and await p.evaluate("!document.getElementById('side').classList.contains('closed')"): await p.click('#rail .tab.on')
    await p.click('#phaseBtn'); await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(200)
    for _ in range(4):
        if await p.locator('#sheet:not([hidden]) [data-act=close]').count(): await p.click('#sheet:not([hidden]) [data-act=close]'); await p.wait_for_timeout(100)
    await p.evaluate("window.__unm.s.res.buttons=0")
    await p.click('#phaseBtn'); await p.wait_for_timeout(400)
    await p.screenshot(path=OUT+f'{name}-n4-ironman-over.png')
    print(name,'over',await p.evaluate("window.__unm.s.gameOver"),'save kept?',await p.evaluate("!!localStorage.getItem('unm-slot-0')"), 'retry offered?', await p.locator('[data-act=retryDay]').count())
    # normal game: retry day
    await p.click('[data-act=toMenu]'); await p.wait_for_timeout(400); await p.click('[data-act=menuNew][data-arg="0"]'); await p.click('[data-act=setdiff][data-arg=standard]'); await p.uncheck('[data-act=setupopt][data-arg=ironman]'); await p.uncheck('[data-act=setupopt][data-arg=tutorial]'); await p.click('[data-act=newgame]'); await p.wait_for_timeout(500); await p.click('.cine-skip'); await p.wait_for_timeout(500)
    await p.evaluate("(()=>{const {s}=window.__unm; s.warlords.forEach(w=>w.stance='pact');})()")
    await p.click('#phaseBtn'); await p.click('[data-act=confirmMorning]'); await p.wait_for_timeout(200)
    for _ in range(4):
        if await p.locator('#sheet:not([hidden]) [data-act=close]').count(): await p.click('#sheet:not([hidden]) [data-act=close]'); await p.wait_for_timeout(100)
    await p.evaluate("window.__unm.s.res.buttons=0")
    await p.click('#phaseBtn'); await p.wait_for_timeout(300)
    print(name,'normal over',await p.evaluate("window.__unm.s.gameOver"),'retry offered?', await p.locator('[data-act=retryDay]').count())
    await p.click('[data-act=retryDay]'); await p.wait_for_timeout(300)
    print(name,'after retry',await p.evaluate("(()=>{const s=window.__unm.s;return {day:s.day,phase:s.phase,over:s.gameOver,b:s.res.buttons}})()"))
    print(name,'errors',errs); await br.close()
async def main():
    async with async_playwright() as pw:
        await run(pw,'desk',1440,900,False)
        await run(pw,'phone',390,844,True)
asyncio.run(main())
