import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio
from playwright.async_api import async_playwright
URL=(ROOT / 'dist' / 'preview.html').as_uri(); OUT=str(ROOT / 'shots') + '/'
async def run(pw,name,w,h,mobile):
    br=await pw.chromium.launch(executable_path=CHROME,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    ctx=await br.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile,device_scale_factor=2)
    p=await ctx.new_page(); p.set_default_timeout(5000); errs=[]
    p.on('pageerror',lambda e:errs.append(str(e)))
    p.on('console',lambda m: m.type=='error' and 'net::' not in m.text and errs.append(m.text))
    await p.route('**/fonts.googleapis.com/**',lambda r:r.abort())
    await p.goto(URL); await p.wait_for_timeout(600)
    await p.evaluate('window.__unmQuick && window.__unmQuick()'); await p.wait_for_timeout(300)
    await p.evaluate("""(()=>{const {s,UNM}=window.__unm; UNM.skipTutorial(s); s.trust.points=40; UNM.updateTrust(s); s.storyQueue=[]; localStorage.setItem('unm-slot-0',UNM.serialize(s));})()""")
    await p.reload(); await p.wait_for_timeout(500); await p.click('[data-act=menuPlay][data-arg="0"]'); await p.wait_for_timeout(700)
    await p.mouse.click(10,200) if not mobile else await p.touchscreen.tap(10,300)
    print(name,'audio started',await p.evaluate("window.__unm.Sound.started"))
    door=await p.evaluate("window.__unm.s.rooms.find(r=>r.type==='sealed_door').id")
    # select the door through the room panel path
    await p.evaluate(f"(()=>{{}})()")
    async def open_door():
        await p.evaluate(f"document.querySelector('#rail .tab[data-arg=room]').click()")
        # emulate tapping the room: the scene's onTap is internal, so use the debug hook
        await p.evaluate(f"window.__unmSelect && window.__unmSelect('{door}')")
    await p.evaluate(f"window.__unm.sel=null")
    # use the room tap via the exposed selection helper
    await p.evaluate(f"window.__unmSelect('{door}')")
    await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-s1-door.png')
    await p.click('[data-act=intercom]'); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-s2-intercom.png')
    await p.locator('[data-act=intercomSay]').last.click(); await p.wait_for_timeout(200)
    await p.screenshot(path=OUT+f'{name}-s3-reply.png')
    await p.click('[data-act=close]'); await p.wait_for_timeout(200)
    print(name,'board',await p.evaluate("window.__unm.s.missions.filter(m=>m.scripted==='keycard').map(m=>m.site)"))
    # fast-forward the rest of the story via rules
    await p.evaluate("""(()=>{const {s,UNM}=window.__unm; for(let k=1;k<=3;k++){ s.story.pieces=k; s.story.callDay=0; const v=UNM.intercom(s); if(v) UNM.answerIntercom(s,v.options[0].id);} s.story.callDay=0; const v=UNM.intercom(s); if(v) UNM.answerIntercom(s,v.options[1].id); s.trust.points=80; UNM.updateTrust(s); s.storyQueue=[];})()""")
    await p.evaluate(f"window.__unmSelect('{door}')"); await p.wait_for_timeout(200)
    for _ in range(4):
        if not await p.locator('#sheet:not([hidden])').count(): break
        await p.locator('#sheet button:not([disabled])').first.click(); await p.wait_for_timeout(120)
    await p.screenshot(path=OUT+f'{name}-s4-ready.png')
    await p.click('[data-act=openVault]'); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-s5-ending1.png')
    for i in range(3):
        await p.click('[data-act=endingNext]'); await p.wait_for_timeout(150)
    await p.screenshot(path=OUT+f'{name}-s6-ending-end.png')
    await p.click('[data-act=close]'); await p.wait_for_timeout(300)
    await p.screenshot(path=OUT+f'{name}-s7-after.png')
    print(name,'after',await p.evaluate("(()=>{const s=window.__unm.s;return {open:s.story.open,relative:s.crew.filter(c=>c.relative).map(c=>c.name),vault:s.rooms.some(r=>r.type==='vault')}})()"))
    await p.click('#settingsBtn'); await p.wait_for_timeout(150)
    await p.click('[data-act=music]'); await p.click('[data-act=sfx]'); await p.wait_for_timeout(150)
    await p.screenshot(path=OUT+f'{name}-s8-settings.png')
    print(name,'prefs',await p.evaluate("JSON.parse(localStorage.getItem('unm-prefs-v1'))"))
    print(name,'errors',errs); await br.close()
async def main():
    async with async_playwright() as pw:
        await run(pw,'desk',1440,900,False)
        await run(pw,'phone',390,844,True)
asyncio.run(main())
