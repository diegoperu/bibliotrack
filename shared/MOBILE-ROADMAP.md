# BiblioTrack — Mobile Roadmap

> Documento di riferimento per il futuro sviluppo della versione mobile (Capacitor).
> La versione mobile NON è ancora in sviluppo.
> Aggiorna questo file quando si inizia STEP MOBILE-1.

---

## Architettura target

```
bibliotrack/
├── backend/          ← FastAPI selfhosted (invariato)
├── frontend/         ← React web selfhosted (invariato)
├── shared/           ← contratti e documentazione condivisa (questo file)
│   ├── MOBILE-ROADMAP.md
│   ├── export-schema.md      ← formato export JSON versionato
│   └── export-schema.v1.json ← JSON Schema formale v1
└── mobile/           ← [FUTURO] Capacitor app (non esiste ancora)
    ├── src/
    │   ├── components/   ← copia/adattamento da frontend/src/components/
    │   ├── db/           ← Capacitor SQLite locale
    │   ├── stores/       ← Zustand senza auth
    │   ├── export/       ← import/export JSON
    │   └── pages/        ← Library, Settings, Backup
    ├── android/
    ├── ios/
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

## Cosa viene portato su mobile (STEP MOBILE-1)

- Tutti i componenti UI: BookCard, BookGrid, BookList, BookDetail, FilterBar,
  SortGroupBar, ThemeSwitcher, AddBookModal (senza campo owner)
- ISBNScanner.jsx → sostituito con NativeScanner.jsx (Capacitor barcode plugin)
- Cascade ISBN lookup → rieseguito lato client JS (stesse API, no backend)
- 4 temi CSS → identici, stesso sistema CSS variables
- Zustand stores → themeStore identico; bookStore riscritto per SQLite locale

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

- STEP MOBILE-1: Setup Capacitor + SQLite locale + import UI components
- STEP MOBILE-2: Scanner nativo + ISBN cascade lato client
- STEP MOBILE-3: Export/Import JSON (vedi export-schema.md)
- STEP MOBILE-4: Cloud backup (Drive/iCloud)
- STEP MOBILE-5: Collegamento opzionale backend selfhosted

---

## Note per Claude Code (sessione futura)

Quando si inizia STEP MOBILE-1:
1. Leggi CLAUDE.md (stato selfhosted)
2. Leggi questo file (architettura mobile)
3. Leggi shared/export-schema.md (formato dati)
4. NON modificare nulla in backend/ o frontend/
5. Crea mobile/ come progetto Capacitor separato
6. I componenti UI vengono copiati da frontend/src/components/
   e adattati (rimozione dipendenze da api/client.js)
