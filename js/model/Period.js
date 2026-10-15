import { MONTHS } from '../util/dates.js';
import { capitalize } from '../util/html.js';

/**
 * Een programma loopt altijd over twee maanden:
 * blok 0 = januari en februari, blok 1 = maart en april, … blok 5 = november en december.
 */
export class Period {
  static BLOCK_COUNT = 6;

  constructor(block, year) {
    this.block = Math.min(Math.max(+block || 0, 0), Period.BLOCK_COUNT - 1);
    this.year = +year || new Date().getFullYear();
  }

  /** Het eerstvolgende programma vanaf vandaag. */
  static upcoming(today = new Date()) {
    return new Period(0, today.getFullYear()).withMonthIndex(today.getMonth()).next();
  }

  static fromJSON(json) {
    return json ? new Period(json.block, json.year) : Period.upcoming();
  }

  toJSON() {
    return { block: this.block, year: this.year };
  }

  /** Periode die de gegeven maand (0–11) bevat, in hetzelfde jaar. */
  withMonthIndex(monthIndex) {
    return new Period(Math.floor(monthIndex / 2), this.year);
  }

  /** Maandnummers (0–11) van de twee maanden. */
  get months() {
    return [this.block * 2, this.block * 2 + 1];
  }

  get start() {
    return new Date(this.year, this.months[0], 1);
  }

  /** Laatste dag van de periode. */
  get end() {
    return new Date(this.year, this.months[1] + 1, 0);
  }

  /** "november en december 2026" of met ampersand: "november & december 2026". */
  label({ ampersand = false, withYear = true } = {}) {
    const [a, b] = this.months;
    const joined = `${MONTHS[a]}${ampersand ? ' & ' : ' en '}${MONTHS[b]}`;
    return withYear ? `${joined} ${this.year}` : joined;
  }

  /** "November en december" (voor keuzelijsten). */
  static blockName(block) {
    return capitalize(`${MONTHS[block * 2]} en ${MONTHS[block * 2 + 1]}`);
  }

  /** Valt deze datum in de periode? */
  contains(date) {
    if (!date) return false;
    return date.getFullYear() === this.year && this.months.includes(date.getMonth());
  }

  next() {
    return this.block + 1 >= Period.BLOCK_COUNT ? new Period(0, this.year + 1) : new Period(this.block + 1, this.year);
  }

  /** Bestandsnaam: "Programma_november_en_december_2026.docx". */
  fileName(extension = 'docx') {
    return `Programma_${this.label().replace(/ /g, '_')}.${extension}`;
  }
}
