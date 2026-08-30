# Eisen Log + Firebase + Cloudflare Pages

Diese App ist ein statischer Lift-Tracker basierend auf dem HTML-Tracker aus deinem Upload. Die Daten werden standardmäßig lokal im Browser gespeichert. Wenn du in `firebase-config.js` deine Firebase-Projectdaten einträgst, wird automatisch Firestore als Datenbank verwendet.

## 1) Firebase Projekt anlegen

1. Gehe zu https://console.firebase.google.com/
2. Klicke auf `Projekt hinzufügen`
3. Wähle einen Projektnamen, z. B. `eisen-log`
4. Nach der Erstellung öffnest du in der linken Sidebar:
   - `Firestore Database`
   - `Datenbank erstellen`
   - Standort wählen
   - Modus: `Start in testmodus` (für die erste Einrichtung)
5. Gehe zu `Projektsettings` → `Allgemein`
6. Kopiere die Web-App-Konfiguration und ersetze die Platzhalter in `firebase-config.js`

## 2) Firestore-Regeln

Wenn du Firestore mit der App nutzen willst, kannst du eine einfache Test-Regel anlegen:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> Das ist nur für Test- und Privatnutzung geeignet. Für produktive Nutzung solltest du echte Auth-Checks ergänzen.

## 3) D1-Datenbank verbinden

Das Projekt ist bereits mit Cloudflare D1 vorbereitet. Die D1-Bindung steht in `wrangler.toml` und die API nutzt `env.DB` in `functions/api/data.js`.

1. D1-Datenbank anlegen:

```bash
npx wrangler d1 create eisenlog-db
```

2. Schema in die DB importieren:

```bash
npx wrangler d1 execute eisenlog-db --file=schema.sql
```

3. Lokal testen:

```bash
npm run dev
```

Danach öffnest du die lokale Pages-URL von Wrangler im Browser.

## 4) Auf Cloudflare Pages deployen

1. Lade dieses Verzeichnis in GitHub hoch oder verbinde ein GitHub-Repo mit Cloudflare Pages.
2. In Cloudflare Pages:
   - `Create a project`
   - `Connect to Git`
   - Repo auswählen
   - Build settings:
     - Framework preset: `None`
     - Build command: leer lassen
     - Output directory: `.`
3. Deployment starten
4. Nach dem Deploy ist die App live

## 5) Wichtige Hinweise

- Die Datei `firebase-config.js` enthält alle Firebase-Zugangsdaten. Diese Datei muss bei Cloudflare Pages mit den echten Werten veröffentlicht werden.
- Ohne gültige Firebase-Konfiguration läuft die App im LocalStorage-Modus weiter.
- Wenn du die App mit echter Firestore-Datenbank verwenden willst, müssen du die Firebase-Web-App in der Konsole aktiviert und die Firestore-Collection-Namen korrekt sein.

## 6) Konfiguration für Cloudflare Pages

Wenn du nur statische Dateien hostest, ist kein Build-Prozess nötig. Es reicht, das Repository als statisches Projekt zu deployen.

## 7) Collections-Struktur

Die App verwendet in Firestore:

- `entries` - alle Trainingsdaten
- `settings/main` - Liste der Übungen

Wenn du einen völlig neuen Firebase-Stand aufsetzt, wird die App automatisch eine leere Struktur erzeugen, sobald der erste Eintrag gespeichert wird.
