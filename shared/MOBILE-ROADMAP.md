# BiblioTrack — Mobile Roadmap

> Documento di riferimento per lo sviluppo della versione mobile (Capacitor).
> STEP MOBILE-1 (scaffold + SQLite + UI components) è completo — vedi CLAUDE.md.
> Piattaforma: solo Android per ora. iOS rimandato (richiede Mac/Xcode).

---

## Architettura target

```
bibliotrack/
├── backend/          ← FastAPI selfhosted (invariato)
├── frontend/         ← React web selfhosted (invariato)
├── shared/           ← contratti e documentazione condivisa (questo file)
│   ├── MOBILE-ROADMAP.md
│   ├── export-schema.md      ← formato export JSON versionato (v1 + v2 con prestiti)
│   ├── export-schema.v1.json ← JSON Schema formale v1
│   └── export-schema.v2.json ← JSON Schema formale v2
└── mobile/           ← ✅ scaffold Capacitor esistente (STEP MOBILE-1)
    ├── src/
    │   ├── components/   ← copiati/adattati da frontend/src/components/
    │   ├── db/           ← Capacitor SQLite locale (schema.js, database.js)
    │   ├── stores/       ← Zustand senza auth (bookStore, themeStore)
    │   ├── export/       ← [FUTURO STEP MOBILE-3] import/export JSON
    │   └── pages/        ← Library, BookDetail, Settings (Backup: futuro)
    ├── android/          ← ✅ aggiunto (npx cap add android)
    ├── ios/              ← non aggiunto (fuori scope attuale)
    └── package.json
```

## Cosa NON viene portato su mobile

| Feature selfhosted | Motivo esclusione |
|--------------------|-------------------|
| Auth JWT / login   | Mobile è single-user |
| Admin panel        | Nessun multi-utente |
| Gestione utenti    | Idem |
| `owner_id` nei dati | Non esiste su mobile |
| Multi-user permissions | Idem |
| `/auth/*` endpoints | Non chiamati da mobile standalone |

## Cosa è stato portato su mobile (✅ STEP MOBILE-1)

- Componenti UI copiati/adattati: BookCard, BookGrid, BookList, FilterBar,
  SortGroupBar, ThemeSwitcher, StarRating (nessuna dipendenza da `api/client.js`)
- BookDetail e AddBookModal riscritti su `bookStore` (SQLite) — AddBookModal
  solo inserimento manuale per ora (nessuno step scan/isbn-search)
- 4 temi CSS → identici, stesso sistema CSS variables (chiave storage separata)
- Zustand: themeStore identico; bookStore nuovo, CRUD via SQLite locale
- Layout minimale (header + link impostazioni), niente sidebar/admin
- `HashRouter` invece di `BrowserRouter` (necessario per webview Capacitor)

## Cosa manca ancora (STEP MOBILE-2)

- ISBNScanner.jsx → da sostituire con scanner nativo (Capacitor barcode plugin)
- Cascade ISBN lookup → da rieseguire lato client JS (stesse API, no backend)
- UI prestiti (schema DB `borrowers`/`loans` già pronto da MOBILE-1, manca la UI)

## Collegamento opzionale al backend selfhosted

L'utente mobile può configurare un URL backend nelle impostazioni.
Se configurato, l'app può:
- Importare la propria libreria dal selfhosted (one-way pull)
- Esportare al selfhosted (one-way push, solo i propri libri)

Non esiste sync automatica né conflict resolution.
Il backend selfhosted NON viene modificato per supportare mobile —
usa le API esistenti con un token utente normale.

## Stack mobile (futuro)

| Layer | Tecnologia |
|-------|-----------|
| Framework | Capacitor 6 |
| UI | React 18 + TailwindCSS (stesso del selfhosted) |
| Database locale | @capacitor-community/sqlite |
| Scanner | @capacitor-community/barcode-scanner |
| Export file | @capacitor/filesystem |
| Cloud backup | @capacitor/filesystem + Drive/iCloud API |
| Build Android | Android Studio (no Mac richiesto) |
| Build iOS | Xcode su macOS (obbligatorio) |

## Sequenza step futuri

- ✅ STEP MOBILE-1: Setup Capacitor + SQLite locale + import UI components — fatto
- STEP MOBILE-2: Scanner nativo + ISBN cascade lato client
- STEP MOBILE-3: Export/Import JSON (vedi export-schema.md) — riusa formato di `backend/services/export_service.py`
- STEP MOBILE-4: Cloud backup (Drive/iCloud)
- STEP MOBILE-5: Collegamento opzionale backend selfhosted (endpoint `/books/export` e `/books/import` già pronti lato backend)

---

## Note per Claude Code (sessione futura)

Quando si inizia STEP MOBILE-2 (scanner nativo):
1. Leggi CLAUDE.md (stato selfhosted + storico STEP MOBILE-1)
2. Leggi questo file (architettura mobile, sezione "Cosa manca ancora")
3. Leggi shared/export-schema.md (formato dati, per MOBILE-3 successivo)
4. NON modificare nulla in backend/ o frontend/ — solo mobile/
5. `mobile/` esiste già (Capacitor 6, Android, SQLite) — non ripartire da zero
6. Componenti UI già copiati in mobile/src/components/ — riusa quelli,
   non ricopiare da frontend/
