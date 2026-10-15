import { FIELDS } from '../model/Activity.js';
import { RichText } from '../model/RichText.js';
import { escapeHtml } from '../util/html.js';
import { TemplatePageRenderer } from './TemplatePageRenderer.js';

const PAGE_WIDTH = 794; // A4 bij 96 dpi
const PAGE_HEIGHT = 1123;
const PAGE_MARGINS = 96 + 30; // boven + onder + paginanummer

/**
 * Toont het programma als A4-pagina's, zo dicht mogelijk bij het Word-resultaat.
 * De paginering is een benadering: kaders worden niet gesplitst, koppen blijven bij
 * het eerste kader.
 */
export class PreviewRenderer {
  /**
   * @param {{sheets: HTMLElement, scroller: HTMLElement, measure: HTMLElement, info: HTMLElement}} elements
   */
  constructor({ sheets, scroller, measure, info }) {
    this.sheets = sheets;
    this.scroller = scroller;
    this.measure = measure;
    this.info = info;
    this.template = null;
    this.firstPage = null;
    new ResizeObserver(() => this.fitToWidth()).observe(scroller);
  }

  /** @param {import('../docx/WordTemplate.js').WordTemplate} template */
  setTemplate(template) {
    this.template = template;
    this.firstPage = new TemplatePageRenderer(template);
  }

  /** @param {import('../model/Program.js').Program} program */
  render(program) {
    if (!this.firstPage) return;
    const pageOne = this.firstPage.render(`Programma ${program.period.label()}`);
    const pages = this.#paginate(this.#blocks(program));

    let html = this.#sheet(pageOne, 1);
    pages.forEach((blocks, i) => (html += this.#sheet(blocks.join(''), i + 2)));
    this.sheets.innerHTML = html;
    this.info.textContent = `${pages.length + 1} pagina’s · paginering kan in Word licht afwijken`;
    this.fitToWidth();
  }

  /** Schaalt de pagina's zodat ze in het paneel passen. */
  fitToWidth() {
    const scale = Math.min(1, (this.scroller.clientWidth - 8) / PAGE_WIDTH);
    this.sheets.style.width = `${PAGE_WIDTH}px`;
    this.sheets.style.transform = `scale(${scale})`;
    this.sheets.style.marginBottom = `${-(1 - scale) * this.sheets.offsetHeight}px`;
  }

  #sheet(content, number) {
    return `<div class="sheet">${content}<div class="pno">${number}</div></div>`;
  }

  /** Bouwt de blokken na pagina 1: koppen en kaders. */
  #blocks(program) {
    const blocks = [
      {
        html: `<h3 class="doc-h">Activiteiten ${escapeHtml(program.period.label({ ampersand: true }))}</h3>`,
        keepWithNext: true,
      },
    ];
    for (const a of program.regular) blocks.push({ html: this.#box(a, program) });
    const announcements = program.announcements;
    if (announcements.length) {
      blocks.push({ html: '<h3 class="doc-h ann">AANKONDIGINGEN</h3>', keepWithNext: true });
      for (const a of announcements) blocks.push({ html: this.#box(a, program) });
    }
    return blocks;
  }

  #box(activity, program) {
    let html = `<div class="box"><p class="t">${escapeHtml(activity.heading(program.period.year))}</p>`;
    for (const line of RichText.fromHtml(activity.desc)) html += `<p>${RichText.toHtml([line])}</p>`;
    for (const { key, label } of FIELDS) {
      const value =
        key === 'contact' ? escapeHtml(activity.contact) : RichText.toHtml(RichText.fromHtml(activity[key]));
      if (RichText.isEmptyHtml(value)) continue;
      html += `<p><span class="hl">${label}</span>: ${value}</p>`;
    }
    return html + '</div>';
  }

  /** Verdeelt blokken over pagina's door ze te meten in een verborgen pagina. */
  #paginate(blocks) {
    const usable = PAGE_HEIGHT - PAGE_MARGINS;
    this.measure.innerHTML = blocks.map((b) => b.html).join('');
    const heights = [...this.measure.children].map((el) => {
      const cs = getComputedStyle(el);
      return el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    });

    const pages = [[]];
    let used = 0;
    blocks.forEach((block, i) => {
      let needed = heights[i];
      if (block.keepWithNext && i + 1 < blocks.length) needed += Math.min(heights[i + 1], usable / 3);
      if (used > 0 && used + needed > usable) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(block.html);
      used += heights[i];
    });
    return pages;
  }
}
