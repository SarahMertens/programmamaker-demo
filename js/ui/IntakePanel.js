import { Activity } from '../model/Activity.js';
import { ActivityParser } from '../parsing/ActivityParser.js';
import { FileService } from '../services/FileService.js';
import { $ } from '../util/html.js';

/**
 * "Iets binnengekregen?": Word-bestanden slepen of kiezen, e-mailtekst plakken
 * of een lege activiteit toevoegen.
 */
export class IntakePanel {
  /**
   * @param {{onAdd: (activities: Activity[]) => void, onExamples: () => void, toast: import('./Toast.js').Toast}} deps
   */
  constructor({ onAdd, onExamples, toast }) {
    this.onAdd = onAdd;
    this.toast = toast;
    this.dropZone = $('#drop');
    this.fileInput = $('#fileInput');
    this.pasteBox = $('#pasteBox');
    this.pasteText = $('#pasteText');
    this.#bindFiles();
    this.#bindPaste();
    $('#btnBlank').addEventListener('click', () => this.onAdd([new Activity()]));
    $('#btnExamples').addEventListener('click', onExamples);
  }

  #bindFiles() {
    const { dropZone, fileInput } = this;
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', () => {
      this.#readFiles([...fileInput.files]);
      fileInput.value = '';
    });

    for (const type of ['dragenter', 'dragover']) {
      dropZone.addEventListener(type, (e) => {
        e.preventDefault();
        dropZone.classList.add('over');
      });
    }
    for (const type of ['dragleave', 'drop']) {
      dropZone.addEventListener(type, (e) => {
        e.preventDefault();
        dropZone.classList.remove('over');
      });
    }
    dropZone.addEventListener('drop', (e) => this.#readFiles([...e.dataTransfer.files]));

    // Een bestand dat naast de zone valt, mag de browser niet openen.
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      if (!dropZone.contains(e.target)) e.preventDefault();
    });
  }

  #bindPaste() {
    $('#btnPasteToggle').addEventListener('click', (e) => {
      this.pasteBox.hidden = !this.pasteBox.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!this.pasteBox.hidden));
      if (!this.pasteBox.hidden) this.pasteText.focus();
    });
    $('#btnPasteGo').addEventListener('click', () => {
      const text = this.pasteText.value;
      if (!text.trim()) {
        this.toast.show('Plak eerst de tekst uit de e-mail.');
        return;
      }
      const activities = new ActivityParser({ source: 'e-mail' }).parseText(text);
      if (!activities.length) {
        this.toast.show('Ik vond geen activiteit in die tekst.');
        return;
      }
      this.onAdd(activities);
      this.pasteText.value = '';
    });
  }

  async #readFiles(files) {
    if (!files.length) return;
    const { activities, problems } = await FileService.readActivities(files);
    if (activities.length) this.onAdd(activities);
    else if (!problems.length) this.toast.show('Ik vond geen activiteit in dat bestand.');
    if (problems.length) setTimeout(() => this.toast.show(problems.join(' ')), activities.length ? 1800 : 0);
  }
}
