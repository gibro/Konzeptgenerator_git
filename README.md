# Konzeptgenerator – Methodenkarten-Datenbank

Eine webbasierte Datenbank zur Verwaltung und Planung von Seminarmethoden für die IG Metall. Das System ermöglicht es, Methodenkarten zu erstellen, zu verwalten und in einem interaktiven Seminarplaner zu organisieren.

## Installation DB
   - erzeuge ein zip aus den vorliegenden Dateien, ohne README und AGENTS und LICENSE
   - Erstelle eine Datenbank-Aktivität in deinem Moodle und klicke auf speichern und anzeigen in der Aktivitätserstellung
   - Klicke auf Vorlagensatz importieren
   - Lade die erzeugte zip Datei hoch
   - Beginne Einträge für Einheiten/Methoden zu schreiben
   - Anschließend kannst du sie in der Listenansicht deiner Datenbank Verschieben.

## Import von Datenbankeinträgen
   - Im Ordner db_entries liegt eine zip Datei, diese enthält nicht nur die reinen Mehtoden, sondern auch Anhänge.
   - Nachdem die Datenbankstruktur nach obiger Anleitung imporitert ist können Einträge importiert werden
   - Das Format ist bei Einträgen ohne Anhänge csv und mit Anhängen eine zip Datei
   - Nachdem Hochladen der Zip Datei sind die Methoden als Einträge auch direkt in der DB sichtbar.

## 🎯 Zentralen Funktionen

### 1. **Methodenkarten-Verwaltung**
   - **Eingabeformular** (`addtemplate.html`): Strukturiertes Formular zur Erfassung von Seminarmethoden mit allen relevanten Metadaten
   - **Detailansicht** (`singletemplate.html`): Übersichtliche Darstellung einer einzelnen Methodenkarte mit allen Informationen
   - **Listenansicht** (`listtemplate.html`): Kompakte Darstellung von Methoden als Drag-and-Drop-fähige Karten

### 2. **Interaktiver Seminarplaner**
   - **Drag & Drop**: Methoden aus der Sidebar in den Wochenplan ziehen
   - **Zeitbasierte Planung**: Visuelles Grid-System mit konfigurierbaren Zeitraster (5, 10, 15 oder 30 Minuten)
   - **Zoom-Funktion**: Drei Zoom-Stufen (5 Min, 15 Min, 30 Min) zur flexiblen Darstellung
   - **Persistenz**: Automatisches Speichern im Browser-LocalStorage

### 3. **Grid-Konfiguration**
   - **Vorlagen**: Vordefinierte Konfigurationen (Standard-Woche, Wochenendseminar, Halbe Woche, Kompakttag)
   - **Individuelle Anpassung**: Freie Wahl von Wochentagen, Zeitbereich und Granularität
   - **Pausenplanung**: Konfigurierbare Pausenzeiten für einzelne oder alle Tage
   - **Tabellenspalten**: Auswahl der anzuzeigenden Spalten im ZIM-Papier

## 📊 Datenbankstruktur

### Datenbankfelder (definiert in `preset.xml`)

Die Datenbank verwendet ein flexibles XML-basiertes Feldkonzept. Jedes Feld kann über Platzhalter wie `[[Titel]]` in den Templates referenziert werden.

#### Pflichtfelder
- **Titel** (Text): Name der Methode

#### Optionalfelder

**Kategorisierung:**
- **Seminarphase** (Multimenu): Warm-Up, Einstieg, Erwartungsabfrage, Vorwissen aktivieren, Wissen vermitteln, Reflexion, Transfer, Evaluation/Feedback, Abschluss
- **Tags / Schlüsselworte** (Text): Freie Tags, z.B. Seminarkürzel (BR1, A1, etc.)
- **Kognitive Dimension** (Multimenu): Bloomsche Taxonomie (Erinnern, Verstehen, Anwenden, Analysieren, Bewerten, Erschaffen)

**Rahmenbedingungen:**
- **Zeitbedarf** (Menu): 5, 10, 20, 30, 45, 60, 90, 120, 150, 180 Minuten oder mehr
- **Gruppengröße** (Menu): 1, 2-3, 3–5, 6–12, 13–24, 25+, beliebig
- **Komplexitätsgrad** (Menu): sehr niedrig, niedrig, mittel, hoch
- **Vorbereitung nötig** (Menu): keine, <10 Min, 10–30 Min, >30 Min
- **Raumanforderungen** (Multimenu): Plenum, Stuhlkreis, Stehtische, viel Freifläche, Gruppentische, Gruppenräume, akustisch ruhig
- **Sozialform** (Multimenu): Vortrag, Diskussion, Einzelarbeit, Partnerarbeit, Kleingruppen, Galeriegang, Fishbowl

**Inhalt:**
- **Kurzbeschreibung** (Textarea): Kurze Zusammenfassung der Methode
- **Ablauf** (Textarea): Detaillierte Beschreibung der einzelnen Phasen
- **Lernziele (Ich-kann ...)** (Textarea): Formulierte Lernziele
- **Debrief/Reflexionsfragen** (Textarea): 3–5 Fragen zur Reflexion
- **Risiken/Tipps** (Textarea): Fallstricke, Moderationshinweise, Varianten, Barrierefreiheit

**Materialien:**
- **Materialien** (File): PDF-Handouts, Folien, Karten (auch ZIP möglich)
- **H5P-Inhalt** (Textarea): Embed-Code für H5P-Inhalte
- **Material/Technik** (Textarea): Liste der benötigten Materialien

**Metadata:**
- **Autor*in / Kontakt** (Text): Kontaktinformationen für Rückfragen

## 🔧 Nutzung der Datenbank

### Grundlegende Bedienung

#### 1. Methodenkarte erstellen
1. Öffnen Sie das Eingabeformular (über das System, das diese Templates verwendet)
2. Füllen Sie die Felder aus – nur der **Titel** ist Pflichtfeld
3. Nutzen Sie die drei Hauptabschnitte:
   - **Schnellfassung**: Titel, Phase, Tags, Zeitbedarf, Gruppengröße, Kognitive Dimension, Kurzbeschreibung, Ablauf
   - **Qualität & Rahmen**: Lernziele, Komplexitätsgrad, Vorbereitung, Raumanforderungen, Sozialform, Risiken/Tipps, Reflexionsfragen
   - **Materialien & Technik**: Materialien, H5P-Inhalt, Material/Technik
4. Speichern Sie den Eintrag

#### 2. Methodenkarte anzeigen
- Die Detailansicht zeigt alle ausgefüllten Felder in übersichtlicher Form
- Leere Felder werden automatisch ausgeblendet
- Meta-Informationen werden als Chips dargestellt
- Bearbeiten- und Löschen-Buttons erscheinen (falls Berechtigung vorhanden)

#### 3. Seminarplaner verwenden

**Grid konfigurieren:**
1. Klicken Sie auf den **Grid**-Button (⚙️)
2. Wählen Sie eine Vorlage oder konfigurieren Sie individuell:
   - **Wochentage**: Montag bis Sonntag auswählen
   - **Zeitbereich**: Start- und Endzeit festlegen
   - **Granularität**: Zeitraster-Auflösung wählen (5/10/15/30 Min)
   - **Pausenzeiten**: Pausen für einzelne oder alle Tage hinzufügen
   - **Tabellenspalten**: Spalten für das ZIM-Papier auswählen
3. Klicken Sie auf **Übernehmen**

**Methoden planen:**
1. Ziehen Sie Methoden-Karten aus der Sidebar in den Wochenplan
2. Positionieren Sie die Karte an der gewünschten Zeit und im gewünschten Tag
3. Die Dauer wird automatisch aus dem Zeitbedarf der Methode berechnet
4. Klicken Sie auf eine Karte im Plan, um Details anzuzeigen oder zu bearbeiten
5. Löschen Sie Karten mit dem ✕-Button

**Zoom steuern:**
- Nutzen Sie die Zoom-Buttons (🔍− / 🔍+) zur Vergrößerung oder Verkleinerung
- Drei Stufen: 5 Min (fein), 15 Min (mittel), 30 Min (grob)

**Daten verwalten:**
- **Export**: Plan als JSON-Datei exportieren (💾 Export)
- **Import**: Exportierte JSON-Datei wieder importieren (📥 Import)
- **Löschen**: Gesamten Plan löschen (🗑️ Löschen)

**Meta-Informationen:**
- Tragen Sie Seminartitel, Datum, Seminarnummer und Kontakt in die Meta-Felder ein
- Diese Informationen werden im Header angezeigt

### Template-System

Das System verwendet Platzhalter im Format `[[Feldname]]`, die durch das Backend-System mit den tatsächlichen Daten ersetzt werden.

**Beispiel:**
```html
<h1 class="ig-title">[[Titel]]</h1>
<p>[[Kurzbeschreibung]]</p>
```

Die Platzhalter müssen exakt mit den Feldnamen in `preset.xml` übereinstimmen.

## ✨ Features

### Seminarplaner Features

- ✅ **Drag & Drop**: Intuitive Bedienung durch Ziehen von Karten
- ✅ **Responsive Design**: Funktioniert auf Desktop und Tablet
- ✅ **LocalStorage**: Automatisches Speichern ohne Server
- ✅ **Zeit-Snapping**: Automatisches Ausrichten an Zeitraster
- ✅ **Pausen-Management**: Visuelle Darstellung von Pausen im Plan
- ✅ **Konfigurierbare Grids**: Flexible Anpassung an verschiedene Seminarformate
- ✅ **Zoom-Funktion**: Drei Zoom-Stufen für verschiedene Ansichten
- ✅ **Import/Export**: JSON-basierter Datenaustausch
- ✅ **Tabellenansicht**: ZIM-Papier mit konfigurierbaren Spalten
- ✅ **Meta-Informationen**: Seminardetails im Header

### Methodenkarten Features

- ✅ **Strukturierte Eingabe**: Drei Hauptabschnitte für übersichtliche Erfassung
- ✅ **Auto-Hide**: Leere Felder werden automatisch ausgeblendet
- ✅ **Rich Content**: Unterstützung für H5P-Embeds, Datei-Uploads
- ✅ **Responsive Navigation**: Sticky Navigation zwischen Abschnitten
- ✅ **Visuelle Hierarchie**: Farbcodierte Karten für bessere Übersicht
- ✅ **Accessibility**: Semantic HTML, ARIA-Labels, Keyboard-Navigation

### Technische Features

- ✅ **Kein Build-Prozess**: Direkte Verwendung der Templates
- ✅ **Modulares CSS**: CSS-Variablen für einfache Anpassung
- ✅ **Vanilla JavaScript**: Keine externen Abhängigkeiten
- ✅ **Semantic HTML5**: Moderne, barrierefreie Struktur

## 📁 Dateistruktur

```
.
├── addtemplate.html          # Eingabeformular für neue Methodenkarten
├── singletemplate.html       # Detailansicht einer Methodenkarte
├── listtemplate.html         # Kompakte Karten-Ansicht für Drag & Drop
├── listtemplateheader.html   # Header des Seminarplaners
├── listtemplatefooter.html   # Footer des Seminarplaners
├── preset.xml                # Datenbankfeld-Definitionen
├── csstemplate.css           # Styling für alle Templates
├── jstemplate.js             # JavaScript-Funktionalität (Seminarplaner)
├── rsstemplate.html          # RSS-Feed Template
├── rsstitletemplate.html     # RSS-Titel Template
├── asearchtemplate.html      # Such-Template
└── README.md                 # Diese Datei
```

## 🚀 Entwicklung & Testen

### Lokale Vorschau

Starte einen lokalen HTTP-Server, um die Templates mit korrekten relativen Pfaden zu testen:

```bash
python3 -m http.server 8000
```

Öffne dann `http://localhost:8000` im Browser.

### HTML-Validierung

Prüfe die HTML-Struktur:

```bash
npx html-validate addtemplate.html
```

### CSS-Linting

Prüfe CSS-Dateien:

```bash
npx stylelint "*.css"
```

## 🔄 Änderungen an der Datenbankstruktur

Soll die Datenbankstruktur erweitert oder geändert werden:

1. **Feld in `preset.xml` hinzufügen/ändern**
2. **Platzhalter in Templates einfügen**: `[[NeuesFeld]]`
3. **Template-Anpassungen**:
   - `addtemplate.html`: Eingabefeld hinzufügen
   - `singletemplate.html`: Anzeige hinzufügen (mit `data-hide-if-empty` für optionale Felder)
   - `listtemplate.html`: Falls für Seminarplaner relevant, als `sp-hidden` Datenfeld hinzufügen

## 📝 Hinweise

- **Print-Funktionalität**: Die Print-CSS-Definitionen wurden entfernt. Die ausgedruckte Variante des ZIM-Papiers soll später komplett neu entwickelt werden.
- **Browser-Support**: Moderne Browser mit LocalStorage-Unterstützung (Chrome, Firefox, Safari, Edge)
- **Daten-Persistenz**: Der Seminarplaner speichert Daten im Browser-LocalStorage. Bei Export/Import müssen JSON-Dateien verwendet werden.

## 🤝 Beitragen

Bei Änderungen an Templates:
- Halte die Zwei-Space-Einrückung bei
- Verwende semantic HTML5
- Kommentare nach dem Muster: `<!-- SECTION: Zusammenfassung -->`
- Placeholder im Format `[[PascalCase]]`
- CSS-Klassen mit `ig-*` oder `sp-*` Präfix

## 📄 Lizenz

Dieses Projekt ist Teil der IG Metall Konzeptgenerator-Lösung.

