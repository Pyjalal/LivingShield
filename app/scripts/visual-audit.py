import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--theme', default='accessible', choices=['accessible', 'dark', 'terminal'])
parser.add_argument('--width', type=int, default=1440)
parser.add_argument('--url', default='http://127.0.0.1:5180/')
args = parser.parse_args()
out = Path('output/playwright')
out.mkdir(parents=True, exist_ok=True)
views = ['home', 'township', 'living-shield', 'evidence', 'layers', 'drainage', 'flood', 'hydrometric', 'precipitation', 'property', 'engineering', 'simulation', 'cost']
labels = {'township': '3D Townships', 'living-shield':'River Lab', 'evidence':'Evidence brief', 'layers':'National Maps', 'drainage':'Drainage & Water', 'property':'Property Lookup'}
menus = {'flood':'Flood Hazard', 'hydrometric':'River Flow', 'precipitation':'Precipitation Explorer', 'engineering':'Drainage Design', 'simulation':'Storm Simulation', 'cost':'Cost Analysis'}
report = {'theme':args.theme, 'width':args.width, 'url':args.url, 'views':[], 'errors':[]}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':args.width, 'height':1000 if args.width > 600 else 844}, device_scale_factor=1)
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    page.add_init_script(f"localStorage.setItem('hydrogrid-ui-theme', '{args.theme}')")
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_selector('.ls-home')
    for view in views:
        if view == 'home':
            page.get_by_role('button', name='LivingShield home', exact=True).click()
        elif view in labels:
            page.locator('nav .tab-btn').filter(has_text=labels[view]).click()
        else:
            index = 0 if view in ['flood','hydrometric','precipitation'] else 1
            page.locator('nav .tab-dropdown-wrap').nth(index).locator(':scope > button').click()
            page.locator('nav .tab-dropdown-item').get_by_text(menus[view], exact=True).click()
        page.wait_for_function('(v) => document.querySelector(".app").dataset.view === v', arg=view)
        page.wait_for_timeout(2200 if view in ['township','living-shield','layers','flood'] else 600)
        if view in ['township','living-shield']:
            page.wait_for_timeout(1500)
        screenshot = f'ls-audit-{args.theme}-{args.width}-{view}.png'
        page.screenshot(path=str(out / screenshot))
        style = page.evaluate('''() => {
          const app = document.querySelector('.app'), main = document.querySelector('.app-content');
          const heading = main.querySelector('h1,h2');
          const css = getComputedStyle(app);
          const overflowing = [...main.querySelectorAll('*')].filter(el=>el.clientWidth>0 && el.scrollWidth>el.clientWidth+2 && !['auto','scroll','hidden'].includes(getComputedStyle(el).overflowX));
          return {view:app.dataset.view,background:css.getPropertyValue('--tt-bg').trim(),font:css.fontFamily,headingFont:heading && getComputedStyle(heading).fontFamily,documentOverflow:document.documentElement.scrollWidth>innerWidth,mainWidth:main.getBoundingClientRect().width,overflowing:overflowing.slice(0,8).map(el=>({tag:el.tagName,class:el.className,width:el.clientWidth,scroll:el.scrollWidth})),canvas:main.querySelectorAll('canvas').length,iframe:main.querySelectorAll('iframe').length};
        }''')
        report['views'].append({'view':view, 'screenshot':screenshot, **style})
    browser.close()
(out / f'ls-audit-{args.theme}-{args.width}.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'views':len(report['views']),'errors':report['errors'],'overflow':[v['view'] for v in report['views'] if v['documentOverflow']]},ensure_ascii=True))
