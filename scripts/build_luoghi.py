#!/usr/bin/env python3
"""Costruisce l'archivio dei luoghi con comune, provincia e regione.

Uso: build_luoghi.py luoghi.geojsonseq confini.geojsonseq output.json meta.json

Formato di output:
{"v":2,"reg":[nome,...],"prov":[[nome,sigla,regIdx],...],"com":[[nome,provIdx],...],
 "luoghi":[[id,tipo,lat,lng,nome,indirizzo,orari,sito,telefono,comuneIdx],...]}
tipo: farm (azienda agricola), frutt (fruttivendolo), contadino (mercato). comuneIdx = -1 se ignoto.
"""
import json, sys, datetime
import shapely
from shapely.geometry import shape, Point
from shapely.strtree import STRtree

src, bsrc, out, meta = sys.argv[1:5]

def classify(t):
    if t.get("shop") == "greengrocer": return "frutt"
    if t.get("shop") == "farm": return "farm"
    if t.get("amenity") == "marketplace": return "contadino"
    return None

def centroid(g):
    if g["type"] == "Point": return g["coordinates"][1], g["coordinates"][0]
    ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0] if g["type"] == "MultiPolygon" else None
    if ring is None: return None
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return (min(ys) + max(ys)) / 2, (min(xs) + max(xs)) / 2

def clean(s): return " ".join(str(s or "").split())[:160]
def site(u):
    u = clean(u)
    if u and not u.startswith(("http://", "https://")): u = "https://" + u
    return u

def lines(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip().lstrip("\x1e")
            if not line: continue
            try: yield json.loads(line)
            except ValueError: continue

# ---- confini amministrativi ----
levels = {4: [], 6: [], 8: []}
for feat in lines(bsrc):
    tags = feat.get("properties") or {}
    try: lv = int(tags.get("admin_level"))
    except (TypeError, ValueError): continue
    if lv not in levels or tags.get("boundary") != "administrative": continue
    name = clean(tags.get("name:it") or tags.get("name"))
    if not name: continue
    try:
        geom = shapely.make_valid(shape(feat["geometry"]))
    except Exception:
        continue
    if geom.is_empty: continue
    sigla = clean(tags.get("ISO3166-2", "")).split("-")[-1] if tags.get("ISO3166-2") else clean(tags.get("ref"))
    levels[lv].append({"name": name, "sigla": sigla[:3], "geom": geom, "area": geom.area})
print({k: len(v) for k, v in levels.items()})

def index(lv):
    items = levels[lv]
    return items, STRtree([i["geom"] for i in items])

def find(idx, pt):
    items, tree = idx
    best = None
    for i in tree.query(pt, predicate="within"):
        it = items[int(i)]
        if best is None or it["area"] < best["area"]: best = it
    return best

reg_idx, prov_idx, com_idx = index(4), index(6), index(8)
reg_names, reg_pos = [], {}
prov_list, prov_pos = [], {}
com_list, com_pos = [], {}

def region_of(pt):
    r = find(reg_idx, pt)
    if not r: return -1
    if r["name"] not in reg_pos: reg_pos[r["name"]] = len(reg_names); reg_names.append(r["name"])
    return reg_pos[r["name"]]

def province_of(pt):
    p = find(prov_idx, pt)
    if not p:
        # Regioni senza livello province in OSM (es. Valle d'Aosta): la regione fa da provincia
        r = find(reg_idx, pt)
        if not r: return -1
        k = (r["name"], "AO" if r["name"].startswith("Valle d") else "")
        if k not in prov_pos:
            prov_pos[k] = len(prov_list)
            prov_list.append([r["name"], k[1], region_of(pt)])
        return prov_pos[k]
    k = (p["name"], p["sigla"])
    if k not in prov_pos:
        prov_pos[k] = len(prov_list)
        prov_list.append([p["name"], p["sigla"], region_of(p["geom"].representative_point())])
    return prov_pos[k]

def comune_of(pt):
    c = find(com_idx, pt)
    if not c: return -1
    rp = c["geom"].representative_point()
    pi = province_of(rp)
    k = (c["name"], pi)
    if k not in com_pos:
        com_pos[k] = len(com_list)
        com_list.append([c["name"], pi])
    return com_pos[k]

# ---- luoghi ----
rows, seen, nocom = [], set(), 0
for feat in lines(src):
    tags = feat.get("properties") or {}
    t = classify(tags)
    c = centroid(feat.get("geometry") or {}) if t else None
    if not t or not c: continue
    oid = str(feat.get("id") or "")
    if not oid or oid in seen: continue
    seen.add(oid)
    street = " ".join(x for x in [tags.get("addr:street"), tags.get("addr:housenumber")] if x)
    city = tags.get("addr:city") or tags.get("addr:suburb") or tags.get("addr:place") or ""
    addr = ", ".join(x for x in [street, city] if x)
    ci = comune_of(Point(c[1], c[0]))
    if ci >= 0:
        pi = com_list[ci][1]
        if pi < 0 or prov_list[pi][2] < 0:   # fuori dall'Italia (es. distretti svizzeri)
            continue
    else:
        nocom += 1
    rows.append([oid, t, round(c[0], 5), round(c[1], 5), clean(tags.get("name")), clean(addr),
                 clean(tags.get("opening_hours")),
                 site(tags.get("website") or tags.get("contact:website")),
                 clean(tags.get("phone") or tags.get("contact:phone")), ci])

rows.sort(key=lambda r: (r[2], r[3]))
with open(out, "w", encoding="utf-8") as f:
    json.dump({"v": 2, "reg": reg_names, "prov": prov_list, "com": com_list, "luoghi": rows},
              f, ensure_ascii=False, separators=(",", ":"))
counts = {}
for r in rows: counts[r[1]] = counts.get(r[1], 0) + 1
with open(meta, "w", encoding="utf-8") as f:
    json.dump({"data": datetime.date.today().isoformat(), "totale": len(rows), "per_tipo": counts,
               "senza_comune": nocom, "regioni": len(reg_names), "province": len(prov_list), "comuni": len(com_list)}, f)
print(len(rows), counts, "senza comune:", nocom, "regioni", len(reg_names), "province", len(prov_list), "comuni", len(com_list))
