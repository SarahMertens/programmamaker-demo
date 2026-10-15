/**
 * Datumhulpmiddelen in het Nederlands.
 * Datums worden in het model opgeslagen als ISO-tekst "JJJJ-MM-DD".
 */

export const DAYS = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

export const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

const MS_PER_DAY = 864e5;

export class DateUtil {
  /** Twee cijfers: 7 → "07". */
  static pad(n) {
    return String(n).padStart(2, '0');
  }

  /** "2026-11-09" → Date (lokale tijd), of null. */
  static parseISO(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  /** Date → "2026-11-09". */
  static toISO(date) {
    return `${date.getFullYear()}-${DateUtil.pad(date.getMonth() + 1)}-${DateUtil.pad(date.getDate())}`;
  }

  /** Date → "Maandag". */
  static dayName(date) {
    const d = DAYS[date.getDay()];
    return d[0].toUpperCase() + d.slice(1);
  }

  /** Date → "09/11". */
  static dayMonth(date) {
    return `${DateUtil.pad(date.getDate())}/${DateUtil.pad(date.getMonth() + 1)}`;
  }

  /** Bestaat deze dag/maand/jaar echt? (31/02 niet) */
  static isValid(day, month, year) {
    const d = new Date(year, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day;
  }

  /**
   * Raadt het jaar als de afzender enkel dag/maand schreef.
   * Een datum die meer dan ~3 maanden voorbij is, ligt waarschijnlijk volgend jaar.
   */
  static guessYear(day, month, hintYear = null, reference = new Date()) {
    if (hintYear) return hintYear;
    let year = reference.getFullYear();
    const candidate = new Date(year, month - 1, day);
    const daysDiff = (reference - candidate) / MS_PER_DAY;
    if (daysDiff > 100) year++;
    else if (daysDiff < -265) year--;
    return year;
  }

  /** Maandnaam ("november") → 11, of 0 als onbekend. */
  static monthFromName(name) {
    return MONTHS.indexOf(String(name || '').toLowerCase()) + 1;
  }
}
