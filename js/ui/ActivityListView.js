import { $, escapeHtml } from '../util/html.js';
import { ActivityCard } from './ActivityCard.js';

/** De lijst "In dit programma": activiteiten op datum, aankondigingen apart. */
export class ActivityListView {
  /**
   * @param {import('../model/Program.js').Program} program
   * @param {{toast: import('./Toast.js').Toast}} deps
   */
  constructor(program, { toast }) {
    this.program = program;
    this.toast = toast;
    this.list = $('#list');
    this.summary = $('#summary');
    this.contacts = $('#contacts');
    /** @type {Map<string, ActivityCard>} */
    this.cards = new Map();
    this.openId = null;
    this.newIds = new Set();

    program.addEventListener('change', (e) => {
      if (e.detail.structural) this.render();
      else this.#refresh(e.detail.activity);
    });
  }

  /** Markeert nieuw toegevoegde activiteiten even; één activiteit gaat meteen open. */
  highlight(activities) {
    activities.forEach((a) => this.newIds.add(a.id));
    if (activities.length === 1) this.openId = activities[0].id;
    this.render();
    if (activities.length === 1) this.#scrollTo(activities[0].id);
  }

  open(id) {
    this.openId = id;
    this.render();
    this.#scrollTo(id);
  }

  render() {
    this.#renderSummary();
    this.#renderContacts();
    this.cards.clear();
    this.list.replaceChildren();

    const { regular, announcements } = this.program;
    if (!regular.length && !announcements.length) {
      this.list.innerHTML =
        '<div class="empty">Nog niets in dit programma. Sleep een Word-bestand hierboven of plak een e-mail.</div>';
      return;
    }
    regular.forEach((a) => this.list.append(this.#card(a).element));
    if (announcements.length) {
      const label = document.createElement('div');
      label.className = 'eyebrow group-label';
      label.textContent = 'Aankondigingen (achteraan in het programma)';
      this.list.append(label);
      announcements.forEach((a) => this.list.append(this.#card(a).element));
    }
    this.newIds.clear();
  }

  #card(activity) {
    if (this.openId && !this.program.find(this.openId)) this.openId = null;
    const card = new ActivityCard(activity, this.program, {
      open: this.openId === activity.id,
      isNew: this.newIds.has(activity.id),
      toast: this.toast,
      onToggle: (id) => {
        this.openId = this.openId === id ? null : id;
        this.render();
        if (this.openId) this.#scrollTo(id);
      },
      onDuplicate: (a) => {
        const copy = a.duplicate();
        this.program.add([copy]);
        this.highlight([copy]);
        this.toast.show('Kopie gemaakt. Pas de datum aan.');
      },
    });
    this.cards.set(activity.id, card);
    return card;
  }

  /** Enkel inhoud veranderd: kaart bijwerken (en andere kaarten, want "dubbel?" kan veranderen). */
  #refresh() {
    this.cards.forEach((card) => card.refresh());
    this.#renderSummary();
  }

  #renderSummary() {
    const all = this.program.activities;
    const announcements = all.filter((a) => a.isAnnouncement).length;
    const regular = all.length - announcements;
    const toCheck = all.filter((a) => this.program.warningsFor(a).length).length;
    this.summary.innerHTML =
      `<span class="chip">${regular} activiteit${regular === 1 ? '' : 'en'}</span>` +
      (announcements
        ? `<span class="chip ann">${announcements} aankondiging${announcements === 1 ? '' : 'en'}</span>`
        : '') +
      (toCheck ? `<span class="chip warn">${toCheck} om na te kijken</span>` : '');
  }

  #renderContacts() {
    this.contacts.innerHTML = this.program.contacts.map((n) => `<option value="${escapeHtml(n)}">`).join('');
  }

  #scrollTo(id) {
    const el = this.cards.get(id)?.element;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
