# Renders the app icon PNGs from src/brand.js into assets/icons (build.py copies them into dist/pwa/icons). Usage: python3 tools/make_icons.py [A|B|C]
import asyncio, base64, pathlib, sys
from playwright.async_api import async_playwright
root = pathlib.Path(__file__).resolve().parent.parent
variant = sys.argv[1] if len(sys.argv) > 1 else None
async def main():
    out = root / 'assets' / 'icons'; out.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=['--no-sandbox'])
        p = await br.new_page()
        await p.set_content('<html><body></body></html>')
        await p.add_script_tag(path=str(root / 'src' / 'brand.js'))
        v = variant or await p.evaluate('Brand.ICON_PICK')
        specs = [('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-maskable-512.png', 512, True), ('apple-touch-icon.png', 180, False), ('favicon-32.png', 32, False)]
        for name, size, mask in specs:
            data = await p.evaluate(f"Brand.icon('{v}', {size}, {str(mask).lower()}).toDataURL('image/png')")
            (out / name).write_bytes(base64.b64decode(data.split(',')[1]))
        await br.close()
    print('icons for option', v, '->', out)
asyncio.run(main())
