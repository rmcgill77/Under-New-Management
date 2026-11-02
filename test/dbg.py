import os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
(ROOT / 'shots').mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME') or None  # set CHROME=/path/to/chrome to use a system browser
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        p = await (await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)).new_page()
        p.set_default_timeout(4000)
        errs=[]; p.on('pageerror', lambda e: errs.append(str(e)))
        await p.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await p.goto((ROOT / 'dist' / 'preview.html').as_uri()); await p.wait_for_timeout(700)
        print('loaded', errs, flush=True)
        print(await p.evaluate("[document.getElementById('side').className, document.getElementById('sheet').hidden, window.__unm.s.phase]"), flush=True)
        await p.click('#phaseBtn'); print('clicked phase', flush=True)
        print(await p.evaluate("document.getElementById('sheet').innerText.slice(0,200)"), flush=True)
        await b.close()
asyncio.run(main())
