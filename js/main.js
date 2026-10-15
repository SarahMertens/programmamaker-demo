import { App } from './App.js';

/** Startpunt van de app (geladen vanuit index.html). */
const app = new App();
app.start();

// Handig om in de console van de browser te onderzoeken.
window.programmamaker = app;
