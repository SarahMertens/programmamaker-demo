# Programmamaker (demo)

**[Probeer de demo](https://sarahmertens.github.io/programmamaker-demo/)** · gemaakt door [Sarah Mertens](https://sarahmertens.netlify.app)

Een webapp die het tweemaandelijkse programma van een vriendenkring maakt. Leden sturen hun activiteit in
als Word-document of als e-mail, telkens net iets anders opgemaakt. De app leest dat in, zet alles op datum,
controleert het en maakt het programma als Word-bestand. Pagina 1 en de opmaak komen uit een vorig programma.

> **Dit is de demoversie.** De echte versie wordt gebruikt door een vriendenkring en staat in een privé-repository.
> Hier zijn alle namen, telefoonnummers, het rekeningnummer en het logo **verzonnen**
> (de "Vriendenkring De Zeemeeuw" bestaat niet). Klik in de app op **Probeer met voorbeelden**, of sleep de
> bestanden uit de map [`voorbeelden/`](voorbeelden) zelf in de app.

- Sleep Word-bestanden (.docx) in de app, of plak de tekst uit een e-mail.
- Datum, titel, beschrijving, **Afspraak**, **Prijs**, **Contactpersoon** en **Opmerkingen** worden vanzelf ingevuld.
- Waarschuwingen voor een verkeerde weekdag, ontbrekende velden, een inschrijfdatum na de activiteit, dubbels
  en datums buiten de periode. De voorbeeldbestanden bevatten bewust een paar van die fouten.
- Live voorbeeld van de A4-pagina's.
- **Download Word** geeft `Programma_<maand>_en_<maand>_<jaar>.docx`, met dezelfde eerste pagina, Verdana,
  blauwe titels en gele labels. Een kader breekt nooit over twee pagina's.

Alles draait in de browser. Er is geen server en geen database. Het werk wordt bewaard in de browser
(localStorage) en kan als projectbestand (.json) bewaard en geopend worden.

## Online zetten

De app is een statische website: GitHub Pages volstaat (**Settings → Pages → Deploy from a branch → `main`, `/ (root)`**).

> **Privacy.** Een GitHub Pages-site is altijd openbaar, ook als de repository privé is. Alles in
> `assets/sjabloon.docx` is dus voor iedereen te downloaden. Daarom gebruikt deze demo een sjabloon met
> verzonnen gegevens. Wie zijn eigen sjabloon kiest (**Sjabloon, opslaan en nieuw programma → Ander sjabloon
> kiezen**), houdt dat enkel in zijn eigen browser.

## Lokaal gebruiken of testen

De app gebruikt JavaScript-modules en laadt het sjabloon met `fetch`. Daarom werkt dubbelklikken op
`index.html` niet: je hebt een eenvoudige webserver nodig.

```bash
# met Python
python3 -m http.server 8080

# of met Node.js
npm start
```

Open daarna <http://localhost:8080>.

## Tests

De tests voor het inlezen van teksten en de periodes draaien met de testrunner van Node.js (versie 18 of hoger).
Er hoeven geen pakketten geïnstalleerd te worden.

```bash
npm test
```

Op GitHub draaien ze automatisch bij elke wijziging (`.github/workflows/tests.yml`).

## Hoe de code in elkaar zit

Gewone JavaScript-modules, zonder framework en zonder build-stap. De enige externe bibliotheek is
[JSZip](https://stuk.github.io/jszip/) (in `vendor/`), waarmee .docx-bestanden (dat zijn zip-bestanden)
gelezen en geschreven worden.

```
index.html                    De pagina
css/styles.css                Alle opmaak (licht en donker thema)
assets/sjabloon.docx          Standaardsjabloon: een vorig programma
vendor/jszip.min.js           JSZip 3.10.1

js/
├─ main.js                    Startpunt
├─ App.js                     Brengt model, opslag, sjabloon en scherm samen
├─ model/
│  ├─ Program.js              Het programma: periode + activiteiten; stuurt "change"-events
│  ├─ Activity.js             Eén activiteit of aankondiging
│  ├─ ActivityValidator.js    De waarschuwingen
│  ├─ Period.js               Twee maanden (jan–feb, maa–apr, …)
│  └─ RichText.js             Tekst met vet en regeleinden
├─ parsing/
│  └─ ActivityParser.js       Tekst → activiteiten (titelregel, velden, aankondigingen)
├─ docx/
│  ├─ ooxml.js                Namespaces en hulpfuncties voor Word-XML
│  ├─ DocxReader.js           Ingestuurd .docx → tekstregels
│  ├─ WordTemplate.js         Vorig programma als sjabloon (pagina 1 + opmaak)
│  ├─ WordXml.js              Bouwstenen in de huisstijl (runs, alinea's, kaders)
│  └─ ProgramDocxWriter.js    Programma → nieuw .docx
├─ preview/
│  ├─ PreviewRenderer.js      A4-voorbeeld met paginering
│  └─ TemplatePageRenderer.js Pagina 1 van het sjabloon in HTML
├─ services/
│  ├─ FileService.js          Bestanden inlezen en downloaden
│  └─ ProgramStore.js         Bewaren in de browser
├─ ui/
│  ├─ HeaderBar.js            Periodekeuze en "Download Word"
│  ├─ IntakePanel.js          Bestanden slepen, e-mail plakken
│  ├─ ActivityListView.js     De lijst
│  ├─ ActivityCard.js         Eén kaart met het bewerkformulier
│  ├─ SettingsPanel.js        Sjabloon, project, nieuw programma
│  ├─ Tabs.js                 Lijst/voorbeeld op een smal scherm
│  └─ Toast.js                Korte meldingen
└─ util/
   ├─ dates.js                Dag- en maandnamen, datums
   └─ html.js                 Escapen, kleine DOM-hulpjes

tests/                        node --test
```

### De gegevensstroom

```
IntakePanel ──► ActivityParser ──► Program.add()
                                      │  "change"-event
             ┌────────────────────────┼─────────────────────┐
             ▼                        ▼                     ▼
     ActivityListView         PreviewRenderer         ProgramStore
                                                     (localStorage)

HeaderBar "Download Word" ──► ProgramDocxWriter(WordTemplate) ──► .docx
```

### Het sjabloon

`WordTemplate` zoekt in het vorige programma de alinea die begint met **"Activiteiten"**. Alles daarvoor is
pagina 1 en wordt letterlijk overgenomen. Enkel de alinea die begint met **"Programma"** krijgt de nieuwe
periode. Alles vanaf "Activiteiten" wordt vervangen door de nieuwe activiteiten. Een nieuw sjabloon moet dus
die twee alinea's bevatten. Elk vorig programma voldoet daaraan.

### Wat de inleesfunctie herkent

```
Zaterdag 19/12: Titel             titelregel: weekdag + datum (19/12, 19/12/2026 of 19 december)
Beschrijving…                     alles tot het eerste veld
Afspraak: …                       velden; regels eronder horen bij hetzelfde veld
Prijs: …
Contactpersoon: …
Opmerkingen: … voor 18/12         de inschrijfdatum wordt vet gezet
AANKONDIGINGEN                    wat volgt, zijn aankondigingen
```

Afgebroken zinnen worden samengevoegd. Aanhef en groet in een e-mail vallen weg. Het jaar wordt geraden,
of gehaald uit een bestandsnaam zoals `20270113_….docx`.

## Projectbestand

Het projectbestand (`…_project.json`) heeft dit formaat:

```json
{
  "app": "programmamaker",
  "version": 1,
  "period": { "block": 5, "year": 2026 },
  "items": [
    {
      "id": "k3j9x2ab",
      "date": "2026-12-19",
      "title": "Magische winterbeleving in Oostende",
      "type": "activiteit",
      "desc": "…",
      "afspraak": "15 u in Brasserie-Tearoom Minigolf",
      "prijs": "je eigen consumptie",
      "contact": "Bart",
      "opm": "Bart verwittigen voor <b>18/12</b>"
    }
  ]
}
```

`block` is 0 voor januari–februari tot 5 voor november–december.

## Licenties

JSZip valt onder de MIT-licentie of GPLv3 (zie `vendor/JSZIP-LICENSE.md`).
Voeg zelf een licentie toe voor deze code als je dat wilt (bv. MIT).
