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

// Archivio dei luoghi (OpenStreetMap Italia), costruito da GitHub ogni mese e incluso nell'app.
// Colonne: [id, tipo, lat, lng, nome, indirizzo, orari, sito, telefono]
const FALLBACK = { lat: 44.6471, lng: 10.9252, zoom: 12 };
const MAX_LIST = 150;

let map = null, layer = null, userMarker = null, timer = null;
let places = [], type = "all", sel = null;
let origin = null, originLabel = "da qui";
let notice = "", status = "", busy = false, moved = false, started = false;
let archive = null, archiveDate = "", loadError = false;
let onChange = function () {};

function emit() { onChange(); }

function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}


const DEFAULT_NAME = { frutt: "Fruttivendolo", farm: "Azienda agricola", contadino: "Mercato" };

function loadArchive() {
  return Promise.all([
    fetch("./data/luoghi.json").then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
    fetch("./data/luoghi-meta.json").then((r) => r.json()).catch(() => ({})),
  ]).then(([rows, meta]) => {
    archive = rows.map((r) => ({
      id: r[0], type: r[1], lat: r[2], lng: r[3],
      name: r[4] || DEFAULT_NAME[r[1]], addr: r[5], hours: r[6], website: r[7], phone: r[8],
    }));
    archiveDate = meta.data || "";
  });
}

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

function searchRadius() {
  const b = map.getBounds();
  const r = map.distance(b.getCenter(), b.getNorthEast()) * 0.95;
  return Math.round(Math.min(30000, Math.max(2000, r)));
}

function kmText(r) { return (r / 1000).toFixed(r < 10000 ? 1 : 0).replace(".", ","); }

// Ricerca nell'archivio: istantanea, funziona anche offline.
function search() {
  if (!map) return;
  if (loadError) { status = "Archivio dei luoghi non disponibile. Riavvia l'app e riprova."; emit(); return; }
  if (!archive) { status = "Carico l'archivio dei luoghi…"; busy = true; emit(); return; }
  busy = false; moved = false;
  const c = map.getCenter(), r = searchRadius();
  const dLat = r / 111320, dLng = r / (111320 * Math.cos(c.lat * Math.PI / 180));
  const ref = origin || { lat: c.lat, lng: c.lng };
  const found = [];
  for (let i = 0; i < archive.length; i++) {
    const p = archive[i];
    if (Math.abs(p.lat - c.lat) > dLat || Math.abs(p.lng - c.lng) > dLng) continue;
    const dc = haversineKm(c, p);
    if (dc * 1000 > r) continue;
    found.push({ p, dc });
  }
  found.sort((a, b) => a.dc - b.dc);
  places = found.slice(0, MAX_LIST).map((x) => { x.p.km = haversineKm(ref, x.p); return x.p; });
  if (sel && !places.some((p) => p.id === sel)) sel = null;
  const when = archiveDate ? " Dati OpenStreetMap del " + fmtDate(archiveDate) + "." : " Dati OpenStreetMap.";
  if (!archive.length) status = "L'archivio dei luoghi non è ancora stato creato. Riprova dopo il prossimo aggiornamento.";
  else if (!places.length) status = "Nessuna attività entro " + kmText(r) + " km: la zona potrebbe non essere mappata. Sposta la mappa." + when;
  else status = (found.length > MAX_LIST ? "Le " + MAX_LIST + " più vicine" : places.length + " attività") + " entro " + kmText(r) + " km." + when;
  if (notice) status = notice + " " + status;
  drawMarkers();
  emit();
}

function scheduleSearch() {
  clearTimeout(timer);
  timer = setTimeout(search, 350);
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
    notice = msg;
    map.setView([FALLBACK.lat, FALLBACK.lng], FALLBACK.zoom);
    search();
  };
  status = "Cerco la tua posizione…"; emit();
  getPosition().then((pos) => {
    notice = "";
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
      map.on("moveend", scheduleSearch);
      loadArchive().then(() => search()).catch(() => { loadError = true; search(); });
    }
    map.invalidateSize();
    if (!started) { started = true; locate(true); }
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
