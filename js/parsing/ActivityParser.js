import { Activity, ActivityType, FIELDS } from '../model/Activity.js';
import { RichText } from '../model/RichText.js';
import { DAYS, DateUtil, MONTHS } from '../util/dates.js';

/**
 * Zet ingestuurde tekst (uit Word of een e-mail) om naar activiteiten.
 *
 * Herkent de vaste opbouw van het programma:
 *   Zaterdag 19/12: Titel            ← titelregel (dag + datum)
 *   beschrijving…                    ← alles tot het eerste veld
 *   Afspraak: …                      ← velden; volgende regels horen bij hetzelfde veld
 *   Prijs: …
 *   Contactpersoon: …
 *   Opmerkingen: …
 * Meerdere activiteiten na elkaar mag (bv. een volledig vorig programma).
 * Deze klasse gebruikt geen DOM en is dus ook in Node te testen.
 */
export class ActivityParser {
  static TITLE_RE = new RegExp(
    `^\\s*(${DAYS.join('|')})\\s+(\\d{1,2})\\s*` +
      `(?:[\\/.\\-]\\s*(\\d{1,2})(?:\\s*[\\/.\\-]\\s*(\\d{2,4}))?` + // 19/12 of 19/12/2026
      `|\\s+(${MONTHS.join('|')})(?:\\s+(\\d{4}))?)` + //               of 19 december (2026)
      `\\s*(?:[:\\-–—]\\s*)?(.*)$`,
    'i',
  );

  static FIELD_RE =
    /^\s*(afspraak|prijs|contactpersonen|contactpersoon|contact|opmerkingen|opmerking)\s*:\s*(?::\s*)?/i;
  static ANNOUNCEMENTS_RE = /^aankondiging(en)?\s*:?$/i;
  static SECTION_RE = /^activiteiten\b/i;
  static SIGN_OFF_RE =
    /^(groet(jes|en)?|(met )?(vriendelijke |hartelijke |warme )?groet(en)?|mvg|vg|alvast bedankt|dank (je|u)|bedankt|tot (dan|later|binnenkort))\b/i;
  static DEADLINE_DATE_RE =
    /(?:v[oó]{2}r|tegen|uiterlijk|ten laatste(?:\s+\w{2,4}\.?)?)\s+(\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?|\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december))/i;

  /**
   * @param {object} [options]
   * @param {number|null} [options.hintYear] jaar uit de bestandsnaam (bv. 20261207_…)
   * @param {string} [options.source] waar de tekst vandaan komt
   * @param {Date} [options.today] referentiedatum om het jaar te raden
   */
  constructor({ hintYear = null, source = '', today = new Date() } = {}) {
    this.hintYear = hintYear;
    this.source = source;
    this.today = today;
  }

  /** Platte tekst (bv. geplakt uit een e-mail) → regels. */
  static linesFromText(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .map((t) => [{ t, b: false }]);
  }

  /** "20261207_Quiz.docx" → 2026. */
  static yearFromFileName(name) {
    const m = /(20\d{2})(\d{2})(\d{2})/.exec(name || '');
    return m ? +m[1] : null;
  }

  parseText(text) {
    return this.parse(ActivityParser.linesFromText(text));
  }

  /**
   * @param {import('../model/RichText.js').Line[]} rawLines
   * @returns {Activity[]}
   */
  parse(rawLines) {
    const lines = this.#joinBrokenLines(rawLines.map(RichText.trim).filter((l) => RichText.plain(l).trim()));
    const drafts = [];
    let draft = null;
    let field = null; // het veld waar vervolgregels bij horen
    let mode = ActivityType.ACTIVITY;
    let preamble = []; // regels vóór de eerste titel
    let skipping = false; // na een groet ("Groetjes, Bart") tot de volgende titel

    const finish = () => {
      if (draft) drafts.push(draft);
      draft = null;
      field = null;
    };

    for (const line of lines) {
      const text = RichText.plain(line).trim();

      if (ActivityParser.ANNOUNCEMENTS_RE.test(text)) {
        finish();
        mode = ActivityType.ANNOUNCEMENT;
        continue;
      }
      if (ActivityParser.SECTION_RE.test(text) && text.length < 60) {
        finish();
        mode = ActivityType.ACTIVITY;
        continue;
      }

      const title = ActivityParser.TITLE_RE.exec(text);
      if (!title && skipping) continue;
      if (!title && ActivityParser.SIGN_OFF_RE.test(text)) {
        finish();
        skipping = true;
        continue;
      }
      if (title) {
        skipping = false;
        finish();
        draft = this.#draftFromTitle(title, mode);
        continue;
      }

      const label = ActivityParser.FIELD_RE.exec(text);
      if (label && !draft) {
        draft = this.#emptyDraft(mode);
        if (preamble.length) {
          draft.title = RichText.plain(preamble[0]).trim();
          draft.descLines = preamble.slice(1);
        }
        preamble = [];
      }
      if (label) {
        field = ActivityParser.#fieldKey(label[1]);
        const labelLength =
          RichText.plain(line).length - RichText.plain(line).replace(ActivityParser.FIELD_RE, '').length;
        const value = RichText.trim(RichText.slice(line, labelLength));
        (draft.fieldLines[field] ||= []).push(value);
        continue;
      }

      if (!draft) preamble.push(line);
      else if (field) draft.fieldLines[field].push(line);
      else draft.descLines.push(line);
    }
    finish();

    // Geen titelregel gevonden: eerste regel wordt de titel.
    if (!drafts.length && preamble.length) {
      const d = this.#emptyDraft(mode);
      d.title = RichText.plain(preamble[0]).trim();
      d.descLines = preamble.slice(1);
      drafts.push(d);
    }
    return drafts.map((d) => this.#toActivity(d));
  }

  /* ---------- intern ---------- */

  #emptyDraft(type) {
    return { date: '', title: '', sentDay: '', type, descLines: [], fieldLines: {} };
  }

  #draftFromTitle(m, mode) {
    const day = +m[2];
    const month = m[3] ? +m[3] : DateUtil.monthFromName(m[5]);
    let year = m[4] || m[6];
    year = year ? (+year < 100 ? 2000 + +year : +year) : null;
    year = DateUtil.guessYear(day, month, year || this.hintYear, this.today);
    const draft = this.#emptyDraft(mode);
    draft.date = DateUtil.isValid(day, month, year) ? DateUtil.toISO(new Date(year, month - 1, day)) : '';
    draft.title = (m[7] || '').trim().replace(/^[:\-–\s]+/, '');
    draft.sentDay = m[1].toLowerCase();
    return draft;
  }

  static #fieldKey(word) {
    const w = word.toLowerCase();
    if (w === 'afspraak') return 'afspraak';
    if (w === 'prijs') return 'prijs';
    if (w.startsWith('contact')) return 'contact';
    return 'opm';
  }

  #isStructural(line) {
    const t = RichText.plain(line);
    return (
      ActivityParser.TITLE_RE.test(t) ||
      ActivityParser.FIELD_RE.test(t) ||
      ActivityParser.ANNOUNCEMENTS_RE.test(t.trim())
    );
  }

  /**
   * Plakt afgebroken zinnen weer aan elkaar: een regel die met een kleine letter begint
   * terwijl de vorige niet op een leesteken eindigt (typisch voor e-mails en Word-plakwerk).
   */
  #joinBrokenLines(lines) {
    const out = [];
    for (const line of lines) {
      const prev = out[out.length - 1];
      const startsLower = /^[a-zà-ÿ]/.test(RichText.plain(line));
      const prevOpen = prev && !/[.!?:;…)"'”’»]\s*$/.test(RichText.plain(prev));
      if (prev && prevOpen && startsLower && !this.#isStructural(line)) {
        out[out.length - 1] = RichText.normalize([...prev, { t: ' ', b: false }, ...line]);
      } else {
        out.push(line);
      }
    }
    return out;
  }

  /** Zet de inschrijfdatum in het vet ("voor **18/12**"), zoals in het programma gebruikelijk. */
  static #boldDeadline(line) {
    if (line.some((s) => s.b)) return line;
    const text = RichText.plain(line);
    const m = ActivityParser.DEADLINE_DATE_RE.exec(text);
    if (!m) return line;
    const end = m.index + m[0].length;
    const start = end - m[1].length;
    return RichText.normalize([
      { t: text.slice(0, start), b: false },
      { t: text.slice(start, end), b: true },
      { t: text.slice(end), b: false },
    ]);
  }

  #toActivity(draft) {
    const data = {
      date: draft.date,
      title: draft.title,
      sentDay: draft.sentDay,
      type: draft.type,
      source: this.source,
    };
    data.desc = RichText.toHtml(draft.descLines);
    for (const { key } of FIELDS) {
      let lines = draft.fieldLines[key] || [];
      if (key === 'contact') {
        data.contact = lines.map(RichText.plain).join(' ').trim().replace(/\.$/, '');
        continue;
      }
      if (key === 'opm') lines = lines.map(ActivityParser.#boldDeadline);
      // "0<b>4/12</b>" (half vet getypt) → "<b>04/12</b>"
      data[key] = RichText.toHtml(lines).replace(/(\d)<b>(\d)/g, '<b>$1$2');
    }
    return new Activity(data);
  }
}
