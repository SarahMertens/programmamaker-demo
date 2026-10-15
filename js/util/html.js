/** Kleine DOM- en tekstfuncties die overal gebruikt worden. */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Ontsnapt tekst voor gebruik in HTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);
}

/** Ontsnapt tekst voor gebruik in XML (Word) en verwijdert ongeldige tekens. */
export function escapeXml(value) {
  return escapeHtml(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/** document.querySelector met kortere naam. */
export const $ = (selector, root = document) => root.querySelector(selector);

/** Korte unieke id voor een activiteit. */
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Eerste letter hoofdletter. */
export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Voert een functie pas uit als er even niets meer gebeurt. */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
