import { ActivityParser } from '../parsing/ActivityParser.js';
import { DocxReader } from '../docx/DocxReader.js';

/** Bestanden openen, inlezen en downloaden. */
export class FileService {
  /** Laat de browser een bestand downloaden. */
  static download(fileName, blob) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 2000);
  }

  /** Haalt een bestand op dat naast de app staat (bv. het standaardsjabloon). */
  static async fetchArrayBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Kon ${url} niet laden (${response.status}).`);
    return response.arrayBuffer();
  }

  /**
   * Leest ingestuurde bestanden en zet ze om naar activiteiten.
   * @param {File[]} files
   * @returns {Promise<{activities: import('../model/Activity.js').Activity[], problems: string[]}>}
   */
  static async readActivities(files) {
    const activities = [];
    const problems = [];
    for (const file of files) {
      const parser = new ActivityParser({ hintYear: ActivityParser.yearFromFileName(file.name), source: file.name });
      try {
        if (/\.docx$/i.test(file.name)) {
          activities.push(...parser.parse(await DocxReader.readLines(await file.arrayBuffer())));
        } else if (/\.txt$/i.test(file.name)) {
          activities.push(...parser.parseText(await file.text()));
        } else if (/\.doc$/i.test(file.name)) {
          problems.push(`${file.name} is een oud Word-formaat. Open het in Word en kies Opslaan als → .docx.`);
        } else {
          problems.push(`${file.name} kan ik niet lezen. Gebruik een .docx-bestand.`);
        }
      } catch (error) {
        console.error(error);
        problems.push(`${file.name} kon ik niet openen.`);
      }
    }
    return { activities, problems };
  }
}
