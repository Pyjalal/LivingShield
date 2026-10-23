import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBankLayout, DEFAULT_BANK, moduleSlots } from '../src/livingshield/model.ts';

test('nominal bank packing conserves actual slots and explicit spare quantities', () => {
  const layout = calculateBankLayout(DEFAULT_BANK);
  assert.equal(layout.rows, 6);
  assert.equal(layout.columns, 22);
  assert.equal(layout.installedModules, 261);
  assert.equal(moduleSlots(DEFAULT_BANK).length, layout.installedModules);
  assert.equal(layout.spareModules, 27);
  assert.equal(layout.orderModules, 288);
  assert.ok(
    Math.abs(
      layout.bankAreaM2 -
        (DEFAULT_BANK.lengthM * DEFAULT_BANK.heightM) / Math.sin((32 * Math.PI) / 180),
    ) < 1e-10,
  );
});

test('missing quoted rates stay unknown; supplied rates apply only to ordered modules', () => {
  assert.equal(calculateBankLayout(DEFAULT_BANK).moduleSubtotalMyr, null);
  const priced = calculateBankLayout({ ...DEFAULT_BANK, unitRateMyr: 12.5 });
  assert.equal(priced.moduleSubtotalMyr, 288 * 12.5);
  const noSpares = calculateBankLayout({ ...DEFAULT_BANK, sparePercent: 0, unitRateMyr: 0 });
  assert.equal(noSpares.spareModules, 0);
  assert.equal(noSpares.moduleSubtotalMyr, 0);
});

test('larger or shallower bank scenarios increase course demand without changing nominal unit geometry', () => {
  const base = calculateBankLayout(DEFAULT_BANK);
  const larger = calculateBankLayout({ ...DEFAULT_BANK, lengthM: DEFAULT_BANK.lengthM * 2 });
  const shallower = calculateBankLayout({ ...DEFAULT_BANK, slopeDegrees: 20 });
  assert.ok(larger.installedModules > base.installedModules);
  assert.ok(shallower.rows > base.rows);
  assert.equal(larger.nominalModuleAreaM2, base.nominalModuleAreaM2);
  for (const input of [
    DEFAULT_BANK,
    { ...DEFAULT_BANK, lengthM: 60, heightM: 3, slopeDegrees: 20 },
  ]) {
    const layout = calculateBankLayout(input);
    const slots = moduleSlots(input);
    assert.equal(slots.length, layout.installedModules);
    assert.ok(
      slots.every(
        (slot) =>
          Number.isFinite(slot.x) &&
          Number.isFinite(slot.upSlope) &&
          slot.row >= 0 &&
          slot.row < layout.rows,
      ),
    );
  }
});

test('invalid geometry, non-finite values and impossible quoted rates fail explicitly', () => {
  for (const bad of [
    { lengthM: 0 },
    { lengthM: Infinity },
    { heightM: -1 },
    { heightM: NaN },
    { slopeDegrees: 0 },
    { slopeDegrees: 90 },
    { sparePercent: -1 },
    { unitRateMyr: NaN },
    { unitRateMyr: Infinity },
    { unitRateMyr: -2 },
  ])
    assert.throws(() => calculateBankLayout({ ...DEFAULT_BANK, ...bad }));
});
