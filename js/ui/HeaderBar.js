import { Period } from '../model/Period.js';
import { $ } from '../util/html.js';

/** Bovenbalk: logo, keuze van de periode en de knop "Download Word". */
export class HeaderBar {
  /**
   * @param {import('../model/Program.js').Program} program
   * @param {{onExport: () => void}} actions
   */
  constructor(program, { onExport }) {
    this.program = program;
    this.blockSelect = $('#periodBlock');
    this.yearInput = $('#periodYear');
    this.logo = $('#logo');

    this.blockSelect.innerHTML = Array.from(
      { length: Period.BLOCK_COUNT },
      (_, b) => `<option value="${b}">${Period.blockName(b)}</option>`,
    ).join('');
    const onChange = () => program.setPeriod(new Period(this.blockSelect.value, this.yearInput.value));
    this.blockSelect.addEventListener('change', onChange);
    this.yearInput.addEventListener('change', onChange);
    $('#btnExport').addEventListener('click', onExport);

    program.addEventListener('change', () => this.sync());
    this.sync();
  }

  /** Zet de keuzelijsten gelijk met het programma. */
  sync() {
    this.blockSelect.value = String(this.program.period.block);
    this.yearInput.value = String(this.program.period.year);
  }

  setLogo(url) {
    this.logo.hidden = !url;
    if (url) this.logo.src = url;
  }
}
