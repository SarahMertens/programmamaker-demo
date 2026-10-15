import { Program } from '../model/Program.js';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../util/html.js';

/**
 * Bewaart het programma en een eigen sjabloon in de browser (localStorage).
 * Alles blijft op deze computer; er gaat niets naar een server.
 */
export class ProgramStore {
  static PROGRAM_KEY = 'vna-programmamaker-v1';
  static TEMPLATE_KEY = 'vna-programmamaker-tpl-v1';

  /** @returns {Program|null} */
  loadProgram() {
    try {
      const raw = localStorage.getItem(ProgramStore.PROGRAM_KEY);
      return raw ? Program.fromJSON(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  saveProgram(program) {
    try {
      localStorage.setItem(ProgramStore.PROGRAM_KEY, JSON.stringify(program.toJSON()));
    } catch {
      /* opslag vol of geblokkeerd: werken gaat gewoon verder */
    }
  }

  /** @returns {ArrayBuffer|null} */
  loadTemplate() {
    try {
      const b64 = localStorage.getItem(ProgramStore.TEMPLATE_KEY);
      return b64 ? base64ToArrayBuffer(b64) : null;
    } catch {
      return null;
    }
  }

  /** @returns {boolean} gelukt */
  saveTemplate(buffer) {
    try {
      localStorage.setItem(ProgramStore.TEMPLATE_KEY, arrayBufferToBase64(buffer));
      return true;
    } catch {
      return false;
    }
  }

  clearTemplate() {
    try {
      localStorage.removeItem(ProgramStore.TEMPLATE_KEY);
    } catch {
      /* niets te doen */
    }
  }
}
