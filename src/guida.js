// Guida ai produttori: archivio incluso nell'app (OpenStreetMap Italia), filtri per regione, provincia e città.
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Preferences } from "@capacitor/preferences";

export const TYPES = [
  { k: "all", l: "Tutti" },
  { k: "farm", l: "Aziende agricole" },
  { k: "contadino", l: "Mercati" },
  { k: "frutt", l: "Fruttivendoli" },
];
export const TLAB = { farm: "Azienda agricola", contadino: "Mercato", frutt: "Fruttivendolo" };
const DEFAULT_NAME = TLAB;
const STORE = "ortomio-guida";
const PAGE = 40;

let places = [], regs = [], provs = [], coms = [];
let archiveDate = "", loaded = false, loadError = false;
let f = { reg: "", prov: "", com: "", type: "all", q: "", near: false };
let origin = null, nearMsg = "", limit = PAGE;
let onChange = function () {};

function emit() { onChange(); }
function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function save() {
  const s = JSON.stringify({ reg: f.reg, prov: f.prov, com: f.com, type: f.type });
  try { Preferences.set({ key: STORE, value: s }).catch(function () {}); } catch (e) {}
  try { localStorage.setItem(STORE, s); } catch (e) {}
}
async function restore() {
  let raw = null;
  try { raw = (await Preferences.get({ key: STORE })).value; } catch (e) {}
  if (!raw) { try { raw = localStorage.getItem(STORE); } catch (e) {} }
  try {
    const o = JSON.parse(raw || "null");
    if (o) { f.reg = o.reg || ""; f.prov = o.prov || ""; f.com = o.com || ""; f.type = o.type || "all"; }
  } catch (e) {}
}

function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

function load() {
  return Promise.all([
    fetch("./data/luoghi.json").then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
    fetch("./data/luoghi-meta.json").then((r) => r.json()).catch(() => ({})),
    restore(),
  ]).then(([d, meta]) => {
    regs = d.reg || []; provs = d.prov || []; coms = d.com || [];
    places = (d.luoghi || []).map((r) => {
      const ci = r[9], c = ci >= 0 ? coms[ci] : null, p = c && c[1] >= 0 ? provs[c[1]] : null, rg = p && p[2] >= 0 ? regs[p[2]] : null;
      const city = c ? c[0] : (r[5] && r[5].indexOf(",") > -1 ? r[5].split(",").pop().trim() : "");
      const pr = {
        id: r[0], type: r[1], lat: r[2], lng: r[3], name: r[4] || "", addr: r[5], hours: r[6], website: r[7], phone: r[8],
        city: city, sigla: p ? p[1] : "", prov: p ? p[0] : "", reg: rg || "",
        comKey: c ? c[0] + "|" + (p ? p[0] : "") : "", km: null,
      };
      pr.search = norm(pr.name + " " + pr.city + " " + pr.addr + " " + pr.prov);
      return pr;
    });
    archiveDate = meta.data || "";
    loaded = true;
    // se i filtri salvati non esistono più, si azzerano
    if (f.reg && regs.indexOf(f.reg) < 0) { f.reg = ""; f.prov = ""; f.com = ""; }
    emit();
  }).catch(() => { loadError = true; emit(); });
}

function matches(p, skip) {
  if (skip !== "type" && f.type !== "all" && p.type !== f.type) return false;
  if (skip !== "geo") {
    if (f.reg && p.reg !== f.reg) return false;
    if (f.prov && p.prov !== f.prov) return false;
    if (f.com && p.comKey !== f.com) return false;
  }
  if (f.q) {
    const words = norm(f.q).split(/\s+/).filter(Boolean);
    for (const w of words) if (p.search.indexOf(w) < 0) return false;
  }
  return true;
}

function active() { return !!(f.reg || f.prov || f.com || f.q || f.near); }

function unique(list) { return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, "it")); }

function getState() {
  const inGeo = places.filter((p) => matches(p, "type"));
  const counts = { farm: 0, contadino: 0, frutt: 0 };
  inGeo.forEach((p) => { counts[p.type]++; });
  const regOpts = unique(places.map((p) => p.reg).filter(Boolean));
  const provOpts = unique(places.filter((p) => !f.reg || p.reg === f.reg).map((p) => p.prov).filter(Boolean));
  const comMap = new Map();
  places.forEach((p) => {
    if (!p.comKey || (f.reg && p.reg !== f.reg) || (f.prov && p.prov !== f.prov)) return;
    comMap.set(p.comKey, { key: p.comKey, name: p.city + (f.prov ? "" : " (" + p.sigla + ")"), n: ((comMap.get(p.comKey) || {}).n || 0) + 1 });
  });
  const comOpts = Array.from(comMap.values()).sort((a, b) => a.name.localeCompare(b.name, "it"));
  let list = [];
  if (loaded && active()) {
    list = places.filter((p) => matches(p));
    if (f.near && origin) {
      list.forEach((p) => { p.km = haversineKm(origin, p); });
      list.sort((a, b) => a.km - b.km);
    } else {
      list.sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || a.city.localeCompare(b.city, "it") || a.name.localeCompare(b.name, "it"));
      list.forEach((p) => { p.km = null; });
    }
  }
  return {
    loaded, loadError, f: Object.assign({}, f), counts, total: places.length, date: fmtDate(archiveDate),
    regOpts, provOpts, comOpts, active: active(), found: list.length, list: list.slice(0, limit), more: Math.max(0, list.length - limit),
    nearMsg, near: f.near && !!origin, displayName: (p) => p.name || DEFAULT_NAME[p.type],
  };
}

async function getPosition() {
  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") throw new Error("permesso negato");
  }
  return Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

export const guida = {
  mount(cb) { onChange = cb; if (!loaded && !loadError && !guida._loading) { guida._loading = true; load(); } },
  getState,
  setReg(v) { f.reg = v; f.prov = ""; f.com = ""; f.near = false; limit = PAGE; save(); emit(); },
  setProv(v) {
    f.prov = v; f.com = ""; f.near = false; limit = PAGE;
    if (v && !f.reg) { const p = places.find((x) => x.prov === v); if (p) f.reg = p.reg; }
    save(); emit();
  },
  setCom(v) {
    f.com = v; f.near = false; limit = PAGE;
    if (v) { const p = places.find((x) => x.comKey === v); if (p) { f.reg = p.reg; f.prov = p.prov; } }
    save(); emit();
  },
  setType(k) { f.type = k; limit = PAGE; save(); emit(); },
  setQuery(q) { f.q = q; limit = PAGE; emit(); },
  more() { limit += PAGE; emit(); },
  reset() { f = { reg: "", prov: "", com: "", type: "all", q: "", near: false }; nearMsg = ""; limit = PAGE; save(); emit(); },
  nearMe() {
    nearMsg = "Cerco la tua posizione…"; emit();
    getPosition().then((pos) => {
      origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      f.reg = f.prov = f.com = ""; f.near = true; nearMsg = ""; limit = PAGE; emit();
    }).catch(() => {
      nearMsg = "Non riesco a leggere la posizione. Controlla i permessi dell'app oppure scegli una città dall'elenco."; emit();
    });
  },
};
