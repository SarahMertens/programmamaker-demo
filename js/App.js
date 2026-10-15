import { ProgramDocxWriter } from './docx/ProgramDocxWriter.js';
import { WordTemplate } from './docx/WordTemplate.js';
import { Period } from './model/Period.js';
import { Program } from './model/Program.js';
import { PreviewRenderer } from './preview/PreviewRenderer.js';
import { FileService } from './services/FileService.js';
import { ProgramStore } from './services/ProgramStore.js';
import { ActivityListView } from './ui/ActivityListView.js';
import { HeaderBar } from './ui/HeaderBar.js';
import { IntakePanel } from './ui/IntakePanel.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { Tabs } from './ui/Tabs.js';
import { Toast } from './ui/Toast.js';
import { $, debounce } from './util/html.js';

/**
 * Brengt alles samen: het model (Program), de opslag, het sjabloon en de schermonderdelen.
 *
 *   Program ──change──► ActivityListView, HeaderBar, PreviewRenderer, opslag
 *   IntakePanel ──────► Program.add()
 *   HeaderBar ────────► ProgramDocxWriter → download
 */
export class App {
  static DEFAULT_TEMPLATE_URL = 'assets/sjabloon.docx';

  /** Demo: voorbeelden van ingestuurde activiteiten, allemaal in november en december 2026. */
  static EXAMPLE_PERIOD = new Period(5, 2026);
  static EXAMPLE_FILES = [
    'voorbeelden/20261107_herfstwandeling.docx',
    'voorbeelden/20261126_activiteiten-sofie-en-anne.docx',
    'voorbeelden/20261212_email-kerstmarkt.txt',
  ];

  constructor() {
    this.store = new ProgramStore();
    this.program = this.store.loadProgram() || new Program();
    this.template = null;
    this.toast = new Toast($('#toast'));

    this.preview = new PreviewRenderer({
      sheets: $('#sheets'),
      scroller: $('#pvScroll'),
      measure: $('#measure'),
      info: $('#pvInfo'),
    });
    this.header = new HeaderBar(this.program, { onExport: () => this.exportWord() });
    this.list = new ActivityListView(this.program, { toast: this.toast });
    this.intake = new IntakePanel({
      onAdd: (activities) => this.addActivities(activities),
      onExamples: () => this.loadExamples(),
      toast: this.toast,
    });
    this.settings = new SettingsPanel(this.program, {
      toast: this.toast,
      onTemplateFile: (file) => this.useTemplateFile(file),
      onTemplateReset: () => this.resetTemplate(),
      onSaveProject: () => this.saveProject(),
    });
    this.tabs = new Tabs({ onPreview: () => this.renderPreview() });

    this.renderPreview = this.renderPreview.bind(this);
    const schedulePreview = debounce(this.renderPreview, 200);
    const scheduleSave = debounce(() => this.store.saveProgram(this.program), 300);
    this.program.addEventListener('change', () => {
      schedulePreview();
      scheduleSave();
    });
  }

  async start() {
    this.list.render();
    await this.#loadInitialTemplate();
    this.renderPreview();
    // Opnieuw tekenen zodra de lettertypes geladen zijn (andere tekstbreedte).
    document.fonts?.ready.then(this.renderPreview);
  }

  /* ---------- acties ---------- */

  addActivities(activities) {
    this.program.add(activities);
    this.list.highlight(activities);
    const first = activities[0];
    this.toast.show(
      activities.length === 1
        ? `Toegevoegd: ${first.title || 'activiteit'}`
        : `${activities.length} activiteiten toegevoegd`,
    );
  }

  /**
   * Demo: begint een leeg programma voor november-december 2026 en leest de voorbeeldbestanden in,
   * via precies dezelfde weg als bestanden die je zelf in de app sleept.
   */
  async loadExamples() {
    try {
      const files = await Promise.all(
        App.EXAMPLE_FILES.map(async (url) => new File([await FileService.fetchArrayBuffer(url)], url.split('/').pop())),
      );
      const { activities, problems } = await FileService.readActivities(files);
      this.program.replaceWith(new Program({ period: App.EXAMPLE_PERIOD }));
      this.addActivities(activities);
      if (problems.length) setTimeout(() => this.toast.show(problems.join(' ')), 1800);
    } catch (error) {
      console.error(error);
      this.toast.show(`De voorbeelden laden lukte niet: ${error.message}`);
    }
  }

  async exportWord() {
    if (!this.template) {
      this.toast.show('Het sjabloon is nog niet geladen.');
      return;
    }
    try {
      const blob = await new ProgramDocxWriter(this.template).build(this.program);
      const fileName = this.program.period.fileName('docx');
      FileService.download(fileName, blob);
      this.toast.show(`Bewaard: ${fileName}`);
    } catch (error) {
      console.error(error);
      this.toast.show(`Het Word-bestand maken lukte niet: ${error.message}`);
    }
  }

  saveProject() {
    const json = JSON.stringify(this.program.toJSON(), null, 1);
    const fileName = this.program.period.fileName('json').replace('.json', '_project.json');
    FileService.download(fileName, new Blob([json], { type: 'application/json' }));
  }

  async useTemplateFile(file) {
    try {
      const buffer = await file.arrayBuffer();
      await this.#applyTemplate(await WordTemplate.load(buffer.slice(0), file.name));
      if (!this.store.saveTemplate(buffer))
        this.toast.show('Sjabloon geladen, maar deze browser kan het niet onthouden.');
      else this.toast.show(`Nieuw sjabloon: ${file.name}`);
      this.program.setTemplateName(file.name);
    } catch (error) {
      this.toast.show(error.message);
    }
  }

  async resetTemplate() {
    let template;
    try {
      template = await this.#defaultTemplate();
    } catch {
      this.toast.show('Er is geen standaardsjabloon (assets/sjabloon.docx). Je eigen sjabloon blijft in gebruik.');
      return;
    }
    this.store.clearTemplate();
    this.program.setTemplateName(null);
    await this.#applyTemplate(template);
    this.toast.show('Standaardsjabloon teruggezet');
  }

  renderPreview() {
    this.preview.render(this.program);
  }

  /* ---------- sjabloon ---------- */

  async #loadInitialTemplate() {
    const saved = this.store.loadTemplate();
    try {
      if (saved) {
        await this.#applyTemplate(await WordTemplate.load(saved, this.program.templateName || 'eigen sjabloon'));
        return;
      }
    } catch {
      this.store.clearTemplate(); // beschadigd: val terug op de standaard
    }
    try {
      await this.#applyTemplate(await this.#defaultTemplate());
    } catch (error) {
      console.error(error);
      const message =
        location.protocol === 'file:'
          ? 'Open de app via een webserver, niet door te dubbelklikken (zie README).'
          : 'Kies eerst een vorig programma als sjabloon onderaan bij "Sjabloon, opslaan en nieuw programma".';
      this.settings.setTemplateName('nog geen sjabloon');
      $('#settings').open = true;
      this.toast.show(message);
    }
  }

  async #defaultTemplate() {
    return WordTemplate.load(await FileService.fetchArrayBuffer(App.DEFAULT_TEMPLATE_URL), null);
  }

  async #applyTemplate(template) {
    this.template = template;
    this.preview.setTemplate(template);
    this.header.setLogo(template.logoUrl);
    this.settings.setTemplateName(template.name);
    this.renderPreview();
  }
}
