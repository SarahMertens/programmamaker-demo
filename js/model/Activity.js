import { DateUtil } from '../util/dates.js';
import { uid } from '../util/html.js';

export const ActivityType = Object.freeze({
  ACTIVITY: 'activiteit',
  ANNOUNCEMENT: 'aankondiging',
});

/** De vier vaste velden onderaan elke activiteit, in de volgorde van het programma. */
export const FIELDS = Object.freeze([
  { key: 'afspraak', label: 'Afspraak' },
  { key: 'prijs', label: 'Prijs' },
  { key: 'contact', label: 'Contactpersoon' },
  { key: 'opm', label: 'Opmerkingen' },
]);

/**
 * Eén activiteit (of aankondiging) in het programma.
 * Tekstvelden met opmaak (desc, afspraak, prijs, opm) bevatten eenvoudige HTML (zie RichText).
 * `contact` is platte tekst.
 */
export class Activity {
  constructor(data = {}) {
    this.id = data.id || uid();
    /** ISO-datum "JJJJ-MM-DD" of leeg. */
    this.date = data.date || '';
    this.title = data.title || '';
    /** De weekdag zoals de afzender die schreef (om fouten te herkennen). */
    this.sentDay = data.sentDay || '';
    this.type = data.type === ActivityType.ANNOUNCEMENT ? ActivityType.ANNOUNCEMENT : ActivityType.ACTIVITY;
    /** true als de gebruiker het soort zelf koos; dan passen we het niet meer automatisch aan. */
    this.typeManual = !!data.typeManual;
    /** Waar het vandaan komt (bestandsnaam of "e-mail"). */
    this.source = data.source || '';
    this.desc = data.desc || '';
    this.afspraak = data.afspraak || '';
    this.prijs = data.prijs || '';
    this.contact = data.contact || '';
    this.opm = data.opm || '';
  }

  static fromJSON(json) {
    return new Activity(json);
  }

  toJSON() {
    const { id, date, title, sentDay, type, typeManual, source, desc, afspraak, prijs, contact, opm } = this;
    return { id, date, title, sentDay, type, typeManual, source, desc, afspraak, prijs, contact, opm };
  }

  /** Kopie met nieuwe id. */
  duplicate() {
    return new Activity({ ...this.toJSON(), id: uid(), sentDay: '' });
  }

  get dateObject() {
    return DateUtil.parseISO(this.date);
  }

  get isAnnouncement() {
    return this.type === ActivityType.ANNOUNCEMENT;
  }

  /** Sorteersleutel: zonder datum komt achteraan. */
  get sortKey() {
    return this.date || '9999-99-99';
  }

  /**
   * Titelregel zoals in het programma: "Zaterdag 19/12: Kerstwandeling".
   * Ligt de datum in een ander jaar dan het programma, dan komt het jaar erbij.
   */
  heading(programYear) {
    const d = this.dateObject;
    if (!d) return this.title || '(zonder titel)';
    const year = d.getFullYear() !== programYear ? `/${d.getFullYear()}` : '';
    return `${DateUtil.dayName(d)} ${DateUtil.dayMonth(d)}${year}:${this.title ? ' ' + this.title : ''}`;
  }

  /** Zet het soort automatisch volgens de periode (tenzij de gebruiker het zelf koos). */
  applyAutoType(period) {
    const d = this.dateObject;
    if (this.typeManual || !d) return;
    if (period.contains(d)) this.type = ActivityType.ACTIVITY;
    else if (d > period.end) this.type = ActivityType.ANNOUNCEMENT;
  }
}
