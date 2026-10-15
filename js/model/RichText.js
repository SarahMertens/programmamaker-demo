import { escapeHtml } from '../util/html.js';

/**
 * Opgemaakte tekst zonder poespas: enkel vet en regeleinden.
 *
 * Intern werken we met "regels" (Line): een lijst van segmenten {t: tekst, b: vet}.
 * In het model bewaren we dezelfde inhoud als eenvoudige HTML ("<b>vet</b><br>…"),
 * omdat de bewerkvelden in de app (contenteditable) die vorm gebruiken.
 *
 * @typedef {{t: string, b: boolean}} Segment
 * @typedef {Segment[]} Line
 */
export class RichText {
  /** Voegt aangrenzende segmenten met dezelfde opmaak samen en ruimt spaties op. */
  static normalize(segments) {
    const out = [];
    for (const seg of segments) {
      const text = (seg.t || '').replace(/[  ]{2,}/g, ' ');
      if (!text) continue;
      const last = out[out.length - 1];
      if (last && last.b === !!seg.b) last.t += text;
      else out.push({ t: text, b: !!seg.b });
    }
    return out;
  }

  /** Platte tekst van een regel. */
  static plain(line) {
    return line.map((s) => s.t).join('');
  }

  /** Verwijdert de eerste n tekens van een regel (behoudt opmaak van de rest). */
  static slice(line, n) {
    const out = [];
    let skip = n;
    for (const seg of line) {
      if (skip >= seg.t.length) {
        skip -= seg.t.length;
        continue;
      }
      out.push({ t: seg.t.slice(skip), b: seg.b });
      skip = 0;
    }
    return out;
  }

  /** Haalt witruimte aan begin en einde weg. */
  static trim(line) {
    const l = line.map((s) => ({ ...s }));
    while (l.length && !l[0].t.trim()) l.shift();
    if (l.length) l[0].t = l[0].t.replace(/^\s+/, '');
    while (l.length && !l[l.length - 1].t.trim()) l.pop();
    if (l.length) l[l.length - 1].t = l[l.length - 1].t.replace(/\s+$/, '');
    return RichText.normalize(l);
  }

  /** Regels → HTML voor het model. */
  static toHtml(lines) {
    return lines
      .map((line) => line.map((s) => (s.b ? `<b>${escapeHtml(s.t)}</b>` : escapeHtml(s.t))).join(''))
      .join('<br>');
  }

  /**
   * HTML (uit het model of uit een bewerkveld) → regels.
   * Herkent <b>/<strong>, font-weight en blokelementen (div/p) als nieuwe regel.
   * Werkt enkel in de browser (gebruikt het DOM).
   */
  static fromHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = html || '';
    const lines = [[]];
    const BLOCK = /^(DIV|P|LI|H\d|TR|UL|OL|TABLE|BLOCKQUOTE)$/;
    const current = () => lines[lines.length - 1];
    const newLine = () => lines.push([]);

    const walk = (node, bold) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          current().push({ t: child.nodeValue.replace(/ /g, ' ').replace(/[\r\n]+/g, ' '), b: bold });
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = child.tagName;
        if (tag === 'BR') {
          newLine();
          continue;
        }
        const weight = child.style?.fontWeight || '';
        const isBoldTag = tag === 'B' || tag === 'STRONG';
        const explicitNormal = !isBoldTag && (weight === 'normal' || (weight && +weight < 600));
        const childBold = explicitNormal ? false : bold || isBoldTag || weight === 'bold' || +weight >= 600;
        const isBlock = BLOCK.test(tag);
        if (isBlock && RichText.plain(current()).length) newLine();
        walk(child, childBold);
        if (isBlock && RichText.plain(current()).length) newLine();
      }
    };
    walk(template.content, false);

    const out = lines.map((l) => RichText.normalize(l));
    while (out.length && !RichText.plain(out[out.length - 1]).trim()) out.pop();
    while (out.length && !RichText.plain(out[0]).trim()) out.shift();
    return out;
  }

  /** HTML → platte tekst (regels gescheiden door \n). */
  static htmlToPlain(html) {
    return RichText.fromHtml(html).map(RichText.plain).join('\n');
  }

  /** Is er zichtbare tekst in deze HTML? */
  static isEmptyHtml(html) {
    return !String(html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}
