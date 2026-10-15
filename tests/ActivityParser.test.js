import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ActivityParser } from '../js/parsing/ActivityParser.js';

const today = new Date(2026, 9, 13); // 13 oktober 2026
const parse = (text, options = {}) => new ActivityParser({ today, ...options }).parseText(text);

test('leest een activiteit met de vaste velden', () => {
  const [a] = parse(`Zaterdag 19/12: Magische winterbeleving in Oostende
Wij gaan de kerstlocaties bewonderen.
Afspraak: 15 u in Brasserie-Tearoom Minigolf
Prijs: je eigen consumptie
Contactpersoon: Bart
Opmerkingen: Bart verwittigen voor 18/12`);

  assert.equal(a.date, '2026-12-19');
  assert.equal(a.title, 'Magische winterbeleving in Oostende');
  assert.equal(a.sentDay, 'zaterdag');
  assert.equal(a.desc, 'Wij gaan de kerstlocaties bewonderen.');
  assert.equal(a.afspraak, '15 u in Brasserie-Tearoom Minigolf');
  assert.equal(a.prijs, 'je eigen consumptie');
  assert.equal(a.contact, 'Bart');
  assert.equal(a.opm, 'Bart verwittigen voor <b>18/12</b>', 'inschrijfdatum komt in het vet');
});

test('januari na een najaarsprogramma valt in het volgende jaar', () => {
  const [a] = parse('Woensdag 13/01: Comedy met Robrecht Vanden Thoren');
  assert.equal(a.date, '2027-01-13');
});

test('jaar uit de bestandsnaam wint', () => {
  assert.equal(ActivityParser.yearFromFileName('20270113_Robrecht.docx'), 2027);
  const [a] = parse('Maandag 07/12: Quiz', { hintYear: 2026 });
  assert.equal(a.date, '2026-12-07');
});

test('maandnaam in plaats van cijfers', () => {
  const [a] = parse('Zaterdag 28 november: Kerstmarkt');
  assert.equal(a.date, '2026-11-28');
  assert.equal(a.title, 'Kerstmarkt');
});

test('e-mail: aanhef en groet vallen weg, afgebroken regels worden samengevoegd', () => {
  const [a, ...rest] = parse(`Hallo Sarah,

Zaterdag 28 november: Bezoek aan de
kerstmarkt in Brugge
We wandelen samen over de markt en
drinken een glühwein.
Afspraak : 14u station Oostende
Contactpersoon: Tom
Opmerkingen: Tom verwittigen voor 20/11
Geen vervoer? Contacteer Tom.

Groetjes, Tom`);

  assert.equal(rest.length, 0);
  assert.equal(a.title, 'Bezoek aan de kerstmarkt in Brugge');
  assert.equal(a.desc, 'We wandelen samen over de markt en drinken een glühwein.');
  assert.equal(a.afspraak, '14u station Oostende');
  assert.equal(a.opm, 'Tom verwittigen voor <b>20/11</b><br>Geen vervoer? Contacteer Tom.');
});

test('meerdere activiteiten en een blok aankondigingen', () => {
  const list = parse(`Activiteiten september & oktober 2026
Maandag 07/09: Quiz
Afspraak: 13u30
Vrijdag 18/09: Comedy
Afspraak: 19u30
AANKONDIGINGEN
Woensdag 23/12: 50 jaar Tim`);

  assert.deepEqual(
    list.map((a) => a.title),
    ['Quiz', 'Comedy', '50 jaar Tim'],
  );
  assert.deepEqual(
    list.map((a) => a.type),
    ['activiteit', 'activiteit', 'aankondiging'],
  );
});

test('ongeldige datum geeft een lege datum', () => {
  const [a] = parse('Maandag 31/02: Bestaat niet');
  assert.equal(a.date, '');
});

test('zonder titelregel wordt de eerste regel de titel', () => {
  const [a] = parse('Bezoek aan Roularta\nDatum nog te bepalen.\nContactpersoon: Marleen');
  assert.equal(a.title, 'Bezoek aan Roularta');
  assert.equal(a.desc, 'Datum nog te bepalen.');
  assert.equal(a.contact, 'Marleen');
});
