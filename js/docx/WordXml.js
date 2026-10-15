import { escapeXml } from '../util/html.js';

/**
 * Bouwt stukjes WordprocessingML (de XML in een .docx) in de huisstijl van het programma:
 * Verdana 11 pt, regelafstand 1,5, titels vet in blauw (#2F5496), labels geel gemarkeerd.
 *
 * Volgorde van elementen volgt het OOXML-schema; Word is daar streng in.
 */
export class WordXml {
  static BLUE = '2F5496';
  static FONT_SIZE = 22; // halve punten → 11 pt
  static HEADING_SIZE = 28; // 14 pt

  /**
   * Run-eigenschappen.
   * @param {{bold?: boolean, color?: string, size?: number, highlight?: boolean}} o
   */
  static runProps({ bold = false, color = null, size = WordXml.FONT_SIZE, highlight = false } = {}) {
    return (
      '<w:rPr>' +
      '<w:rFonts w:ascii="Verdana" w:eastAsia="Arial" w:hAnsi="Verdana" w:cs="Arial"/>' +
      (bold ? '<w:b/>' : '<w:bCs/>') +
      (color ? `<w:color w:val="${color}"/>` : '') +
      `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
      (highlight ? '<w:highlight w:val="yellow"/>' : '') +
      '</w:rPr>'
    );
  }

  /**
   * Alinea-eigenschappen.
   * @param {{keepNext?: boolean, keepLines?: boolean, pageBreakBefore?: boolean, center?: boolean, run?: object}} o
   */
  static paragraphProps({
    keepNext = false,
    keepLines = false,
    pageBreakBefore = false,
    center = false,
    run = {},
  } = {}) {
    return (
      '<w:pPr>' +
      (keepNext ? '<w:keepNext/>' : '') +
      (keepLines ? '<w:keepLines/>' : '') +
      (pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
      '<w:spacing w:after="0" w:line="360" w:lineRule="auto"/>' +
      (center ? '<w:jc w:val="center"/>' : '') +
      WordXml.runProps(run) +
      '</w:pPr>'
    );
  }

  static run(text, props = {}) {
    return `<w:r>${WordXml.runProps(props)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  static lineBreak(props = {}) {
    return `<w:r>${WordXml.runProps(props)}<w:br/></w:r>`;
  }

  /** Segmenten {t, b} → runs. */
  static segments(segments, props = {}) {
    return segments.map((s) => WordXml.run(s.t, { ...props, bold: props.bold || s.b })).join('');
  }

  /** Meerdere regels in één alinea, gescheiden door een zachte regeleinde. */
  static lines(lines, props = {}) {
    return lines.map((line, i) => (i ? WordXml.lineBreak(props) : '') + WordXml.segments(line, props)).join('');
  }

  static paragraph(content, props = {}) {
    return `<w:p>${WordXml.paragraphProps(props)}${content}</w:p>`;
  }

  static emptyParagraph(props = {}) {
    return WordXml.paragraph('', props);
  }

  /** Gecentreerde blauwe kop zoals "Activiteiten november & december 2026". */
  static heading(text, { pageBreakBefore = false } = {}) {
    const run = { bold: true, color: WordXml.BLUE, size: WordXml.HEADING_SIZE };
    return (
      WordXml.paragraph(WordXml.run(text, run), { center: true, pageBreakBefore, keepNext: true, run }) +
      WordXml.emptyParagraph({ keepNext: true }) +
      WordXml.emptyParagraph({ keepNext: true })
    );
  }

  /**
   * Een kader met omranding: een tabel met één cel waarvan de rij niet mag splitsen,
   * zodat een activiteit nooit over twee pagina's verdeeld wordt.
   * @param {string[]} paragraphContents de runs van elke alinea in het kader
   * @param {number} width breedte in twips
   */
  static box(paragraphContents, width) {
    const border = (side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`;
    const borders = ['top', 'left', 'bottom', 'right'].map(border).join('');
    const cellMargins =
      '<w:top w:w="28" w:type="dxa"/><w:left w:w="85" w:type="dxa"/>' +
      '<w:bottom w:w="28" w:type="dxa"/><w:right w:w="85" w:type="dxa"/>';
    const paragraphs = paragraphContents.map((c) => WordXml.paragraph(c, { keepLines: true })).join('');
    return (
      '<w:tbl>' +
      `<w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders>` +
      `<w:tblLayout w:type="fixed"/><w:tblCellMar>${cellMargins}</w:tblCellMar>` +
      '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>' +
      `<w:tblGrid><w:gridCol w:w="${width}"/></w:tblGrid>` +
      `<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraphs}</w:tc></w:tr>` +
      '</w:tbl>'
    );
  }
}
