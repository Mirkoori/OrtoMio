#!/usr/bin/env python3
"""Legge un GeoJSON-seq esportato da osmium e scrive l'archivio compatto dei luoghi.

Uso: build_luoghi.py input.geojsonseq output.json meta.json
Ogni luogo è un array: [id, tipo, lat, lng, nome, indirizzo, orari, sito, telefono]
tipo: farm (azienda agricola), frutt (fruttivendolo), contadino (mercato)
"""
import json, sys, datetime

src, out, meta = sys.argv[1:4]

def classify(t):
    if t.get("shop") == "greengrocer": return "frutt"
    if t.get("shop") == "farm": return "farm"
    if t.get("amenity") == "marketplace": return "contadino"
    return None

def centroid(g):
    if g["type"] == "Point":
        return g["coordinates"][1], g["coordinates"][0]
    if g["type"] == "Polygon":
        ring = g["coordinates"][0]
    elif g["type"] == "MultiPolygon":
        ring = g["coordinates"][0][0]
    else:
        return None
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return (min(ys) + max(ys)) / 2, (min(xs) + max(xs)) / 2

def clean(s):
    return " ".join(str(s or "").split())[:160]

def site(u):
    u = clean(u)
    if u and not u.startswith(("http://", "https://")): u = "https://" + u
    return u

rows, seen = [], set()
with open(src, encoding="utf-8") as f:
    for line in f:
        line = line.strip().lstrip("\x1e")
        if not line: continue
        try: feat = json.loads(line)
        except ValueError: continue
        tags = feat.get("properties") or {}
        t = classify(tags)
        c = centroid(feat.get("geometry") or {}) if t else None
        if not t or not c: continue
        oid = str(feat.get("id") or tags.get("@id") or "")
        if not oid or oid in seen: continue
        seen.add(oid)
        street = " ".join(x for x in [tags.get("addr:street"), tags.get("addr:housenumber")] if x)
        city = tags.get("addr:city") or tags.get("addr:suburb") or tags.get("addr:place") or ""
        addr = ", ".join(x for x in [street, city] if x)
        rows.append([oid, t, round(c[0], 5), round(c[1], 5), clean(tags.get("name")), clean(addr),
                     clean(tags.get("opening_hours")),
                     site(tags.get("website") or tags.get("contact:website")),
                     clean(tags.get("phone") or tags.get("contact:phone"))])

rows.sort(key=lambda r: (r[2], r[3]))
with open(out, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
counts = {}
for r in rows: counts[r[1]] = counts.get(r[1], 0) + 1
with open(meta, "w", encoding="utf-8") as f:
    json.dump({"data": datetime.date.today().isoformat(), "totale": len(rows), "per_tipo": counts}, f)
print(len(rows), counts)
