import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:5180/')
args = parser.parse_args()
out = Path('output/playwright')
out.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1000}, accept_downloads=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.url)
    page.get_by_role('button',name='Start the guided demo',exact=False).click()
    expect(page.get_by_text('What should SDP investigate first?',exact=True)).to_be_visible()
    page.get_by_role('button',name='Next step',exact=False).click()
    expect(page.get_by_text('Test the option. Inspect what stays wet.',exact=True)).to_be_visible()
    page.get_by_role('button',name='Custom rain',exact=True).click()
    page.get_by_label('Rainfall total',exact=True).fill('90')
    page.get_by_text('Catchment assumptions',exact=True).click()
    page.get_by_label('Runoff coefficient',exact=True).fill('0.7')
    page.get_by_label('Flood rainfall duration',exact=True).select_option('60')
    run = page.get_by_role('button',name='Run flood comparison',exact=True)
    expect(run).to_be_enabled(timeout=15000)
    run.click()
    expect(page.get_by_text('Comparison ready',exact=True)).to_be_visible(timeout=30000)
    expect(page.get_by_text('No storage concepts were included.',exact=False)).to_be_visible()
    page.get_by_role('button',name='Place pooling-point demo basins',exact=True).click()
    run.click()
    expect(page.get_by_text('Comparison ready',exact=True)).to_be_visible(timeout=30000)
    insights = page.get_by_role('region',name='Flood comparison explanation',exact=True)
    expect(insights.get_by_role('heading',name='What changes in this scenario?',exact=True)).to_be_visible()
    insights.locator('summary').click()
    expect(insights.locator('meter')).to_have_count(12)
    expect(insights.get_by_role('heading',name='Where the water ends up',exact=True)).to_be_visible()
    insights.scroll_into_view_if_needed()
    page.screenshot(path=str(out/'ls-flow-insights.png'))
    insights.get_by_role('heading',name='Where the water ends up',exact=True).scroll_into_view_if_needed()
    page.screenshot(path=str(out/'ls-flow-budget.png'))
    page.get_by_label('Flood simulation time',exact=True).fill('40')
    page.get_by_role('button',name='Collapse guide instructions',exact=True).click()
    page.locator('.tt-presentation-toggle').click()
    expect(page.locator('.tt-workspace')).to_have_class('tt-workspace tt-presenting')
    page.get_by_role('button',name='Before mitigation',exact=True).click()
    page.locator('.tt-model').scroll_into_view_if_needed()
    expect(page.locator('.tt-frame-readout')).to_be_visible()
    page.wait_for_timeout(600)
    page.screenshot(path=str(out/'ls-flow-before.png'))
    page.get_by_role('button',name='After mitigation',exact=True).click()
    page.locator('.tt-model').scroll_into_view_if_needed()
    page.wait_for_timeout(600)
    page.screenshot(path=str(out/'ls-flow-after.png'))
    page.frame_locator('iframe[title="LivingShield 3D township model"]').locator('body').press('Escape')
    expect(page.locator('.tt-presentation-toggle')).to_be_focused()
    expect(page.locator('.tt-planner')).to_be_visible()
    page.get_by_role('button',name='Expand guide instructions',exact=True).click()
    page.get_by_role('button',name='Review this flood option',exact=False).click()
    expect(page.get_by_role('region',name='Site investigation decision',exact=True)).to_be_visible()
    expect(page.get_by_text('1 of 2 available attachments included.',exact=False)).to_be_visible()
    with page.expect_download() as option_export:
        page.get_by_role('button',name='Export resilience brief',exact=False).click()
    option_export.value.save_as(out/'ls-flood-option-brief.json')
    option_brief = json.loads((out/'ls-flood-option-brief.json').read_text())
    assert option_brief['completeness'] == {'floodComparison':True,'bankConcept':False}
    assert option_brief['bankConcept'] is None
    assert option_brief['decisionContext']['requestedDecision'] == 'Scope a site investigation before committing to works'
    assert option_brief['decisionContext']['bankConceptRequired'] is False
    assert not any('bank' in requirement.lower() for requirement in option_brief['validationNeeded'])
    with page.expect_download() as option_readable:
        page.get_by_role('button',name='Download readable brief',exact=False).click()
    option_readable.value.save_as(out/'ls-flood-option-brief.html')
    option_html = (out/'ls-flood-option-brief.html').read_text(encoding='utf-8')
    assert 'For the attached bank concept:' not in option_html
    page.get_by_role('button',name='3 · Optional bank study',exact=True).click()
    expect(page.get_by_text('Optional: put a bank concept to the test.',exact=True)).to_be_visible()
    expect(page.locator('.ls-scene-wrap canvas')).to_be_visible(timeout=15000)
    page.get_by_role('button',name='02 / Plan the bank',exact=True).click()
    page.get_by_role('button',name='Planting concept',exact=False).click()
    page.get_by_label('Quoted module unit rate in MYR',exact=True).fill('50')
    expect(page.locator('.ls-cost strong')).to_have_text('RM 14,400')
    page.wait_for_timeout(800)
    page.screenshot(path=str(out/'ls-flow-bank.png'))
    page.get_by_role('button',name='Next step',exact=False).click()
    expect(page.get_by_text('2 of 2 available attachments included.',exact=False)).to_be_visible()
    expect(page.get_by_role('heading',name='Comparison attached.',exact=True)).to_be_visible()
    expect(page.get_by_role('heading',name='Bank concept attached.',exact=True)).to_be_visible()
    page.screenshot(path=str(out/'ls-flow-brief.png'))
    page.get_by_role('link',name='Prepare the local review',exact=False).click()
    expect(page.get_by_role('button',name='Mark prepared for review',exact=True)).to_be_disabled()
    page.get_by_label('Next review stage',exact=True).select_option('hydraulics')
    expect(page.get_by_label('Proposed reviewer role',exact=True)).to_have_value('Hydraulic engineer')
    page.get_by_label('Next review action',exact=True).fill('Obtain surveyed drainage levels and calibrate the pilot storm against observed flood records.')
    page.get_by_label('Target review date',exact=True).fill('2026-10-28')
    page.get_by_role('button',name='Mark prepared for review',exact=True).click()
    expect(page.locator('.ls-review-status')).to_have_text('Prepared for review')
    page.locator('.ls-review-plan').screenshot(path=str(out/'ls-flow-review.png'))
    with page.expect_download() as received:
        page.get_by_role('button',name='Export resilience brief',exact=False).click()
    received.value.save_as(out/'ls-resilience-brief.json')
    brief = json.loads((out/'ls-resilience-brief.json').read_text())
    assert brief['completeness'] == {'floodComparison':True,'bankConcept':True}
    flood = brief['floodComparison']
    assert flood['townshipId'] == brief['bankConcept']['townshipId'] == brief['township']['id'] == 'bukit-raja'
    assert flood['input']['rainfallMm'] == 90
    assert len(flood['input']['proposals']) == 12
    assert len(flood['comparison']['before']['frames']) == len(flood['comparison']['after']['frames']) == 61
    for case in ['before','after']:
        assert abs(flood['comparison'][case]['metrics']['massErrorM3']) < 1e-5
    assert 0 < flood['comparison']['after']['metrics']['totalStoredM3'] <= 18000
    assert brief['bankConcept']['quantities']['orderModules'] == 288
    assert brief['bankConcept']['quantities']['moduleSubtotalMyr'] == 14400
    assert brief['floodSummary']['proposalCount'] == 12
    assert brief['floodSummary']['capacityM3'] == 18000
    assert abs(brief['floodSummary']['storedM3'] - flood['comparison']['after']['metrics']['totalStoredM3']) < 1e-8
    assert sum(brief['floodSummary']['counts'].values()) == 12
    assert brief['reviewPlan']['townshipId'] == 'bukit-raja'
    assert brief['reviewPlan']['status'] == 'prepared-for-review'
    assert brief['reviewPlan']['reviewerRole'] == 'Hydraulic engineer'
    assert brief['reviewPlan']['targetDate'] == '2026-10-28'
    with page.expect_download() as readable:
        page.get_by_role('button',name='Download readable brief',exact=False).click()
    readable.value.save_as(out/'ls-readable-brief.html')
    report_page = page.context.new_page()
    report_page.goto((out/'ls-readable-brief.html').resolve().as_uri())
    expect(report_page.get_by_text('261 / 27 / 288 units',exact=True)).to_be_visible()
    expect(report_page.get_by_text('38.45 ha',exact=True)).to_be_visible()
    expect(report_page.get_by_text('33.62 ha',exact=True)).to_be_visible()
    expect(report_page.get_by_text('Hydraulic engineer',exact=True)).to_be_visible()
    expect(report_page.get_by_text('2026-10-28',exact=True)).to_be_visible()
    expect(report_page.get_by_text(brief['reviewPlan']['nextAction'],exact=True)).to_be_visible()
    expect(report_page.get_by_role('heading',name='The decision this brief supports',exact=True)).to_be_visible()
    expect(report_page.get_by_text('Scope a site investigation before committing to works',exact=True)).to_be_visible()
    assert report_page.locator('script').count() == 0
    report_page.screenshot(path=str(out/'ls-readable-brief.png'),full_page=True)
    report_page.set_viewport_size({'width':390,'height':844})
    assert report_page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    report_page.close()
    page.get_by_role('button',name='Review the bank concept',exact=False).click()
    expect(page.get_by_label('Quoted module unit rate in MYR',exact=True)).to_have_value('50')
    page.locator('nav .tab-btn').filter(has_text='3D Townships').click()
    expect(page.get_by_label('Rainfall total',exact=True)).to_have_value('90')
    expect(page.get_by_text('Comparison ready',exact=True)).to_be_visible(timeout=15000)
    page.get_by_label('Sime Darby township pilot',exact=True).select_option('elmina')
    page.locator('nav .tab-btn').filter(has_text='River Lab').click()
    expect(page.get_by_label('Quoted module unit rate in MYR',exact=True)).to_have_value('')
    page.locator('nav .tab-btn').filter(has_text='Evidence brief').click()
    page.get_by_label('Evidence township',exact=True).select_option('bukit-raja')
    expect(page.get_by_role('heading',name='Comparison attached.',exact=True)).to_be_visible()
    expect(page.get_by_role('heading',name='Bank concept attached.',exact=True)).to_be_visible()
    expect(page.get_by_label('Next review action',exact=True)).to_have_value(brief['reviewPlan']['nextAction'])
    page.get_by_label('Evidence township',exact=True).select_option('elmina')
    expect(page.get_by_label('Next review action',exact=True)).to_have_value('')
    page.get_by_label('Evidence township',exact=True).select_option('bukit-raja')
    expect(page.locator('.ls-review-status')).to_have_text('Prepared for review')
    page.reload()
    page.locator('nav .tab-btn').filter(has_text='Evidence brief').click()
    expect(page.get_by_label('Next review action',exact=True)).to_have_value(brief['reviewPlan']['nextAction'])
    expect(page.locator('.ls-review-status')).to_have_text('Prepared for review')
    assert not errors, errors
    browser.close()
    result = {'url':args.url,'errors':errors,'complete':brief['completeness'],'rainfallMm':flood['input']['rainfallMm'],'before':flood['comparison']['before']['metrics'],'after':flood['comparison']['after']['metrics'],'bankQuantities':brief['bankConcept']['quantities'],'restoredRate':50,'floodSummary':brief['floodSummary'],'reviewPlan':brief['reviewPlan'],'reviewSurvivedReload':True}
    (out/'ls-flow-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))
