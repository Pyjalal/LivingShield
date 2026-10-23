import assert from 'node:assert/strict';
import test from 'node:test';
import { TOWNSHIPS } from '../src/township/model.ts';
import {
  canPrepareReview,
  createReviewPlanStore,
  emptyReviewPlan,
  parseReviewPlan,
} from '../src/platform/reviewPlan.ts';

const now = '2026-10-21T07:00:00.000Z';
const authored = () => ({
  ...emptyReviewPlan('bukit-raja'),
  reviewerRole: 'Survey lead',
  nextAction: 'Confirm ground levels and drain connectivity before model calibration.',
  targetDate: '2026-11-02',
  updatedAt: now,
});
function storageFixture() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('authored review plans survive a new store while each township remains isolated', () => {
  const storage = storageFixture();
  const first = createReviewPlanStore(storage, () => now);
  const plan = first.save({ ...authored(), status: 'prepared-for-review' });
  assert.equal(plan.status, 'prepared-for-review');
  assert.equal(first.storageStatus('bukit-raja'), 'browser');
  const reloaded = createReviewPlanStore(storage);
  assert.deepEqual(reloaded.read('bukit-raja'), plan);
  assert.equal(reloaded.read('pagoh').nextAction, '');
  assert.equal(reloaded.read('pagoh').updatedAt, null);
  reloaded.save({ ...emptyReviewPlan('pagoh'), nextAction: 'Arrange a Pagoh walkover.' });
  assert.equal(reloaded.read('bukit-raja').nextAction, plan.nextAction);
  assert.equal(reloaded.read('pagoh').status, 'draft');
});

test('failed browser reads and writes retain edits in memory without claiming persistence', () => {
  const storage = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
  };
  const store = createReviewPlanStore(storage, () => now);
  assert.equal(store.read('elmina').updatedAt, null);
  const saved = store.save({ ...emptyReviewPlan('elmina'), nextAction: 'Request an imagery and survey check.' });
  assert.equal(store.storageStatus('elmina'), 'session');
  assert.equal(store.read('elmina').nextAction, saved.nextAction);
  const copy = store.read('elmina');
  copy.requestedEvidence.length = 0;
  assert.equal(store.read('elmina').requestedEvidence.length, saved.requestedEvidence.length);
});

test('corrupt, wrong-pilot, oversized and unknown-state records cannot become a prepared handover', () => {
  const plan = authored();
  assert.equal(parseReviewPlan({ ...plan, townshipId: 'pagoh' }, 'bukit-raja'), null);
  assert.equal(parseReviewPlan({ ...plan, status: 'approved' }, 'bukit-raja'), null);
  assert.equal(parseReviewPlan({ ...plan, stage: '__proto__' }, 'bukit-raja'), null);
  const storage = storageFixture();
  storage.values.set('livingshield-review-plan-v1:bukit-raja', '{broken');
  storage.values.set('livingshield-review-plan-v1:pagoh', 'x'.repeat(10001));
  const store = createReviewPlanStore(storage);
  assert.equal(store.read('bukit-raja').updatedAt, null);
  assert.equal(store.read('pagoh').updatedAt, null);
  assert.throws(() => store.read('__proto__' as 'pagoh'));
});

test('required local handover fields, dates and bounded evidence requests are validated', () => {
  assert.equal(canPrepareReview(emptyReviewPlan('bukit-raja')), false);
  assert.equal(emptyReviewPlan('bukit-raja').requestedEvidence.includes('bank-tests'), false);
  const authoredBankRequest = parseReviewPlan({ ...authored(), requestedEvidence: ['levels', 'bank-tests'] }, 'bukit-raja')!;
  assert.deepEqual(authoredBankRequest.requestedEvidence, ['levels', 'bank-tests']);
  const parsed = parseReviewPlan({
    ...authored(), status: 'prepared-for-review',
    reviewerRole: 'r'.repeat(100), nextAction: 'a'.repeat(700),
    targetDate: '2026-02-30', requestedEvidence: ['levels', 'levels', 'invented', '__proto__'],
  }, 'bukit-raja')!;
  assert.equal(parsed.reviewerRole.length, 80);
  assert.equal(parsed.nextAction.length, 600);
  assert.equal(parsed.targetDate, null);
  assert.deepEqual(parsed.requestedEvidence, ['levels']);
  for (const missing of [{ reviewerRole: '   ' }, { nextAction: '' }, { requestedEvidence: [] }]) {
    assert.equal(parseReviewPlan({ ...authored(), status: 'prepared-for-review', ...missing }, 'bukit-raja')!.status, 'draft');
  }
  assert.equal(parseReviewPlan({ ...authored(), updatedAt: '2026-02-30T07:00:00.000Z' }, 'bukit-raja'), null);
});

test('readable handover escapes authored text and excludes another township plan', async () => {
  const readableBriefUrl = new URL('../src/platform/readableBrief.ts', import.meta.url);
  const { buildReadableBrief } = await import(readableBriefUrl.href);
  const plan = { ...authored(), reviewerRole: '<img src=x onerror=alert(1)>', nextAction: '<script>alert("x")</script> & check levels' };
  const html = buildReadableBrief(TOWNSHIPS[0], null, null, now, plan);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
  assert.ok(html.includes('Surveyed ground and bank levels'));
  assert.ok(html.includes('requests, not verified or collected evidence'));
  const empty = buildReadableBrief(TOWNSHIPS[1], null, null, now, plan);
  assert.ok(empty.includes('No authored local review plan'));
  assert.ok(!empty.includes('check levels'));
  const originalSignature = buildReadableBrief(TOWNSHIPS[0], null, null, now);
  assert.ok(originalSignature.includes(now));
  assert.ok(originalSignature.includes('0 of 2 available attachments included'));
});
