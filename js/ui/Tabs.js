import { $ } from '../util/html.js';

/** Op een smal scherm (gsm, tablet) wissel je tussen de lijst en het voorbeeld. */
export class Tabs {
  /** @param {{onPreview: () => void}} actions */
  constructor({ onPreview }) {
    this.main = $('#main');
    this.listTab = $('#tabList');
    this.previewTab = $('#tabPreview');
    this.onPreview = onPreview;
    this.listTab.addEventListener('click', () => this.select('list'));
    this.previewTab.addEventListener('click', () => this.select('preview'));
  }

  select(tab) {
    this.main.dataset.tab = tab;
    this.listTab.setAttribute('aria-selected', String(tab === 'list'));
    this.previewTab.setAttribute('aria-selected', String(tab === 'preview'));
    if (tab === 'preview') this.onPreview();
  }
}
