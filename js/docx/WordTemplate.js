import { NS, Ooxml } from './ooxml.js';

/**
 * Een vorig programma dat dient als sjabloon.
 *
 * Alles vóór de kop "Activiteiten …" is de vaste eerste pagina (logo, uitleg,
 * contactpersonen, rekeningnummer). Die nemen we letterlijk over; enkel de regel
 * "Programma … 2026" wordt aangepast. Alles vanaf "Activiteiten" wordt vervangen.
 */
export class WordTemplate {
  /**
   * @param {ArrayBuffer} buffer
   * @param {string|null} name bestandsnaam (null = standaardsjabloon)
   */
  constructor(buffer, name, doc, images) {
    this.buffer = buffer;
    this.name = name;
    this.doc = doc;
    /** rId → blob-URL van afbeeldingen (voor het voorbeeld). */
    this.images = images;
    this.layout = WordTemplate.analyze(doc);
  }

  static async load(buffer, name = null) {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('Dit is geen geldig Word-bestand.');
    const doc = Ooxml.parse(await file.async('string'));
    WordTemplate.analyze(doc); // gooit een duidelijke fout als de kop ontbreekt
    const images = await WordTemplate.#loadImages(zip, doc);
    return new WordTemplate(buffer, name, doc, images);
  }

  /**
   * Zoekt de onderdelen van het document.
   * @returns {{body: Element, nodes: Element[], cut: number, titleParagraph: Element|null, sectPr: Element|null}}
   */
  static analyze(doc) {
    const body = doc.getElementsByTagNameNS(NS.W, 'body')[0];
    const nodes = [...body.childNodes].filter((n) => n.nodeType === Node.ELEMENT_NODE);
    const headingIndex = nodes.findIndex(
      (n) => n.localName === 'p' && /^\s*activiteiten\b/i.test(Ooxml.paragraphText(n)),
    );
    if (headingIndex < 0) {
      throw new Error('In dit document vond ik geen kop "Activiteiten …". Kies een vorig programma als sjabloon.');
    }
    // Lege alinea's die enkel dienen om naar pagina 2 te springen, laten we weg.
    let cut = headingIndex;
    while (cut > 0 && WordTemplate.#isEmptyParagraph(nodes[cut - 1])) cut--;

    const firstPage = nodes.slice(0, cut);
    const titleParagraph =
      firstPage.find((n) => n.localName === 'p' && /^\s*programma\b/i.test(Ooxml.paragraphText(n))) || null;
    const last = nodes[nodes.length - 1];
    const sectPr = last?.localName === 'sectPr' ? last : null;
    return { body, nodes, cut, titleParagraph, sectPr };
  }

  /** De elementen van de eerste pagina. */
  get firstPageNodes() {
    return this.layout.nodes.slice(0, this.layout.cut);
  }

  /** Eerste afbeelding (het logo), voor de kop van de app. */
  get logoUrl() {
    return Object.values(this.images)[0] || null;
  }

  /** Bruikbare tekstbreedte in twips (pagina min marges), voor de kaders. */
  static textWidth(sectPr) {
    const size = sectPr?.getElementsByTagNameNS(NS.W, 'pgSz')[0];
    const margin = sectPr?.getElementsByTagNameNS(NS.W, 'pgMar')[0];
    if (!size || !margin) return 10466;
    const w =
      +size.getAttributeNS(NS.W, 'w') - +margin.getAttributeNS(NS.W, 'left') - +margin.getAttributeNS(NS.W, 'right');
    return w > 2000 ? w : 10466;
  }

  static #isEmptyParagraph(node) {
    return node.localName === 'p' && !Ooxml.paragraphText(node).trim() && !Ooxml.hasDrawing(node);
  }

  static async #loadImages(zip, doc) {
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const rels = {};
    if (relsFile) {
      const relsDoc = Ooxml.parse(await relsFile.async('string'));
      for (const r of relsDoc.getElementsByTagName('Relationship'))
        rels[r.getAttribute('Id')] = r.getAttribute('Target');
    }
    const images = {};
    for (const blip of doc.getElementsByTagNameNS(NS.A, 'blip')) {
      const id = blip.getAttributeNS(NS.R, 'embed');
      const target = rels[id];
      if (!target || images[id]) continue;
      const file = zip.file('word/' + target.replace(/^\/?word\//, ''));
      if (!file) continue;
      const ext = target.split('.').pop().toLowerCase();
      const type = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      images[id] = URL.createObjectURL(new Blob([await file.async('arraybuffer')], { type }));
    }
    return images;
  }
}
