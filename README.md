# Orto Mio

App per fare l'orto: verdure di stagione, schede con calendario di semina e consigli, il proprio orto e una mappa reale di fruttivendoli, aziende agricole e mercati vicino a te.

## Cosa c'è

- **Stagione**: 26 verdure con selettore del mese, filtri (di stagione, da seminare, tutte), ricerca e famiglie. Ogni scheda ha calendario di semina, trapianto e raccolta, sole, acqua, distanze, giorni al raccolto, difficoltà, vicini buoni e cattivi, calorie e un consiglio.
- **Il mio orto**: cosa seminare, trapiantare e raccogliere nel mese scelto, più l'elenco delle verdure coltivate con l'avanzamento verso il raccolto. I dati restano sul dispositivo (localStorage).
- **Mappa**: mappa OpenStreetMap con Leaflet. Cerca vicino alla tua posizione (o in qualsiasi zona spostando la mappa) fruttivendoli, aziende agricole con vendita diretta e mercati, con indicazioni, sito e telefono quando presenti.

## Avvio

```bash
npm install
npm run dev      # sviluppo, http://localhost:5173
npm run build    # versione di produzione in dist/
npm run preview  # prova la build
```

Serve Node 18 o superiore. La posizione funziona solo da `localhost` o da un indirizzo `https`.

## Struttura

```
index.html        pagina e struttura delle tre sezioni
src/main.js       stato, schermate Stagione e Il mio orto, scheda verdura, navigazione
src/data.js       dati delle verdure (calendari indicativi per il Nord Italia)
src/art.js        illustrazioni SVG delle verdure
src/map.js        mappa Leaflet, posizione dell'utente, ricerca nell'archivio dei luoghi
src/style.css     grafica (tema chiaro e scuro automatici)
```

## Mappa e dati

- **Archivio locale**: i luoghi (`shop=farm`, `shop=greengrocer`, `amenity=marketplace`) sono estratti da OpenStreetMap Italia (Geofabrik) dal workflow `Aggiorna archivio luoghi` (`.github/workflows/dati.yml`, ogni mese o a mano da Actions) con `scripts/build_luoghi.py`, e salvati in `public/data/luoghi.json` (incluso nell'app, funziona offline). La ricerca sulla mappa è un filtro locale, istantaneo. Dopo l'aggiornamento il workflow ricostruisce sito e APK. Per le prove: `public/data/luoghi.json` è un array di `[id, tipo, lat, lng, nome, indirizzo, orari, sito, telefono]`. La qualità dipende da quanto la zona è mappata: chi manca o ha orari sbagliati si corregge su openstreetmap.org e arriva con l'aggiornamento successivo.
- Gli orari sono mostrati come scritti in OpenStreetMap, senza calcolare "aperto ora".
- I tile pubblici di OpenStreetMap vanno bene per sviluppo e piccoli numeri. Con molti utenti serve un fornitore di tile (MapTiler, Stadia, Thunderforest o tile propri) e un'istanza Overpass propria o a pagamento. Vedi la [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Attribuzione obbligatoria: © contributori OpenStreetMap (ODbL). È già mostrata nella mappa e nella pagina.

## App Android

L'app è impacchettata con [Capacitor](https://capacitorjs.com). Il progetto Android è nella cartella `android/`.

- **APK di prova**: a ogni modifica su `main` GitHub compila l'app e la pubblica nella pagina **Releases**, voce «Ultima build». Dal telefono scarica `OrtoMio.apk` e aprilo (Android chiede il permesso di installare da Chrome).
- **Aggiornamenti senza perdere i dati**: gli APK di prova sono firmati con una chiave fissa (`android/app/debug.keystore`, password pubblica). Va bene per le prove, **non** per lo store.
- **Identificativo dell'app**: `it.devori.ortomio` (in `capacitor.config.json` e `android/app/build.gradle`). Cambialo prima della prima pubblicazione: dopo non si può più cambiare.
- **Su computer**: `npm run build`, `npx cap sync android`, `npx cap open android` (serve Android Studio).
- **Icone**: sorgenti in `assets/`. Dopo averle modificate: `npx capacitor-assets generate --android`.
- **Play Store**: serve un account sviluppatore Google (25 USD una tantum), una chiave di caricamento privata (da conservare nei Secrets di GitHub, mai nel repository), la build `bundleRelease` (file AAB), l'informativa sulla privacy e la scheda «Sicurezza dei dati» (l'app usa la posizione).

## Privacy

L'informativa è in `public/privacy.html`, pubblicata su https://mirkoori.github.io/OrtoMio/privacy.html (da indicare nella scheda del Play Store). Va aggiornata se si aggiungono pubblicità o account.

## Dati dell'utente

L'orto di ogni utente è salvato **sul dispositivo** (Capacitor Preferences, con copia in localStorage nella versione web). Nessun server e nessun costo. I dati restano quando si chiude l'app, ma si perdono se si disinstalla l'app o si cancellano i dati. Il backup automatico di Android è attivo (`allowBackup`), quindi con il backup di Google attivo un telefono nuovo può ripristinarli. Per sincronizzare più dispositivi servirebbe un account con un servizio online (per esempio Supabase).

## Da fare

- Pubblicazione sul Play Store (vedi «App Android»).
- "Aperto ora" calcolato dagli orari OpenStreetMap.
- Utilizzo offline dei file dell'app (i font sono già inclusi).
- Cache delle ultime ricerche sulla mappa.
- Più verdure e varietà, filtri per zona climatica.
- Pubblicità (AdMob) e titolo dello store con parole chiave, per esempio «Orto Mio: Verdure di Stagione».
