# Orto Mio: guida alla pubblicazione sul Google Play Store

Cosa è già pronto e cosa devi fare tu, in ordine.

**Già pronto:** app, ID `it.devori.ortomio`, icona, informativa sulla privacy online, build firmata di pubblicazione (AAB), scheda con testi e grafica (`scheda-play-store.md`, `grafica/`), risposte ai moduli.

**Da fare tu:** aggiungere due Secrets su GitHub, creare l'account Google Play, caricare e compilare i moduli, fare il test chiuso.

---

## 1. Aggiungi la chiave di caricamento su GitHub (2 minuti, una volta sola)

La chiave privata è stata generata e ti è stata consegnata a parte (file `upload.keystore`, `upload.keystore.b64.txt` e password). **Non è nel repository e non deve finirci.**

1. Apri https://github.com/Mirkoori/OrtoMio/settings/secrets/actions → **New repository secret**.
2. Primo secret: nome `UPLOAD_KEYSTORE_B64`, valore = tutto il testo del file `upload.keystore.b64.txt` (una sola riga lunga, senza spazi né a capo extra).
3. Secondo secret: nome `UPLOAD_KEYSTORE_PASSWORD`, valore = la password.
4. **Conserva `upload.keystore` e la password in un posto sicuro** (gestore di password, cloud personale). Se li perdi si può chiedere a Google di sostituire la chiave di caricamento, ma è una procedura lunga.

## 2. Crea l'AAB firmato

1. Apri https://github.com/Mirkoori/OrtoMio/actions → **Build di pubblicazione (AAB per il Play Store)** → **Run workflow**.
2. Dopo circa 5 minuti apri la run completata e scarica l'artefatto **OrtoMio-release-aab** (uno zip che contiene `OrtoMio-release.aab`). Decomprimilo.
3. Nei log, nel passo «Controlla la firma», deve comparire «AAB firmato». Se compare un avviso di AAB non firmato, controlla i due Secrets.
4. Ogni run aumenta da sola il numero di versione, quindi per gli aggiornamenti basta rilanciare il workflow.

## 3. Crea l'account sviluppatore Google Play

1. Vai su https://play.google.com/console/signup e scegli account **personale** (più semplice) oppure **organizzazione** (serve il numero D-U-N-S; gli account di organizzazione non hanno l'obbligo del test chiuso con 12 tester).
2. Costo: **25 dollari una tantum**. Servono documento d'identità, verifica del telefono e di un dispositivo Android; l'approvazione può richiedere alcuni giorni.
3. Nome dello sviluppatore mostrato pubblicamente: scegli «DevOri» o il tuo nome.

## 4. Crea l'app nella Play Console

1. **Crea app** → nome `Orto Mio: Verdure di Stagione`, lingua italiano, tipo **App**, **Gratuita**. Accetta le dichiarazioni.
2. **Scheda dello store → Scheda principale**: incolla descrizione breve e completa da `scheda-play-store.md`; carica `icona-512.png`, `immagine-copertina-1024x500.png` e gli screenshot 1–6 da `grafica/`.
3. **Contenuti dell'app** (menu «Criteri e programmi»): compila privacy, annunci, accesso, pubblico, classificazione e sicurezza dei dati con le risposte di `scheda-play-store.md`.
4. Categoria **Casa e giardino**, email di contatto, sito web.

## 5. Test chiuso (obbligatorio per gli account personali nuovi)

1. **Test → Test chiuso → Crea release**. Accetta **Play App Signing** (Google custodisce la chiave di firma definitiva; la nostra è solo la chiave di caricamento).
2. Carica `OrtoMio-release.aab`, scrivi le note di versione (per esempio «Prima versione») e salva.
3. **Tester**: crea una lista e aggiungi **almeno 12 indirizzi email Google** di persone fidate. Devono accettare l'invito (link di partecipazione al test) e **restare iscritte per 14 giorni di seguito**.
4. Passati i 14 giorni, nella Play Console compare **«Richiedi accesso alla produzione»**: rispondi al breve questionario (che cosa hai testato, feedback ricevuti).

Se non hai 12 tester, puoi cercarli in gruppi di sviluppatori Android o tra amici e parenti con un account Google.

## 6. Pubblicazione in produzione

1. **Produzione → Crea release**, carica lo stesso AAB (o uno più recente), scegli i Paesi (almeno Italia), invia per la revisione.
2. La revisione di Google richiede da poche ore ad alcuni giorni. Quando è approvata, l'app è online.

## 7. Aggiornamenti futuri

- Modifichi l'app (o chiedi a Claude), poi lanci di nuovo il workflow **Build di pubblicazione**, scarichi il nuovo AAB e lo carichi in una nuova release.
- L'elenco dei luoghi si aggiorna da solo ogni mese nel repository, ma arriva agli utenti solo con un nuovo AAB caricato: conviene pubblicare un aggiornamento ogni 1–3 mesi.

## Cose da ricordare

- **ID dell'app** `it.devori.ortomio`: dopo la prima pubblicazione non si cambia.
- Se aggiungi **pubblicità** o **account**, prima aggiorna informativa sulla privacy (`public/privacy.html`) e scheda «Sicurezza dei dati». In Europa per la pubblicità serve anche il consenso.
- Le APK di prova (`ultima-build`) sono firmate con la chiave di prova pubblica e **non** vanno caricate sullo store.
