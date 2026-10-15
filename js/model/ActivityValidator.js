import { DAYS, DateUtil } from '../util/dates.js';
import { capitalize } from '../util/html.js';
import { FIELDS } from './Activity.js';
import { RichText } from './RichText.js';

/** Herkent "voor 04/09", "vóór 2/10", "tegen 15/09", "ten laatste woe 19/08", "voor 5 augustus". */
const DEADLINE_RE =
  /(?:v[oó]{2}r|tegen|uiterlijk|ten laatste(?:\s+\w{2,4}\.?)?)\s+(?:(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s+([a-z]+))/i;

/**
 * Controleert een activiteit en geeft begrijpelijke waarschuwingen terug.
 * Een waarschuwing blokkeert niets; ze vraagt enkel om even na te kijken.
 */
export class ActivityValidator {
  /**
   * @param {import('./Activity.js').Activity} activity
   * @param {import('./Program.js').Program} program
   * @returns {string[]}
   */
  static check(activity, program) {
    const warnings = [];
    const date = activity.dateObject;

    if (!date) warnings.push('Er is nog geen datum ingevuld.');
    if (date) {
      const wrongDay = ActivityValidator.#weekdayMismatch(activity, date);
      if (wrongDay) warnings.push(wrongDay);
    }
    if (!activity.title.trim()) warnings.push('De titel ontbreekt.');

    if (!activity.isAnnouncement) {
      const missing = FIELDS.filter((f) => f.key !== 'opm')
        .filter((f) => !RichText.htmlToPlain(activity[f.key] || '').trim())
        .map((f) => f.label);
      if (missing.length) warnings.push(`Nog niet ingevuld: ${missing.join(', ')}.`);

      if (date && !program.period.contains(date)) {
        warnings.push(
          `Deze datum valt buiten ${program.period.label()}. Zet het als aankondiging of pas de datum aan.`,
        );
      }
    }

    const deadline = date && ActivityValidator.#deadline(activity, date);
    if (deadline && deadline > date) {
      warnings.push(`De inschrijfdatum (${DateUtil.dayMonth(deadline)}) valt ná de activiteit zelf.`);
    }

    if (program.findDuplicateOf(activity)) warnings.push('Deze activiteit lijkt dubbel in de lijst te staan.');
    return warnings;
  }

  static #weekdayMismatch(activity, date) {
    if (!activity.sentDay || activity.sentDay === DAYS[date.getDay()]) return null;
    return (
      `In de tekst stond "${capitalize(activity.sentDay)}", maar ${DateUtil.dayMonth(date)}/${date.getFullYear()} ` +
      `is een ${DAYS[date.getDay()]}. In het programma staat nu "${DateUtil.dayName(date)}". Klopt de datum?`
    );
  }

  /** Zoekt de inschrijfdatum in Opmerkingen. */
  static #deadline(activity, date) {
    const m = DEADLINE_RE.exec(RichText.htmlToPlain(activity.opm || ''));
    if (!m) return null;
    const day = +(m[1] || m[3]);
    const month = m[2] ? +m[2] : DateUtil.monthFromName(m[4]);
    if (!day || !month) return null;
    // Een deadline in december voor een activiteit in januari hoort bij het vorige jaar.
    const year = month > date.getMonth() + 1 + 6 ? date.getFullYear() - 1 : date.getFullYear();
    return new Date(year, month - 1, day);
  }
}
