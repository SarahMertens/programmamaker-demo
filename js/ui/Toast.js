/** Korte melding onderaan het scherm. */
export class Toast {
  constructor(element, duration = 3800) {
    this.element = element;
    this.duration = duration;
    this.timer = null;
  }

  show(message) {
    this.element.textContent = message;
    this.element.hidden = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.element.hidden = true), this.duration);
  }
}
