/** Namespaces van Office Open XML (het formaat achter .docx). */
export const NS = Object.freeze({
  W: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  A: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  R: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  WP: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  XML: 'http://www.w3.org/XML/1998/namespace',
});

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Hulpfuncties om in een geparst Word-document te zoeken. */
export class Ooxml {
  static parse(xml) {
    return new DOMParser().parseFromString(xml, 'application/xml');
  }

  /** Alle w:<name>-elementen onder node. */
  static all(node, name, ns = NS.W) {
    return [...node.getElementsByTagNameNS(ns, name)];
  }

  /** Eerste rechtstreekse kind met deze lokale naam. */
  static child(node, localName) {
    return [...node.childNodes].find((c) => c.localName === localName) || null;
  }

  static val(node) {
    return node?.getAttributeNS(NS.W, 'val') ?? null;
  }

  /** Is deze run vet? (<w:b/> of <w:b w:val="1"/>, maar niet w:val="0") */
  static isBold(run) {
    const rPr = Ooxml.child(run, 'rPr');
    const b = rPr && Ooxml.child(rPr, 'b');
    if (!b) return false;
    const v = Ooxml.val(b);
    return !(v === '0' || v === 'false');
  }

  /** Platte tekst van een alinea. */
  static paragraphText(p) {
    return Ooxml.all(p, 't')
      .map((t) => t.textContent)
      .join('');
  }

  static hasDrawing(p) {
    return Ooxml.all(p, 'drawing').length + Ooxml.all(p, 'pict').length > 0;
  }

  /** Vervangt de tekst van een alinea maar behoudt de opmaak van de eerste run. */
  static setParagraphText(p, text) {
    const texts = Ooxml.all(p, 't');
    if (!texts.length) return;
    texts[0].textContent = text;
    texts[0].setAttributeNS(NS.XML, 'xml:space', 'preserve');
    texts.slice(1).forEach((t) => (t.textContent = ''));
  }
}
