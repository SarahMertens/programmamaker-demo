import { Activity } from './Activity.js';
import { ActivityValidator } from './ActivityValidator.js';
import { Period } from './Period.js';

/**
 * Het programma dat je aan het maken bent: een periode en een lijst activiteiten.
 *
 * Program is een EventTarget en stuurt een "change"-event bij elke wijziging:
 *   detail.structural = true  → er kwam iets bij, ging iets weg of de volgorde veranderde
 *   detail.structural = false → enkel de inhoud van één activiteit veranderde (detail.activity)
 */
export class Program extends EventTarget {
  /** Contactpersonen die op de eerste pagina staan; aangevuld met wie in de lijst voorkomt. */
  static DEFAULT_CONTACTS = ['Anne', 'Bart', 'Sofie', 'Tom', 'Marleen'];

  constructor({ period = Period.upcoming(), activities = [], templateName = null } = {}) {
    super();
    this.period = period;
    /** @type {Activity[]} */
    this.activities = activities;
    this.templateName = templateName;
  }

  /* ---------- opslaan en laden ---------- */

  /** Hetzelfde formaat als het projectbestand ("items" voor compatibiliteit). */
  toJSON() {
    return {
      app: 'programmamaker',
      version: 1,
      period: this.period.toJSON(),
      items: this.activities.map((a) => a.toJSON()),
      tplName: this.templateName,
    };
  }

  static fromJSON(json) {
    if (!json || !Array.isArray(json.items)) throw new Error('Dit is geen projectbestand van de programmamaker.');
    return new Program({
      period: Period.fromJSON(json.period),
      activities: json.items.map((item) => Activity.fromJSON(item)),
      templateName: json.tplName || null,
    });
  }

  /** Neemt de inhoud van een ander programma over (bv. na "Projectbestand openen"). */
  replaceWith(other) {
    this.period = other.period;
    this.activities = other.activities;
    this.#emit(true);
  }

  /* ---------- lezen ---------- */

  /** Alle activiteiten op datum. */
  get sorted() {
    return [...this.activities].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  get regular() {
    return this.sorted.filter((a) => !a.isAnnouncement);
  }

  get announcements() {
    return this.sorted.filter((a) => a.isAnnouncement);
  }

  find(id) {
    return this.activities.find((a) => a.id === id) || null;
  }

  warningsFor(activity) {
    return ActivityValidator.check(activity, this);
  }

  /** Andere activiteit met dezelfde datum en (bijna) dezelfde titel. */
  findDuplicateOf(activity) {
    const key = (a) => a.title.trim().toLowerCase().slice(0, 14);
    return (
      this.activities.find((o) => o !== activity && o.date && o.date === activity.date && key(o) === key(activity)) ||
      null
    );
  }

  get contacts() {
    const names = new Set(Program.DEFAULT_CONTACTS);
    for (const a of this.activities) if (a.contact) names.add(a.contact);
    return [...names];
  }

  /* ---------- wijzigen ---------- */

  add(activities) {
    for (const activity of activities) {
      activity.applyAutoType(this.period);
      this.activities.push(activity);
    }
    this.#emit(true);
  }

  remove(activity) {
    this.activities = this.activities.filter((a) => a !== activity);
    this.#emit(true);
  }

  /** Meldt dat de inhoud van een activiteit veranderde. Een datumwijziging verandert de volgorde. */
  update(activity, key, value) {
    activity[key] = value;
    if (key === 'date') {
      activity.sentDay = '';
      activity.applyAutoType(this.period);
    }
    this.#emit(key === 'date', activity);
  }

  setType(activity, type) {
    activity.type = type;
    activity.typeManual = true;
    this.#emit(true);
  }

  setPeriod(period) {
    this.period = period;
    this.activities.forEach((a) => a.applyAutoType(period));
    this.#emit(true);
  }

  setTemplateName(name) {
    this.templateName = name;
    this.#emit(false);
  }

  /**
   * Schuift door naar de volgende twee maanden: oude activiteiten verdwijnen,
   * latere aankondigingen blijven en worden zo nodig gewone activiteiten.
   * @returns {number} aantal gewiste activiteiten
   */
  startNext() {
    const next = this.period.next();
    const before = this.activities.length;
    this.activities = this.activities.filter((a) => !a.dateObject || a.dateObject >= next.start);
    this.activities.forEach((a) => {
      a.typeManual = false;
      a.applyAutoType(next);
    });
    this.period = next;
    this.#emit(true);
    return before - this.activities.length;
  }

  /** Hoeveel activiteiten startNext() zou wissen. */
  countBeforeNext() {
    const start = this.period.next().start;
    return this.activities.filter((a) => a.dateObject && a.dateObject < start).length;
  }

  #emit(structural, activity = null) {
    this.dispatchEvent(new CustomEvent('change', { detail: { structural, activity } }));
  }
}
