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
src/map.js        mappa Leaflet, posizione dell'utente, ricerca con Overpass
src/style.css     grafica (tema chiaro e scuro automatici)
```

## Mappa e dati

- Le attività arrivano da OpenStreetMap tramite l'API Overpass: `shop=greengrocer` (fruttivendoli), `shop=farm` (vendita diretta in azienda), `amenity=marketplace` (mercati). La qualità dipende da quanto la zona è mappata: chi manca o ha orari sbagliati si corregge su openstreetmap.org.
- Gli orari sono mostrati come scritti in OpenStreetMap, senza calcolare "aperto ora".
- I tile pubblici di OpenStreetMap vanno bene per sviluppo e piccoli numeri. Con molti utenti serve un fornitore di tile (MapTiler, Stadia, Thunderforest o tile propri) e un'istanza Overpass propria o a pagamento. Vedi la [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Attribuzione obbligatoria: © contributori OpenStreetMap (ODbL). È già mostrata nella mappa e nella pagina.

## Da fare

- Pacchetto Android con Capacitor per il Play Store.
- "Aperto ora" calcolato dagli orari OpenStreetMap.
- Font in locale, utilizzo offline e icone dell'app.
- Cache delle ultime ricerche sulla mappa.
- Più verdure e varietà, filtri per zona climatica.
- Pubblicità (AdMob) e titolo dello store con parole chiave, per esempio «Orto Mio: Verdure di Stagione».
