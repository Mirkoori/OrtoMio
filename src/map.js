// Mappa reale: Leaflet + tile di OpenStreetMap, attività cercate con l'API Overpass (dati OSM).
import L from "leaflet";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import "leaflet/dist/leaflet.css";

export const TYPES = [
  { k: "all", l: "Tutti" },
  { k: "farm", l: "Aziende agricole" },
  { k: "contadino", l: "Mercati" },
  { k: "frutt", l: "Fruttivendoli" },
];
export const TLAB = { farm: "Azienda agricola", contadino: "Mercato", frutt: "Fruttivendolo" };

// Centro usato se la posizione non è disponibile (Modena). Cambialo a piacere.
const FALLBACK = { lat: 44.6471, lng: 10.9252, zoom: 12 };
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const PLACES_API = "https://dbstgkxqnzbaxxxdgqum.supabase.co/functions/v1/ortomio-places";
const MAX_RESULTS = 100;
const CACHE_KEY = "ortomio-mappa";
const CACHE_MAX_AGE = 7 * 24 * 3600 * 1000;

let map = null, layer = null, userMarker = null;
let places = [], type = "all", sel = null;
let origin = null, originLabel = "da qui", lastSearch = null;
let status = "", busy = false, moved = false, started = false;
let onChange = function () {};

function emit() { onChange(); }

function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function classify(tags) {
  if (tags.shop === "greengrocer") return "frutt";
  if (tags.shop === "farm") return "farm";
  if (tags.amenity === "marketplace") return "contadino";
  return null;
}

function toPlace(el) {
  const tags = el.tags || {};
  const t = classify(tags);
  const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat;
  const lng = el.lon !== undefined ? el.lon : el.center && el.center.lon;
  if (!t || lat === undefined || lng === undefined) return null;
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const addr = [street, tags["addr:city"]].filter(Boolean).join(", ");
  return {
    id: el.type + "/" + el.id,
    type: t,
    name: tags.name || ({ frutt: "Fruttivendolo", farm: "Azienda agricola", contadino: "Mercato" })[t],
    lat, lng, addr,
    hours: tags.opening_hours || "",
    website: tags.website || tags["contact:website"] || "",
    phone: tags.phone || tags["contact:phone"] || "",
  };
}

function buildQuery(lat, lng, r) {
  const a = "(around:" + r + "," + lat.toFixed(5) + "," + lng.toFixed(5) + ")";
  return "[out:json][timeout:15];(" +
    'nwr["shop"="greengrocer"]' + a + ";" +
    'nwr["shop"="farm"]' + a + ";" +
    'nwr["amenity"="marketplace"]' + a + ";" +
    ");out center " + MAX_RESULTS + ";";
}

// Interroga tutti i server insieme: vince il primo che risponde, gli altri vengono annullati.
async function fetchOnce(lat, lng, r) {
  const body = "data=" + encodeURIComponent(buildQuery(lat, lng, r));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 14000);
  try {
    return await Promise.any(ENDPOINTS.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body, signal: ctl.signal,
      }).then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then((json) => {
        const els = json.elements || [];
        if (!els.length && json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw new Error("server occupato");
        return els;
      })
    ));
  } finally { clearTimeout(timer); ctl.abort(); }
}

// Prima il nostro servizio con cache (veloce), poi, se non risponde, i server pubblici.
async function fetchViaApi(lat, lng, r) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(PLACES_API + "?lat=" + lat.toFixed(5) + "&lng=" + lng.toFixed(5) + "&r=" + Math.round(r), { signal: ctl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!Array.isArray(json.elements)) throw new Error("risposta non valida");
    return json.elements;
  } finally { clearTimeout(timer); }
}

async function fetchElements(lat, lng, r) {
  try { return await fetchViaApi(lat, lng, r); } catch (e) { /* si passa ai server pubblici */ }
  try { return await fetchOnce(lat, lng, r); }
  catch (e) { await new Promise((ok) => setTimeout(ok, 800)); return fetchOnce(lat, lng, r); }
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), search: lastSearch, origin, places }));
  } catch (e) {}
}

function loadCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!c || !c.search || !Array.isArray(c.places) || Date.now() - c.t > CACHE_MAX_AGE) return false;
    places = c.places; lastSearch = c.search;
    if (c.origin) setOrigin(c.origin.lat, c.origin.lng);
    map.setView([c.search.lat, c.search.lng], 13);
    status = "Risultati salvati dell'ultima ricerca, aggiorno…";
    return true;
  } catch (e) { return false; }
}

function searchRadius() {
  const b = map.getBounds();
  const r = map.distance(b.getCenter(), b.getNorthEast()) * 0.9;
  return Math.round(Math.min(10000, Math.max(2500, r)));
}

function applyElements(els, c, r) {
  const seen = new Set();
  const ref = origin || { lat: c.lat, lng: c.lng };
  places = els.map(toPlace).filter((p) => p && !seen.has(p.id) && seen.add(p.id)).map((p) => {
    p.km = haversineKm(ref, p);
    return p;
  });
  lastSearch = { lat: c.lat, lng: c.lng, r };
  saveCache();
  if (sel && !places.some((p) => p.id === sel)) sel = null;
}

function kmText(r) { return (r / 1000).toFixed(1).replace(".", ","); }

// Prima una ricerca piccola (risposta rapida), poi si allarga in sottofondo.
async function search() {
  if (!map || busy) return;
  const c = { lat: map.getCenter().lat, lng: map.getCenter().lng }, r = searchRadius();
  const first = r > 4000 ? 3000 : r;
  busy = true; moved = false;
  status = "Cerco fruttivendoli, aziende agricole e mercati…";
  emit();
  let ok = false;
  try {
    applyElements(await fetchElements(c.lat, c.lng, first), c, first);
    ok = true;
    status = places.length
      ? places.length + " attività entro " + kmText(first) + " km" + (first < r ? ". Cerco anche più lontano…" : ". Dati OpenStreetMap.")
      : "Nessuna attività entro " + kmText(first) + " km" + (first < r ? ". Cerco più lontano…" : ". Sposta la mappa e tocca «Cerca in quest'area».");
    drawMarkers(); emit();
    if (first < r) {
      try {
        applyElements(await fetchElements(c.lat, c.lng, r), c, r);
        status = places.length
          ? places.length + " attività trovate entro " + kmText(r) + " km. Dati OpenStreetMap."
          : "Nessuna attività trovata entro " + kmText(r) + " km. Sposta la mappa e tocca «Cerca in quest'area».";
      } catch (e) {
        status = places.length + " attività entro " + kmText(first) + " km. La ricerca più ampia non ha risposto: tocca «Cerca in quest'area» per riprovare.";
        moved = true;
      }
    }
  } catch (e) {
    status = places.length
      ? "Server mappe occupato: mostro l'ultima ricerca. Tocca «Cerca in quest'area» per riprovare."
      : "Il servizio mappe non risponde adesso. Tocca «Cerca in quest'area» per riprovare.";
    moved = true;
  }
  busy = false;
  drawMarkers();
  emit();
}

function visible() { return places.filter((p) => type === "all" || p.type === type); }

function pinIcon(p, selected) {
  return L.divIcon({
    className: "pinicon" + (selected ? " sel" : ""),
    html: '<span class="pinshape t-' + p.type + '"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 35],
  });
}

function drawMarkers() {
  if (!layer) return;
  layer.clearLayers();
  visible().forEach((p) => {
    const m = L.marker([p.lat, p.lng], { icon: pinIcon(p, p.id === sel), title: p.name, keyboard: true, zIndexOffset: p.id === sel ? 1000 : 0 });
    m.on("click", () => select(p.id, false));
    layer.addLayer(m);
  });
}

function checkMoved() {
  if (!lastSearch || busy) return;
  const c = map.getCenter();
  const far = haversineKm(c, lastSearch) > Math.max(1.5, (lastSearch.r / 1000) * 0.4);
  if (far !== moved) { moved = far; emit(); }
}

function setOrigin(lat, lng) {
  origin = { lat, lng };
  originLabel = "da te";
  if (userMarker) userMarker.setLatLng([lat, lng]);
  else userMarker = L.circleMarker([lat, lng], { radius: 8, color: "#ffffff", weight: 3, fillColor: "#2D7FF9", fillOpacity: 1 }).addTo(map);
}

async function getPosition() {
  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") throw new Error("permesso negato");
  }
  return Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function locate(silent) {
  if (!map) return;
  const fallback = (msg) => {
    status = msg;
    map.setView([FALLBACK.lat, FALLBACK.lng], FALLBACK.zoom);
    search();
  };
  status = "Cerco la tua posizione…"; emit();
  getPosition().then((pos) => {
    setOrigin(pos.coords.latitude, pos.coords.longitude);
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
    search();
  }).catch(() => {
    if (origin) { map.setView([origin.lat, origin.lng], 13); search(); return; }
    fallback(silent
      ? "Posizione non concessa: mostro Modena. Tocca «Vicino a me» per riprovare."
      : "Non riesco a leggere la posizione. Controlla i permessi dell'app e riprova.");
  });
}

function select(id, fly) {
  sel = sel === id ? null : id;
  drawMarkers();
  const p = places.find((x) => x.id === sel);
  if (p && fly) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  emit();
}

export const mapApi = {
  mount(el, cb) {
    onChange = cb;
    if (!map) {
      map = L.map(el, { zoomControl: true }).setView([FALLBACK.lat, FALLBACK.lng], FALLBACK.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.on("moveend", checkMoved);
    }
    map.invalidateSize();
    if (!started) {
      started = true;
      if (loadCache()) { drawMarkers(); emit(); }
      locate(true);
    }
  },
  locate() { locate(false); },
  searchHere() { search(); },
  setType(k) { type = k; if (sel && !visible().some((p) => p.id === sel)) sel = null; drawMarkers(); emit(); },
  select(id, fly) { select(id, fly !== false); },
  getState() {
    const counts = { farm: 0, contadino: 0, frutt: 0 };
    places.forEach((p) => { counts[p.type]++; });
    const list = visible().slice().sort((a, b) => (b.id === sel) - (a.id === sel) || a.km - b.km);
    return { list, counts, total: places.length, type, sel, status, busy, moved, originLabel };
  },
};
