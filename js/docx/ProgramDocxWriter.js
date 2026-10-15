import { FIELDS } from '../model/Activity.js';
import { RichText } from '../model/RichText.js';
import { DOCX_MIME, NS, Ooxml } from './ooxml.js';
import { WordTemplate } from './WordTemplate.js';
import { WordXml } from './WordXml.js';

/**
 * Maakt het Word-bestand van een programma.
 * Vertrekt van het sjabloon, behoudt pagina 1 en vervangt de rest door de activiteiten.
 */
export class ProgramDocxWriter {
  /** @param {WordTemplate} template */
  constructor(template) {
    this.template = template;
  }

  /**
   * @param {import('../model/Program.js').Program} program
   * @returns {Promise<Blob>}
   */
  async build(program) {
    const zip = await JSZip.loadAsync(this.template.buffer);
    const doc = Ooxml.parse(await zip.file('word/document.xml').async('string'));
    const { body, nodes, cut, titleParagraph, sectPr } = WordTemplate.analyze(doc);

    if (titleParagraph) Ooxml.setParagraphText(titleParagraph, `Programma ${program.period.label()}`);
    for (const node of nodes.slice(cut)) if (node !== sectPr) body.removeChild(node);

    const width = WordTemplate.textWidth(sectPr);
    const fragment = Ooxml.parse(`<w:root xmlns:w="${NS.W}">${this.#bodyXml(program, width)}</w:root>`);
    if (fragment.getElementsByTagName('parsererror').length)
      throw new Error('Interne fout bij het opbouwen van het document.');
    for (const node of [...fragment.documentElement.childNodes]) {
      body.insertBefore(doc.importNode(node, true), sectPr); // sectPr null → achteraan
    }

    let xml = new XMLSerializer().serializeToString(doc);
    if (!xml.startsWith('<?xml')) xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
    zip.file('word/document.xml', xml);
    return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
  }

  #bodyXml(program, width) {
    const spacer = WordXml.emptyParagraph() + WordXml.emptyParagraph();
    let xml = WordXml.heading(`Activiteiten ${program.period.label({ ampersand: true })}`, { pageBreakBefore: true });
    for (const activity of program.regular) xml += this.#activityBox(activity, program, width) + spacer;

    const announcements = program.announcements;
    if (announcements.length) {
      xml += WordXml.heading('AANKONDIGINGEN');
      for (const activity of announcements) xml += this.#activityBox(activity, program, width) + spacer;
    }
    return xml;
  }

  #activityBox(activity, program, width) {
    const paragraphs = [WordXml.run(activity.heading(program.period.year), { bold: true, color: WordXml.BLUE })];

    for (const line of RichText.fromHtml(activity.desc)) paragraphs.push(WordXml.segments(line));

    for (const { key, label } of FIELDS) {
      const lines =
        key === 'contact'
          ? activity.contact
            ? [[{ t: activity.contact, b: false }]]
            : []
          : RichText.fromHtml(activity[key]);
      if (!lines.map(RichText.plain).join('').trim()) continue;
      const [first, ...rest] = lines;
      paragraphs.push(
        WordXml.run(label, { highlight: true }) + WordXml.lines([[{ t: ': ', b: false }, ...first], ...rest]),
      );
    }
    return WordXml.box(paragraphs, width);
  }
}
