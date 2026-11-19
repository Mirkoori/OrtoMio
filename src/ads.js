/* Annunci AdMob (banner) con modulo di consenso UMP.
   - Spenti di default: si attivano solo con VITE_ADS=1 in fase di build.
   - Annunci di PROVA finché non c'è VITE_ADS_REAL=1 (da usare solo dopo la pubblicazione e il collegamento allo store).
   - Non fa nulla sul web: solo sull'app Android. */
import { Capacitor } from "@capacitor/core";
import { AdMob, BannerAdSize, BannerAdPosition } from "@capacitor-community/admob";

var ENABLED = import.meta.env.VITE_ADS === "1";
var REAL = import.meta.env.VITE_ADS_REAL === "1";
var BANNER_ID = "ca-app-pub-4158953198272640/2729884234";
var TAB_BAR = 86; // altezza (dp) della barra in basso: il banner sta sopra

function setAdHeight(h) {
  document.documentElement.style.setProperty("--ad-h", (h || 0) + "px");
}

export async function startAds() {
  if (!ENABLED || !Capacitor.isNativePlatform()) return;
  try {
    await AdMob.initialize();
    var info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && String(info.status) === "REQUIRED") {
      info = await AdMob.showConsentForm();
    }
    if (!info.canRequestAds) return;
    await AdMob.addListener("bannerAdSizeChanged", function (s) { setAdHeight(s && s.height); });
    await AdMob.showBanner({
      adId: BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: TAB_BAR,
      isTesting: !REAL
    });
  } catch (e) {
    setAdHeight(0); // se qualcosa va storto l'app funziona lo stesso, senza annunci
  }
}

/* Per la voce "Gestisci consenso annunci" (obbligatoria in UE dopo la scelta). */
export async function privacyOptions() {
  if (!ENABLED || !Capacitor.isNativePlatform()) return;
  try { await AdMob.showPrivacyOptionsForm(); } catch (e) {}
}
