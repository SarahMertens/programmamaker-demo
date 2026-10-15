import { NS, Ooxml } from '../docx/ooxml.js';
import { escapeHtml } from '../util/html.js';

const TWIPS_PER_PX = 15; // 1440 twips per inch, 96 px per inch
const DEFAULT_TAB = 708; // standaard tabstop in Word (1,25 cm)
const EMU_PER_PX = 9525;

/**
 * Tekent de eerste pagina van het Word-sjabloon na in HTML, voor het voorbeeld.
 * Ondersteunt wat in het programma voorkomt: vet, kleur, grootte, markering,
 * centreren, regelafstand, tabstops, tabellen en het logo.
 */
export class TemplatePageRenderer {
  /** @param {import('../docx/WordTemplate.js').WordTemplate} template */
  constructor(template) {
    this.template = template;
    this.canvas = document.createElement('canvas').getContext('2d');
  }

  /** HTML van pagina 1, met de juiste programmatitel. */
  render(programTitle) {
    const { titleParagraph } = this.template.layout;
    if (titleParagraph) Ooxml.setParagraphText(titleParagraph, programTitle);
    return this.template.firstPageNodes.map((node) => this.#node(node)).join('');
  }

  #node(node) {
    if (node.localName === 'p') return this.#paragraph(node);
    if (node.localName === 'tbl') return this.#table(node);
    return '';
  }

  #table(tbl) {
    const rows = Ooxml.all(tbl, 'tr')
      .map((tr) => {
        const cells = Ooxml.all(tr, 'tc').map(
          (tc) =>
            `<td>${Ooxml.all(tc, 'p')
              .map((p) => this.#paragraph(p))
              .join('')}</td>`,
        );
        return `<tr>${cells.join('')}</tr>`;
      })
      .join('');
    return `<table>${rows}</table>`;
  }

  #paragraph(p) {
    const pPr = Ooxml.child(p, 'pPr');
    const style = this.#paragraphStyle(pPr);
    const tabStops = pPr
      ? Ooxml.all(pPr, 'tab')
          .map((t) => +t.getAttributeNS(NS.W, 'pos'))
          .filter((x) => x > 0)
          .sort((a, b) => a - b)
      : [];

    // Regels (gescheiden door <w:br/>) bestaande uit stukken (gescheiden door tabs).
    const lines = [[{ html: '', width: 0 }]];
    const currentChunk = () => lines[lines.length - 1][lines[lines.length - 1].length - 1];

    for (const run of Ooxml.all(p, 'r')) {
      const runStyle = this.#runStyle(run);
      const addText = (text) => {
        if (!text) return;
        const chunk = currentChunk();
        chunk.html += runStyle ? `<span style="${runStyle}">${escapeHtml(text)}</span>` : escapeHtml(text);
        chunk.width += this.#measureTwips(text, runStyle);
      };
      for (const node of run.childNodes) {
        switch (node.localName) {
          case 't':
            addText(node.textContent);
            break;
          case 'tab':
            lines[lines.length - 1].push({ html: '', width: 0 });
            break;
          case 'br':
            lines.push([{ html: '', width: 0 }]);
            break;
          case 'drawing':
            currentChunk().html += this.#image(node);
            break;
        }
      }
    }

    const html = lines.map((chunks) => this.#layoutTabs(chunks, tabStops)).join('<br>');
    return `<p style="${style}">${html || '&nbsp;'}</p>`;
  }

  /** Plaatst stukken tekst op hun tabstop, zoals Word dat doet. */
  #layoutTabs(chunks, tabStops) {
    if (chunks.length < 2) return chunks[0].html;
    let x = 0;
    return chunks
      .map((chunk, i) => {
        if (i === chunks.length - 1) return chunk.html;
        const end = x + chunk.width;
        const stop = tabStops.find((s) => s > end + 20) ?? (Math.floor(end / DEFAULT_TAB) + 1) * DEFAULT_TAB;
        const width = (stop - x) / TWIPS_PER_PX;
        x = stop;
        return `<span style="display:inline-block;width:${width.toFixed(1)}px;white-space:nowrap">${chunk.html}</span>`;
      })
      .join('');
  }

  #paragraphStyle(pPr) {
    if (!pPr) return '';
    let style = '';
    const jc = Ooxml.val(Ooxml.child(pPr, 'jc'));
    if (jc === 'center') style += 'text-align:center;';
    if (jc === 'right' || jc === 'end') style += 'text-align:right;';
    const spacing = Ooxml.child(pPr, 'spacing');
    const line = spacing?.getAttributeNS(NS.W, 'line');
    if (line) style += `line-height:${(Math.max(1, +line / 240) * 1.22).toFixed(2)};`;
    return style;
  }

  #runStyle(run) {
    const rPr = Ooxml.child(run, 'rPr');
    if (!rPr) return '';
    let style = '';
    for (const prop of rPr.childNodes) {
      const v = prop.getAttributeNS ? Ooxml.val(prop) : null;
      switch (prop.localName) {
        case 'b':
          if (v !== '0' && v !== 'false') style += 'font-weight:700;';
          break;
        case 'color':
          if (v && v !== 'auto') style += `color:#${v};`;
          break;
        case 'sz':
          if (v) style += `font-size:${+v / 2}pt;`;
          break;
        case 'highlight':
          if (v && v !== 'none') style += `background:${v === 'yellow' ? '#ff0' : v};`;
          break;
      }
    }
    return style;
  }

  #image(drawing) {
    const blip = drawing.getElementsByTagNameNS(NS.A, 'blip')[0];
    const url = blip && this.template.images[blip.getAttributeNS(NS.R, 'embed')];
    if (!url) return '';
    const extent = drawing.getElementsByTagNameNS(NS.WP, 'extent')[0];
    const width = extent ? Math.round(+extent.getAttribute('cx') / EMU_PER_PX) : 160;
    return `<img src="${url}" alt="" style="width:${width}px;max-width:100%;vertical-align:top">`;
  }

  #measureTwips(text, runStyle) {
    const bold = /font-weight:700/.test(runStyle);
    const size = /font-size:([\d.]+)pt/.exec(runStyle)?.[1] || 11;
    this.canvas.font = `${bold ? 'bold ' : ''}${size}pt Verdana, "DejaVu Sans", sans-serif`;
    return this.canvas.measureText(text).width * TWIPS_PER_PX;
  }
}
