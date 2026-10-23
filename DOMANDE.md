# BiblioTrack — Domande aperte

> Domande a cui l'utente deve rispondere prima di scrivere codice. Formato: vedi `~/.claude/CLAUDE.md` §3.2.
> Origine D1–D7: check CVE dipendenze del 2026-10-23 (report in `CLAUDE.md` → "CHECK CVE — 2026-10-23").

### D1 — Pinning dipendenze Python (lockfile)
**Stato**: RISPOSTA
**Bloccante**: sì (per D2/D3: senza lock gli upgrade non sono riproducibili)
**Domanda**: `backend/requirements.txt` usa `>=` per quasi tutto. Docker installa "l'ultima versione al momento del build", l'ambiente locale ha versioni vecchie e vulnerabili. Come pinniamo?
**Perché conta**: build non riproducibili; una CVE (o una release rotta) entra/esce dall'immagine senza che nessuno lo decida. Viola la regola "versioni pinnate (lockfile)".
**Opzioni**: A) `uv pip compile requirements.in -o requirements.txt --generate-hashes` (uv già indicato nello stack; richiede installare `uv`) B) `pip-tools` (`pip-compile --generate-hashes`) C) pin manuale `==` senza hash
**Suggerimento**: A — coerente con lo stack dichiarato, hash verificati da pip in Docker (`--require-hashes`), separa dipendenze dirette (`.in`) da lock. pytest spostato in `requirements-dev`.
**Risposta utente**: (2026-10-23) A — `uv pip compile` con hash, `requirements.in` + lock, pytest in `requirements-dev`.

### D2 — Upgrade pacchetto backend
**Stato**: RISPOSTA
**Bloccante**: no — priorità ridimensionata dopo D9: in produzione starlette 1.3.1 e python-multipart 0.0.32 sono già fixati (DoS login NON presente). Restano certifi 2026.6.17 e anyio 4.14.1 nel container; il resto riguarda solo l'ambiente locale
**Domanda**: Aggiorniamo in blocco: fastapi 0.136.3→0.161.1 (porta starlette 1.2.0→1.9.0), python-multipart 0.0.29→0.0.32, certifi→2026.10.19, cryptography 48.0.0→50.0.2, pyasn1→0.6.4, anyio→4.15.1, urllib3→2.8.0, pydantic-settings→2.16.1?
**Perché conta**: l'unica vuln realmente raggiungibile senza autenticazione è il DoS form urlencoded su `/auth/login` (starlette CVE-2026-54283, python-multipart CVE-2026-53540/53539). certifi contiene root CA emSign compromesse (fetch copertine/ISBN in uscita). Salto fastapi grande (25 minor) → rischio regressioni.
**Opzioni**: A) tutto insieme + 69 test + verifica e2e B) solo starlette/multipart/certifi (minimo) C) rimandare
**Suggerimento**: A — i test coprono auth/books/loans/export; se qualcosa rompe si bisseziona.
**Risposta utente**: (2026-10-23) A — upgrade backend in blocco + test + verifica e2e.

### D3 — python-jose → PyJWT
**Stato**: RISPOSTA
**Bloccante**: no
**Domanda**: python-jose 3.5.0 ha CVE-2024-33663/CVE-2026-85394 (algorithm confusion) senza fix e trascina ecdsa (CVE-2024-23342, senza fix) + pyasn1 + rsa. Migriamo a PyJWT 2.15.1?
**Perché conta**: oggi NON sfruttabile (HS256 simmetrico, `algorithms=[ALGORITHM]` pinnato, nessuna chiave pubblica). Ma è una libreria auth con CVE aperte senza fix: ogni futuro audit la segnalerà, e un cambio a RS256/ES256 la renderebbe sfruttabile.
**Opzioni**: A) migrare a PyJWT (tocca solo `services/auth_service.py` + `requirements`; stessi token HS256, sessioni esistenti restano valide) B) tenere e documentare come accettato
**Suggerimento**: A — modifica piccola, elimina 4 pacchetti dalla superficie, PyJWT è lo standard mantenuto.
**Risposta utente**: (2026-10-23) A — migrazione python-jose → PyJWT (token HS256 esistenti restano validi). Fatto in STEP 17, compatibilità token verificata.

### D4 — Upgrade frontend web (non-breaking)
**Stato**: RISPOSTA
**Bloccante**: no
**Domanda**: Applichiamo gli upgrade nello stesso major: axios 1.16.1→1.20.0, react-router-dom 6.30.3→6.30.6, postcss→8.5.31, più `npm audit fix` (senza `--force`) per transitive (follow-redirects, form-data, nanoid, browserslist, source-map-js, quagga2/sharp)?
**Perché conta**: axios e react-router finiscono nel bundle servito agli utenti. Impatto reale basso (le CVE axios sono quasi tutte sull'adapter Node/HTTP2/proxy, il browser usa XHR; le open redirect di react-router richiedono navigazione verso path controllati dall'utente, noi navighiamo solo verso path costanti/ID numerici), ma l'upgrade è a rischio quasi nullo.
**Opzioni**: A) sì, ora B) rimandare
**Suggerimento**: A. Restano 2 advisory react-router non fixate in v6 (backslash open redirect, SSR `deserializeErrors`): non applicabili (no SSR, no redirect dinamici) → accettate; v7 è major, decisione separata.
**Risposta utente**: (2026-10-23) A — upgrade frontend stesso major (axios, react-router-dom 6.30.6, postcss, `npm audit fix` senza --force).

### D5 — Vite dev server esposto in LAN (`host: true`)
**Stato**: RISPOSTA
**Bloccante**: no
**Domanda**: `frontend/vite.config.js` e `mobile/vite.config.js` fanno bind su 0.0.0.0. Vite 5.4.21 (ultimo v5) ha CVE dev-server non fixate in v5, tra cui `server.fs.deny` bypass **su Windows** (la tua macchina) e esbuild "any website can read dev server responses". Cosa facciamo?
**Perché conta**: con `npm run dev` attivo, chiunque in LAN (o un sito aperto nel browser, via esbuild) può leggere file fuori dalla cartella progetto. Nessun impatto produzione (Vite non è nel container).
**Opzioni**: A) `host` di default a localhost, LAN solo su richiesta (`npm run dev -- --host`) B) upgrade a Vite 8 (major, tocca plugin-react e config) C) accettare
**Suggerimento**: A subito (1 riga per file); B quando si fa un giro di upgrade major insieme a Tailwind 4.
**Risposta utente**: (2026-10-23) A — dev server Vite su localhost di default (LAN solo con `--host`), frontend e mobile.

### D6 — Mobile: Capacitor 6.2.1 (CRITICA) + tar
**Stato**: RISPOSTA
**Bloccante**: sì per qualsiasi build mobile distribuita
**Domanda**: `@capacitor/android` 6.2.1 ha CVE-2026-103922 (critica: contenuto remoto caricato all'origine dell'app via `/_capacitor_http_interceptor_` → accesso a SQLite/plugin). Fix in 6.2.2. `@capacitor/cli` porta `tar` vulnerabile (fix solo in CLI 8.x). Come procediamo?
**Perché conta**: oggi nessun APK distribuito → impatto zero. Ma l'app carica copertine da URL remoti: appena distribuita, la vuln diventa rilevante.
**Opzioni**: A) bump 6.2.2 (core/android/cli) ora, Capacitor 8 con MOBILE-2 B) direttamente Capacitor 8 ora C) rimandare tutto a MOBILE-2
**Suggerimento**: A — patch nello stesso major, zero rischio; `tar` è tooling locale che estrae solo template ufficiali → accettato fino a Capacitor 8.
**Risposta utente**: (2026-10-23) A — Capacitor 6.2.2 (core/android/cli) ora; Capacitor 8 con MOBILE-2.

### D7 — Immagine Docker: Node 20 EOL + scan OS
**Stato**: RISPOSTA
**Bloccante**: no
**Domanda**: Il build stage usa `node:20-alpine`, EOL dal 2026-04-30 (niente più patch di sicurezza). Runtime `python:3.11-slim` supportato fino al 2027-10-31. Le vuln dei pacchetti OS dell'immagine NON sono state verificate (Docker/trivy assenti qui). Cosa facciamo?
**Perché conta**: Node è solo build stage (non nell'immagine finale) → rischio basso, ma build su runtime non mantenuto. I pacchetti Debian/nginx dell'immagine finale sono la superficie reale esposta.
**Opzioni**: A) `node:22-alpine` (LTS) + pin per digest delle immagini base + scan `trivy image` sull'Unraid al primo build B) solo bump Node C) rimandare al deploy
**Suggerimento**: A.
**Risposta utente**: (2026-10-23) A — `node:22-alpine`, immagini base pinnate per digest, scan `trivy image` sull'Unraid.

### D8 — Login esposto su internet senza rate limiting
**Stato**: RISPOSTA
**Bloccante**: sì (rischio attivo ora)
**Domanda**: L'istanza è online con dominio proprio e il solo login dell'app (Authelia non operativo). Il rate limiting su `/auth/login` era stato "accettato per app domestica". Come proteggiamo il login finché Authelia non è attivo?
**Perché conta**: brute force / credential stuffing da internet sugli account (incluso l'admin, che gestisce tutti i libri/utenti). Bcrypt rallenta ma non blocca. Viola la regola globale "rate limiting e lockout su login".
**Opzioni**: A) rate limit in-app in memoria (nuova dipendenza `slowapi`, o limiter minimale scritto da noi per IP+username, single-process uvicorn → va bene in memoria) + lockout temporaneo per account B) rate limit sul reverse proxy esterno (`limit_req` nginx / CrowdSec / fail2ban) C) mettere subito un livello davanti (Authelia, basic auth o accesso solo via Tailscale/VPN) finché il resto non è pronto D) accettare
**Suggerimento**: C come tampone immediato se fattibile (zero codice), poi A — difesa nell'app, indipendente dal proxy. Va verificato che uvicorn veda il vero IP client (`--proxy-headers` + `--forwarded-allow-ips` limitato al proxy), altrimenti tutti i client sembrano lo stesso IP.
**Risposta utente**: (2026-10-23) A — limiter interno senza nuove dipendenze; politica IP (10 fallimenti/15 min) + username (5/15 min), blocco 15 min; esteso a change-password (5/15 min per user id). Authelia in preparazione in parallelo. Implementato, vedi `CLAUDE.md` → STEP 14. Per l'IP reale resta da impostare `FORWARDED_ALLOW_IPS` sul container (D11).

### D9 — Versioni effettive nel container in produzione
**Stato**: RISPOSTA
**Bloccante**: sì (per valutare l'esposizione reale)
**Domanda**: Con `>=` le versioni nel container dipendono dalla data del build. Puoi lanciare sull'Unraid: `docker exec <nome_container> pip freeze` e incollare l'output? Indica anche la data/tag dell'immagine (`docker image ls | grep bibliotrack`).
**Perché conta**: se l'immagine è stata buildata prima delle fix (starlette 1.3.1, multipart 0.0.30/31, certifi 2026.10.19), le vuln D2 sono attive in produzione adesso.
**Opzioni**: A) incolli l'output, lo analizzo B) rebuild+redeploy subito dopo D1/D2 senza analisi
**Suggerimento**: A — 1 minuto, ci dice se serve un redeploy urgente.
**Risposta utente**: (2026-10-23) container `BiblioTrack`, immagine buildata 2026-07-09. Analisi OSV: vedi `CLAUDE.md` → CHECK CVE → "Produzione". Redeploy urgente NON necessario.

### D10 — Reverse proxy e TLS davanti al container
**Stato**: RISPOSTA
**Bloccante**: no
**Domanda**: Cosa c'è davanti al container (Nginx Proxy Manager, SWAG, Traefik, Cloudflare Tunnel…)? TLS terminato lì con certificato valido + redirect HTTP→HTTPS + HSTS?
**Perché conta**: senza TLS password e token JWT viaggiano in chiaro. Determina anche dove mettere il rate limit (D8) e la config `--forwarded-allow-ips` di uvicorn.
**Opzioni**: risposta descrittiva
**Suggerimento**: —
**Risposta utente**: (2026-10-23) Nginx Proxy Manager con redirect HTTPS, HSTS attivo. uvicorn dietro 2 proxy (NPM → nginx interno) → per il rate limit per IP serve propagare `X-Forwarded-For` e fidarsi solo dell'IP di NPM.

### D11 — IP di Nginx Proxy Manager per `FORWARDED_ALLOW_IPS`
**Stato**: RISPOSTA
**Bloccante**: sì per il deploy di STEP 14
**Domanda**: Che IP usa NPM per arrivare al container? Lancia `docker logs BiblioTrack 2>&1 | grep '/api/' | tail -3` e incolla le righe (primo campo = IP mittente).
**Perché conta**: se `FORWARDED_ALLOW_IPS` non include NPM, tutti i client condividono un solo contatore IP → 10 login sbagliati di chiunque bloccano il login a tutti per 15 min (DoS banale). Se include troppo (es. tutta la LAN), un client in lista può falsificare il proprio IP e aggirare il limite per IP (il limite per username resta).
**Opzioni**: A) IP singolo di NPM B) subnet docker di NPM (se l'IP del container NPM cambia ai riavvii)
**Suggerimento**: A se NPM arriva dal gateway docker o da IP statico; B solo se l'IP cambia.
**Risposta utente**: (2026-10-23) dai log del container NPM arriva da `172.17.0.1` (gateway bridge docker0, accesso via porta pubblicata sull'host) → `FORWARDED_ALLOW_IPS=127.0.0.1,172.17.0.1`. Residuo: qualunque processo/connessione che entra dal gateway (host Unraid stesso, hairpin NAT) è fidato e può dichiarare un IP arbitrario — accettato (host fidato); il limite per username resta comunque attivo.

### D12 — Credenziale admin di default in `docker-compose.yml`
**Stato**: APERTA
**Bloccante**: no
**Domanda**: `docker-compose.yml` ha `ADMIN_PASSWORD: ${ADMIN_PASSWORD:-changeme123}` (e `SECRET_KEY` di default). Togliamo i default così il compose fallisce se non impostati?
**Perché conta**: viola la regola "nessuna credenziale di default". Non tocca il tuo deploy Unraid (template senza default), ma chi usa il compose senza `.env` ottiene admin/changeme123.
**Opzioni**: A) `${ADMIN_PASSWORD:?imposta ADMIN_PASSWORD}` (errore esplicito) B) lasciare (solo test locale)
**Suggerimento**: A.
**Risposta utente**:

### D13 — Formato `CORS_ORIGINS` errato in `DOCKER-UNRAID.md`
**Stato**: APERTA
**Bloccante**: no
**Domanda**: La guida indica `CORS_ORIGINS=["https://…"]` ma `config.py` vuole una lista separata da virgole: il valore diventa un'origine non valida. Correggiamo la guida?
**Perché conta**: con deploy same-origin (frontend e API sullo stesso dominio) CORS non serve, quindi oggi nessun effetto; ma la guida è sbagliata.
**Opzioni**: A) correggere in `CORS_ORIGINS=https://libri.tuodominio.it` B) togliere il passo (non necessario same-origin)
**Suggerimento**: B — meno configurazione inutile.
**Risposta utente**:
