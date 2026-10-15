import { RichText } from '../model/RichText.js';
import { NS, Ooxml } from './ooxml.js';

/**
 * Leest een ingestuurd Word-bestand (.docx) en geeft de tekst terug als regels met vet.
 * Werkt ook voor kaders in tabellen. Oude .doc-bestanden worden niet ondersteund.
 */
export class DocxReader {
  /**
   * @param {ArrayBuffer} buffer
   * @returns {Promise<import('../model/RichText.js').Line[]>}
   */
  static async readLines(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('Dit is geen geldig Word-bestand.');
    const doc = Ooxml.parse(await file.async('string'));

    const lines = [];
    for (const p of Ooxml.all(doc, 'p')) {
      if (DocxReader.#isNested(p)) continue; // alinea's in tekstvakken binnen een alinea
      let line = [];
      for (const run of Ooxml.all(p, 'r')) {
        const b = Ooxml.isBold(run);
        for (const node of run.childNodes) {
          switch (node.localName) {
            case 't':
              line.push({ t: node.textContent, b });
              break;
            case 'tab':
              line.push({ t: ' ', b });
              break;
            case 'noBreakHyphen':
              line.push({ t: '-', b });
              break;
            case 'br':
            case 'cr':
              lines.push(RichText.normalize(line));
              line = [];
              break;
          }
        }
      }
      lines.push(RichText.normalize(line));
    }
    return lines;
  }

  static #isNested(p) {
    for (let a = p.parentNode; a; a = a.parentNode) {
      if (a.localName === 'p' && a.namespaceURI === NS.W) return true;
    }
    return false;
  }
}
