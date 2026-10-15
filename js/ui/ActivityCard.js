import { ActivityType, FIELDS } from '../model/Activity.js';
import { DAYS, DateUtil } from '../util/dates.js';
import { escapeHtml } from '../util/html.js';

const CHEVRON =
  '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/**
 * Eén kaart in de lijst: een kop (datum, titel, status) en, als ze open staat,
 * een formulier om alles aan te passen.
 */
export class ActivityCard {
  /**
   * @param {import('../model/Activity.js').Activity} activity
   * @param {import('../model/Program.js').Program} program
   * @param {{open: boolean, isNew: boolean, toast: import('./Toast.js').Toast, onToggle: Function, onDuplicate: Function}} options
   */
  constructor(activity, program, { open, isNew, toast, onToggle, onDuplicate }) {
    this.activity = activity;
    this.program = program;
    this.open = open;
    this.toast = toast;
    this.onToggle = onToggle;
    this.onDuplicate = onDuplicate;

    this.element = document.createElement('article');
    this.element.className = 'card' + (isNew ? ' new' : '');
    this.element.dataset.id = activity.id;
    if (open) this.element.setAttribute('open-state', '');
    this.element.innerHTML =
      `<button class="card-head" type="button" aria-expanded="${open}">${this.#headHtml()}</button>` +
      (open ? this.#warningsHtml() + this.#editorHtml() : '');

    this.element.querySelector('.card-head').addEventListener('click', () => this.onToggle(activity.id));
    if (open) this.#bindEditor();
  }

  /** Werkt de kop en de waarschuwingen bij zonder het formulier te herbouwen (focus blijft). */
  refresh() {
    this.element.querySelector('.card-head').innerHTML = this.#headHtml();
    if (!this.open) return;
    const old = this.element.querySelector('.warns');
    const html = this.#warningsHtml();
    if (old) old.outerHTML = html;
    else if (html) this.element.querySelector('.editor').insertAdjacentHTML('beforebegin', html);
  }

  /* ---------- HTML ---------- */

  #headHtml() {
    const a = this.activity;
    const d = a.dateObject;
    const warningCount = this.program.warningsFor(a).length;
    const date = d
      ? `<small>${DAYS[d.getDay()].slice(0, 2)}</small><b>${DateUtil.dayMonth(d)}</b>` +
        (d.getFullYear() !== this.program.period.year ? `<small>${d.getFullYear()}</small>` : '')
      : '<small>geen</small><b>––</b>';
    const chips = [
      a.contact ? `<span class="chip">${escapeHtml(a.contact)}</span>` : '',
      a.isAnnouncement ? '<span class="chip ann">Aankondiging</span>' : '',
      warningCount
        ? `<span class="chip warn">${warningCount} om na te kijken</span>`
        : '<span class="chip ok">In orde</span>',
    ].join('');
    return (
      `<div class="date">${date}</div>` +
      `<div class="card-main"><div class="card-title">${escapeHtml(a.title || '(zonder titel)')}</div><div class="card-sub">${chips}</div></div>` +
      CHEVRON
    );
  }

  #warningsHtml() {
    const warnings = this.program.warningsFor(this.activity);
    return warnings.length ? `<ul class="warns">${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '';
  }

  #editorHtml() {
    const a = this.activity;
    const id = a.id;
    const typeButton = (type, label) =>
      `<button type="button" data-type="${type}" aria-pressed="${a.type === type}">${label}</button>`;
    const richField = (key, label, full) =>
      `<div class="field${full ? ' full' : ''}"><span><mark>${label}</mark></span>` +
      `<div class="rich" contenteditable="true" role="textbox" aria-label="${label}" data-k="${key}" data-ph="${label}…">${a[key] || ''}</div></div>`;

    const fields = FIELDS.map(({ key, label }) =>
      key === 'contact'
        ? `<label class="field"><span><mark>${label}</mark></span><input type="text" id="e-contact-${id}" data-k="contact" list="contacts" value="${escapeHtml(a.contact)}"></label>`
        : richField(key, label, key === 'afspraak' || key === 'opm'),
    ).join('');

    return (
      '<div class="editor">' +
      `<label class="field"><span>Datum</span><input type="date" id="e-date-${id}" data-k="date" value="${escapeHtml(a.date)}"></label>` +
      `<div class="field"><span>Soort</span><div class="seg" role="group" aria-label="Soort">${typeButton(ActivityType.ACTIVITY, 'Activiteit')}${typeButton(ActivityType.ANNOUNCEMENT, 'Aankondiging')}</div></div>` +
      `<label class="field full"><span>Titel <small class="normal">(de dag en datum worden er automatisch voor gezet)</small></span><input type="text" id="e-title-${id}" data-k="title" value="${escapeHtml(a.title)}"></label>` +
      `<div class="field full"><span>Beschrijving</span><div class="rich tall" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Beschrijving" data-k="desc" data-ph="Wat gaan we doen?">${a.desc || ''}</div></div>` +
      fields +
      '<div class="editor-actions full">' +
      `<span class="source">${a.source ? 'Uit: ' + escapeHtml(a.source) + ' · ' : ''}Tip: selecteer tekst en druk Ctrl+B voor vet.</span>` +
      '<span class="editor-buttons"><button class="btn small" type="button" data-act="dup">Dupliceren</button>' +
      '<button class="btn small danger" type="button" data-act="del">Verwijderen</button></span>' +
      '</div></div>'
    );
  }

  /* ---------- gedrag ---------- */

  #bindEditor() {
    const { activity, program } = this;
    for (const el of this.element.querySelectorAll('[data-k]')) {
      const key = el.dataset.k;
      const read = () => (el.isContentEditable ? el.innerHTML : el.value);
      if (key === 'date') {
        // Datum pas doorgeven bij "change": de lijst wordt dan opnieuw gesorteerd.
        el.addEventListener('change', () => program.update(activity, key, read()));
      } else {
        el.addEventListener('input', () => program.update(activity, key, read()));
      }
      if (el.isContentEditable) {
        // Plakken zonder opmaak, anders komt allerlei e-mailopmaak mee.
        el.addEventListener('paste', (e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        });
      }
    }

    for (const button of this.element.querySelectorAll('[data-type]')) {
      button.addEventListener('click', () => program.setType(activity, button.dataset.type));
    }

    this.element.querySelector('[data-act="dup"]').addEventListener('click', () => this.onDuplicate(activity));

    // Verwijderen vraagt een tweede klik ter bevestiging.
    const del = this.element.querySelector('[data-act="del"]');
    del.addEventListener('click', () => {
      if (del.dataset.armed) {
        program.remove(activity);
        this.toast.show('Verwijderd');
        return;
      }
      del.dataset.armed = '1';
      del.textContent = 'Zeker? Klik nog eens';
      setTimeout(() => {
        if (!del.isConnected) return;
        delete del.dataset.armed;
        del.textContent = 'Verwijderen';
      }, 4000);
    });
  }
}
