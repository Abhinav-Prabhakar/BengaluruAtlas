#!/usr/bin/env python3
"""Build the Bengaluru Atlas dataset from the captured OSM slices and curated seeds.

This is intentionally dependency-free: stdlib only, so it runs anywhere Python 3.9+
is available. Inputs live in data/, output goes to app/public/data/atlas.json.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
OUT = ROOT / "app" / "public" / "data" / "atlas.json"

FOOD = {"restaurant", "cafe", "bar", "pub", "fast_food", "ice_cream", "food_court", "biergarten"}
CULTURE_AMENITY = {"theatre", "cinema", "library"}
SHOPS = {"books", "art", "antiques", "gift", "mall", "department_store"}
STAY = {"hotel", "guest_house", "hostel", "resort"}
WORSHIP = {"place_of_worship"}

CATEGORY_LABELS = {
    "eat": "Eat & drink",
    "coffee": "Coffee & bakeries",
    "outdoors": "Parks & outdoors",
    "culture": "Art & heritage",
    "worship": "Temples & faith",
    "shop": "Markets & shops",
    "stay": "Stay",
    "transit": "Metro & transit",
    "experience": "Experiences",
}

GENERIC_NAMES = {
    "restaurant", "cafe", "hotel", "bar", "pub", "shop", "bakery", "supermarket",
    "temple", "church", "mosque", "park", "food", "mess", "tiffin", "subway",
    "ice cream", "fast food", "guest house", "lodge", "residency",
}

CHAIN_HINTS = {
    "starbucks", "cafe coffee day", "ccd", "third wave", "blue tokai", "barbeque nation",
    "domino's", "dominos", "pizza hut", "kfc", "mcdonald's", "mcdonalds", "burger king",
    "subway", "dunkin", "baskin robbins", "cream stone", "natural ice cream", "ibaco",
    "a2b", "adiga's", "anand sweets", "empire", "meghana", "byg brewski", "toit",
    "rameshwaram cafe", "third wave coffee", "social", "hard rock cafe",
}

# A few curated names differ from the official OSM station names.
CURATED_MATCH = {
    "majestic-metro": "Nadaprabhu Kempegowda Station, Majestic",
    "mg-road-metro": "Mahatma Gandhi Road",
    "cubbon-park-metro": "Cubbon Park",
    "indiranagar-metro": "Indiranagar",
    "lalbagh-metro": "Lalbagh",
    "jayanagar-metro": "Jayanagar",
    "rv-road-metro": "Rashtreeya Vidyalaya Road",
    "ksr-station": "KSR Bengaluru City Junction",
    "cantonment-station": "Bengaluru Cantonment",
    "yeshwantpur-station": "Yesvantpur Junction",
}

NORMALISE_RE = re.compile(r"[^a-z0-9 ]+")


def norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = text.lower().replace("&", " and ")
    text = NORMALISE_RE.sub(" ", text)
    text = re.sub(r"\b(bengaluru|bangalore)\b", "bengaluru", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_name(name: str) -> str:
    name = re.sub(r"^[A-Z]:\s+", "", name.strip())
    name = re.sub(r"\s+", " ", name)
    return name.strip(" ,;")


def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def haversine_km(a_lat, a_lon, b_lat, b_lon) -> float:
    r = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = p2 - p1
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1, math.sqrt(h)))


def element_point(el):
    if el.get("type") == "node":
        if "lat" in el and "lon" in el:
            return float(el["lat"]), float(el["lon"])
        return None
    center = el.get("center") or {}
    if "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])
    return None


def element_id(el):
    return f'{el.get("type")}/{el.get("id")}'


def osm_categories(tags):
    """Return (category, subcategory) for an OSM element, or None."""
    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    historic = tags.get("historic", "")
    leisure = tags.get("leisure", "")
    shop = tags.get("shop", "")
    natural = tags.get("natural", "")
    railway = tags.get("railway", "")
    public_transport = tags.get("public_transport", "")

    if amenity == "place_of_worship":
        religion = tags.get("religion", "").lower()
        sub = {
            "hindu": "Temple",
            "christian": "Church",
            "muslim": "Mosque",
            "sikh": "Gurudwara",
            "buddhist": "Monastery",
            "jain": "Temple",
        }.get(religion, "Place of worship")
        return "worship", sub

    if amenity in {"theatre", "cinema", "library"}:
        return "culture", {"theatre": "Theatre", "cinema": "Cinema", "library": "Library"}[amenity]

    if tourism in {"museum", "gallery", "artwork", "zoo", "aquarium", "attraction"}:
        return "culture", {
            "museum": "Museum", "gallery": "Gallery", "artwork": "Public art",
            "zoo": "Zoo", "aquarium": "Aquarium", "attraction": "Attraction",
        }[tourism]

    if tourism in {"viewpoint", "picnic_site"}:
        return "outdoors", "Viewpoint" if tourism == "viewpoint" else "Picnic spot"

    if historic:
        return "culture", {
            "monument": "Monument", "memorial": "Memorial", "fort": "Fort",
            "ruins": "Ruins", "archaeological_site": "Archaeological site",
            "palace": "Palace", "temple": "Heritage temple", "building": "Heritage building",
        }.get(historic, "Heritage")

    if leisure in {"park", "garden", "nature_reserve", "playground", "sports_centre", "swimming_pool", "stadium"}:
        return "outdoors", {
            "park": "Park", "garden": "Garden", "nature_reserve": "Nature reserve",
            "playground": "Playground", "sports_centre": "Sports centre",
            "swimming_pool": "Swimming pool", "stadium": "Stadium",
        }[leisure]

    if natural == "water":
        return "outdoors", "Lake"

    if amenity in FOOD:
        if amenity == "cafe":
            return "coffee", "Cafe"
        return "eat", {
            "restaurant": "Restaurant", "bar": "Bar", "pub": "Pub",
            "fast_food": "Fast food", "ice_cream": "Ice cream",
            "food_court": "Food court", "biergarten": "Beer garden",
        }[amenity]

    if shop == "bakery":
        return "coffee", "Bakery"

    if amenity == "marketplace":
        return "shop", "Market"

    if shop in SHOPS:
        return "shop", {
            "books": "Bookshop", "art": "Art shop", "antiques": "Antiques",
            "gift": "Gift shop", "mall": "Mall", "department_store": "Department store",
        }[shop]

    if tourism in STAY:
        return "stay", {
            "hotel": "Hotel", "guest_house": "Guesthouse",
            "hostel": "Hostel", "resort": "Resort",
        }[tourism]

    if railway == "station" or public_transport == "station":
        return "transit", "Railway station"

    return None


def category_group(cat):
    return "food" if cat in {"eat", "coffee"} else cat


def address(tags):
    number = (tags.get("addr:housenumber") or "").strip()
    street = (tags.get("addr:street") or "").strip()
    suburb = (tags.get("addr:suburb") or tags.get("addr:neighbourhood") or "").strip()
    parts = [p for p in [number, street, suburb] if p]
    return ", ".join(parts)


def wiki_title(tags):
    w = tags.get("wikipedia") or ""
    if ":" in w:
        w = w.split(":", 1)[1]
    return w.strip() or None


def numeric_jitter(text: str) -> int:
    return int(hashlib.md5(text.encode("utf-8")).hexdigest()[:6], 16) % 4


def score_place(tags, curated=None):
    if curated:
        return min(100, 72 + (10 if curated.get("gem") else 0) + numeric_jitter(curated["key"]))
    score = 8 + numeric_jitter(element_id(tags) if isinstance(tags, dict) and "id" in tags else str(tags))
    if tags.get("wikidata"):
        score += 18
    if tags.get("wikipedia"):
        score += 16
    if tags.get("description"):
        score += 8
    if tags.get("image"):
        score += 6
    if tags.get("website") or tags.get("contact:website"):
        score += 4
    if tags.get("opening_hours"):
        score += 2
    if tags.get("cuisine"):
        score += 1
    if tags.get("historic"):
        score += 12
    if tags.get("tourism") in {"museum", "gallery", "attraction", "zoo", "aquarium"}:
        score += 10
    if tags.get("leisure") in {"park", "garden", "nature_reserve"}:
        score += 6
    if tags.get("natural") == "water":
        score += 4
    if tags.get("amenity") == "place_of_worship":
        score += 2
    if tags.get("brand"):
        score -= 10
    if len(tags.get("name", "")) > 32:
        score -= 2
    if tags.get("name", "").strip().lower() in GENERIC_NAMES:
        score -= 12
    return max(0, min(100, score))


def is_chain(tags):
    name = (tags.get("name") or "").strip().lower()
    return bool(tags.get("brand")) or any(h in name for h in CHAIN_HINTS)


def display_tags(tags, cat, sub):
    out = []
    cuisine = tags.get("cuisine") or ""
    for c in re.split(r"[;,]", cuisine):
        c = c.strip().replace("_", " ")
        if c and c not in out:
            out.append(c)
    for key in ("historic", "tourism", "leisure", "shop", "religion"):
        v = tags.get(key)
        if v:
            v = v.replace("_", " ")
            if v not in out and v not in {"yes", "place of worship"}:
                out.append(v)
    if tags.get("diet:vegetarian") == "yes" and "vegetarian" not in out:
        out.append("vegetarian")
    if tags.get("outdoor_seating") == "yes":
        out.append("outdoor seating")
    if tags.get("takeaway") == "yes":
        out.append("takeaway")
    if tags.get("wheelchair") == "yes":
        out.append("wheelchair access")
    if tags.get("brand"):
        out.append(tags["brand"])
    if not out:
        out.append(sub.lower())
    return out[:4]


def load_osm():
    elements = {}
    files = sorted(RAW.glob("osm_*.json"))
    for path in files:
        data = load_json(path)
        if not isinstance(data, dict):
            continue
        for el in data.get("elements", []):
            if not el.get("tags", {}).get("name"):
                continue
            elements[element_id(el)] = el
    return elements


def make_osm_place(el, areas):
    tags = el.get("tags", {})
    name = clean_name(tags.get("name", ""))
    pt = element_point(el)
    if not name or not pt:
        return None
    cat_sub = osm_categories(tags)
    if not cat_sub:
        return None
    cat, sub = cat_sub
    if tags.get("name", "").strip().lower() in GENERIC_NAMES and not tags.get("brand"):
        return None
    lat, lon = pt
    area = nearest_area(lat, lon, areas)
    score = score_place({**tags, "id": el.get("id")})
    return {
        "id": element_id(el),
        "name": name,
        "cat": cat,
        "sub": sub,
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "area": area,
        "tags": display_tags(tags, cat, sub),
        "addr": address(tags),
        "hours": tags.get("opening_hours"),
        "web": tags.get("website") or tags.get("contact:website"),
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "wiki": wiki_title(tags),
        "wd": tags.get("wikidata"),
        "osm": element_id(el),
        "score": score,
        "chain": is_chain(tags),
        "gem": bool(score >= 34 and not tags.get("wikipedia") and not is_chain(tags) and cat in {"eat", "coffee", "shop", "culture", "outdoors"}),
    }


def nearest_area(lat, lon, areas):
    best = None
    best_d = 1e9
    for a in areas:
        d = haversine_km(lat, lon, a["lat"], a["lon"])
        if d < best_d:
            best_d = d
            best = a
    if best and best_d <= 6.5:
        return best["name"]
    return "Bengaluru"


def train_metro(areas):
    """Deduplicated metro stations from the OSM metro slice."""
    data = load_json(RAW / "osm_metro.json") or {}
    by_name = {}
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = clean_name(tags.get("name", ""))
        if not name:
            continue
        if re.search(r"\((u/c|proposed|under construction)\)", name, re.I):
            continue
        if tags.get("railway") not in {"station"} and tags.get("station") != "subway":
            continue
        if tags.get("public_transport") == "stop_position":
            continue
        pt = element_point(el)
        if not pt:
            continue
        key = norm(name)
        rank = 2 if tags.get("railway") == "station" else 1
        if key not in by_name or rank > by_name[key][0]:
            by_name[key] = (rank, el, pt, name)
    out = []
    for rank, el, (lat, lon), name in by_name.values():
        tags = el.get("tags", {})
        out.append({
            "id": f"metro:{norm(name)}",
            "name": name,
            "cat": "transit",
            "sub": "Metro station",
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "area": nearest_area(lat, lon, areas),
            "tags": ["Namma Metro"],
            "addr": "",
            "hours": None,
            "web": None,
            "phone": None,
            "wiki": wiki_title(tags),
            "wd": tags.get("wikidata"),
            "osm": element_id(el),
            "score": 36,
            "chain": False,
            "gem": False,
        })
    return out


def name_similarity(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0
    if a == b:
        return 1.0
    if len(a) > 3 and len(b) > 3 and (a in b or b in a):
        return 0.88
    ta, tb = set(a.split()), set(b.split())
    if ta and tb:
        j = len(ta & tb) / len(ta | tb)
        return j * 0.8
    return 0


def merge_curated(curated, osm_places, areas, wiki, rest, manual):
    wiki_lookup = {}
    for source in (wiki or {}, rest or {}):
        for k, v in source.items():
            wiki_lookup.setdefault(norm(k), v)
    used = set()
    out = []
    for c in curated:
        cat = c["category"]
        cands = []
        if cat != "experience":
            for p in osm_places:
                if p["id"] in used:
                    continue
                if category_group(p["cat"]) != category_group(cat):
                    continue
                d = haversine_km(c["lat"], c["lon"], p["lat"], p["lon"])
                if d > 0.9:
                    continue
                sim = name_similarity(CURATED_MATCH.get(c["key"]) or c.get("match") or c["name"], p["name"])
                # Transit names often include extra words; allow a looser match.
                if cat == "transit" and sim < 0.6 and (norm(c["name"]) in norm(p["name"]) or norm(p["name"]) in norm(c["name"])):
                    sim = 0.7
                if sim < 0.62:
                    continue
                cands.append((sim - d * 0.25, p))
        best = max(cands, key=lambda x: x[0])[1] if cands else None
        if best:
            used.add(best["id"])
        w = wiki_lookup.get(norm(c.get("wiki") or ""))
        m = (manual or {}).get(c["key"]) or {}
        img = m.get("image") or (w.get("image") if w else None)
        img_page = m.get("page") or (f'https://en.wikipedia.org/wiki/{c["wiki"].replace(" ", "_")}' if img and c.get("wiki") else None)
        # A generic "Namma Metro" photo on every station is worse than a designed tile.
        if cat == "transit" and c["sub"] in {"Metro station", "Bus terminal"}:
            img, img_page = None, None
        if c["key"] == "jayanagar-4th-block":
            img, img_page = None, None
        place = {
            "id": f'curated:{c["key"]}',
            "name": c["name"],
            "cat": cat,
            "sub": c["sub"],
            "lat": round(c["lat"], 5),
            "lon": round(c["lon"], 5),
            "area": c["area"],
            "note": c.get("note"),
            "why": c.get("why", []),
            "mustTry": c.get("mustTry"),
            "bestTime": c.get("bestTime"),
            "price": c.get("price"),
            "diet": c.get("diet"),
            "tags": c.get("tags", []),
            "addr": (best or {}).get("addr") or "",
            "hours": (best or {}).get("hours"),
            "web": (best or {}).get("web"),
            "phone": (best or {}).get("phone"),
            "wiki": c.get("wiki") or (best or {}).get("wiki"),
            "wd": (best or {}).get("wd"),
            "osm": (best or {}).get("osm"),
            "img": img,
            "imgPage": img_page,
            "imgCredit": m.get("credit") if img else None,
            "imgLicense": m.get("license") if img else None,
            "score": score_place({}, curated=c),
            "chain": bool(c.get("chain")),
            "gem": bool(c.get("gem")),
            "curated": True,
            "seasonal": c.get("seasonal"),
        }
        out.append(place)
    return out, used


def dedupe_osm(osm_places):
    by_name = {}
    for p in osm_places:
        by_name.setdefault(norm(p["name"]), []).append(p)
    keep = []
    for name, group in by_name.items():
        group.sort(key=lambda p: -p["score"])
        chosen = []
        for p in group:
            radius = 0.8 if p["cat"] in {"outdoors", "worship"} else 0.35
            if any(haversine_km(p["lat"], p["lon"], q["lat"], q["lon"]) < radius for q in chosen):
                continue
            chosen.append(p)
        keep.extend(chosen)
    return keep


def build():
    areas = load_json(DATA / "areas.json") or []
    curated = load_json(DATA / "curated.json") or []
    trails = load_json(DATA / "trails.json") or []
    wiki = load_json(DATA / "wiki_images.json") or {}
    wiki_rest = load_json(DATA / "wiki_images_rest.json") or {}
    images_manual = load_json(DATA / "images_manual.json") or {}

    elements = load_osm()
    osm_places = []
    for el in elements.values():
        p = make_osm_place(el, areas)
        if p:
            osm_places.append(p)
    osm_places.extend(train_metro(areas))

    # Railway stations, deduped, only real stations.
    seen_rail = set()
    for el in (load_json(RAW / "osm_transit.json") or {}).get("elements", []):
        tags = el.get("tags", {})
        if tags.get("railway") != "station" or not tags.get("name"):
            continue
        pt = element_point(el)
        if not pt:
            continue
        key = norm(tags["name"])
        if key in seen_rail:
            continue
        seen_rail.add(key)
        lat, lon = pt
        osm_places.append({
            "id": f"rail:{key}",
            "name": clean_name(tags["name"]),
            "cat": "transit",
            "sub": "Railway station",
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "area": nearest_area(lat, lon, areas),
            "tags": ["Indian Railways"],
            "addr": address(tags),
            "hours": None,
            "web": tags.get("website"),
            "phone": None,
            "wiki": wiki_title(tags),
            "wd": tags.get("wikidata"),
            "osm": element_id(el),
            "score": 30,
            "chain": False,
            "gem": False,
        })

    curated_places, used = merge_curated(curated, osm_places, areas, wiki, wiki_rest, images_manual)
    remaining = dedupe_osm([p for p in osm_places if p["id"] not in used])
    # Keep the atlas curated and independent: drop generic chain outlets,
    # except any that scored unusually high (a historic chain location, etc.).
    remaining = [p for p in remaining if not p.get("chain") or p["score"] >= 55]

    places = curated_places + remaining
    # Curated entries always win; sort by score then name for stable output.
    places.sort(key=lambda p: (-p["score"], p["name"]))

    # Resolve trail stops.
    by_key = {c["key"]: p for c, p in zip(curated, curated_places)}
    resolved_trails = []
    for t in trails:
        stops = []
        for s in t.get("stops", []):
            if isinstance(s, str):
                p = by_key.get(s)
                if not p:
                    continue
                stops.append({
                    "key": s, "name": p["name"], "lat": p["lat"], "lon": p["lon"],
                    "cat": p["cat"], "note": p.get("note"), "id": p["id"],
                })
            else:
                stops.append({
                    "key": None, "name": s["name"], "lat": s["lat"], "lon": s["lon"],
                    "cat": "experience", "note": s.get("note"), "id": None,
                })
        resolved_trails.append({**t, "stops": stops, "stopCount": len(stops)})

    counts = {}
    for p in places:
        counts[p["cat"]] = counts.get(p["cat"], 0) + 1

    meta = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total": len(places),
        "curated": sum(1 for p in places if p.get("curated")),
        "areas": len(areas),
        "counts": counts,
        "bbox": [77.43, 12.83, 77.78, 13.10],
        "sources": [
            "© OpenStreetMap contributors (ODbL)",
            "OpenFreeMap (map tiles)",
            "Wikipedia / Wikimedia Commons (curated photography)",
            "Open-Meteo (weather)",
        ],
        "note": "Travel times are estimates from crow-flies distance and mode speeds, not live traffic. Verify with Google Maps before you go.",
    }

    payload = {"meta": meta, "areas": areas, "places": places, "trails": resolved_trails}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size/1024/1024:.2f} MB)")
    print(f"places={len(places)} curated={meta['curated']} trails={len(resolved_trails)}")
    print("counts", counts)
    print("curated with images", sum(1 for p in places if p.get("img")))


if __name__ == "__main__":
    build()
