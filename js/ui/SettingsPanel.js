import { Program } from '../model/Program.js';
import { $, escapeHtml } from '../util/html.js';

/**
 * Onderaan: sjabloon kiezen, project bewaren/openen en een nieuw programma starten.
 */
export class SettingsPanel {
  /**
   * @param {import('../model/Program.js').Program} program
   * @param {{toast: import('./Toast.js').Toast, onTemplateFile: (file: File) => Promise<void>,
   *          onTemplateReset: () => Promise<void>, onSaveProject: () => void}} deps
   */
  constructor(program, { toast, onTemplateFile, onTemplateReset, onSaveProject }) {
    this.program = program;
    this.toast = toast;
    this.templateLabel = $('#tplName');
    this.nextWrap = $('#nextWrap');

    this.#bindFileButton('#btnTpl', '#tplInput', (file) => onTemplateFile(file));
    $('#btnTplReset').addEventListener('click', () => onTemplateReset());
    $('#btnSave').addEventListener('click', () => onSaveProject());
    this.#bindFileButton('#btnOpen', '#projInput', (file) => this.#openProject(file));
    this.#renderNextButton();
  }

  setTemplateName(name) {
    this.templateLabel.textContent = name || 'Programma september en oktober 2026 (standaard)';
  }

  #bindFileButton(buttonSelector, inputSelector, handler) {
    const input = $(inputSelector);
    $(buttonSelector).addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (file) await handler(file);
    });
  }

  async #openProject(file) {
    try {
      const loaded = Program.fromJSON(JSON.parse(await file.text()));
      this.program.replaceWith(loaded);
      this.toast.show('Project geopend');
    } catch {
      this.toast.show('Dit is geen projectbestand van de programmamaker.');
    }
  }

  /* ---------- nieuw programma (met bevestiging in de pagina) ---------- */

  #renderNextButton() {
    this.nextWrap.innerHTML = '<button class="btn small" id="btnNext" type="button">Nieuw programma starten</button>';
    $('#btnNext').addEventListener('click', () => this.#renderNextConfirm());
  }

  #renderNextConfirm() {
    const next = this.program.period.next();
    const label = next.label();
    const count = this.program.countBeforeNext();
    this.nextWrap.innerHTML =
      `<div class="confirm">Naar ${escapeHtml(label)}? ${count} oude activiteit${count === 1 ? '' : 'en'} worden gewist. ` +
      '<button class="btn small" type="button" id="nextYes">Ja, start</button>' +
      '<button class="btn small ghost" type="button" id="nextNo">Annuleren</button></div>';
    $('#nextNo').addEventListener('click', () => this.#renderNextButton());
    $('#nextYes').addEventListener('click', () => {
      this.program.startNext();
      this.#renderNextButton();
      this.toast.show(`Nieuw programma: ${label}`);
    });
  }
}
