import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Activity } from '../js/model/Activity.js';
import { Period } from '../js/model/Period.js';

test('het volgende programma na oktober is november–december', () => {
  const p = Period.upcoming(new Date(2026, 9, 13));
  assert.equal(p.label(), 'november en december 2026');
  assert.equal(p.label({ ampersand: true }), 'november & december 2026');
});

test('na november–december komt januari–februari van het volgende jaar', () => {
  assert.deepEqual(new Period(5, 2026).next().toJSON(), { block: 0, year: 2027 });
});

test('bestandsnaam', () => {
  assert.equal(new Period(5, 2026).fileName(), 'Programma_november_en_december_2026.docx');
});

test('titel van een activiteit in het programma', () => {
  const a = new Activity({ date: '2027-01-13', title: 'Comedy' });
  assert.equal(a.heading(2026), 'Woensdag 13/01/2027: Comedy');
  assert.equal(a.heading(2027), 'Woensdag 13/01: Comedy');
});

test('activiteit na de periode wordt automatisch een aankondiging', () => {
  const period = new Period(5, 2026);
  const later = new Activity({ date: '2027-01-13' });
  const now = new Activity({ date: '2026-12-19', type: 'aankondiging' });
  later.applyAutoType(period);
  now.applyAutoType(period);
  assert.equal(later.type, 'aankondiging');
  assert.equal(now.type, 'activiteit');
});
