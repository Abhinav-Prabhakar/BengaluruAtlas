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

    # Transit is not a destination. The atlas is for places worth going to,
    # so stations and stops are deliberately left out of the POI layer.
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
    # "Lal Bagh" and "Lalbagh Botanical Gardens" are the same place.
    ca, cb = a.replace(" ", ""), b.replace(" ", "")
    if len(ca) > 4 and len(cb) > 4 and (ca in cb or cb in ca):
        return 0.84
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
            "tier": "editor",
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


# ---------------------------------------------------------------------------
# Atlas picks
#
# The hand-written list stays small and deliberate. Beyond it, we promote the
# most interesting OpenStreetMap places into a second tier of atlas picks:
# museums, temples, lakes, bookshops, markets, old cafes and the like. They get
# a short note, a few visual tags and any Wikimedia photograph we already have.
# ---------------------------------------------------------------------------

PROMOTE = {
    "culture": 34,
    "worship": 28,
    "outdoors": 28,
    "shop": 24,
    "coffee": 18,
    "eat": 18,
    "stay": 4,
}
PER_AREA = {
    "culture": 3,
    "worship": 2,
    "outdoors": 3,
    "shop": 3,
    "coffee": 3,
    "eat": 2,
    "stay": 1,
}
MIN_SCORE = {
    "culture": 22,
    "worship": 20,
    "outdoors": 24,
    "shop": 24,
    "coffee": 28,
    "eat": 30,
    "stay": 50,
}
EXCLUDE_SUB = {
    "shop": {"Mall", "Department store"},
    "eat": {"Food court"},
}


def build_image_lookup(wiki, wiki_rest):
    lookup = {}
    for source in (wiki_rest or {}, wiki or {}):
        for key, value in source.items():
            lookup.setdefault(norm(key), value)
    return lookup


def promo_image(place, lookup):
    keys = [norm(place["name"])]
    if place.get("wiki"):
        keys.append(norm(place["wiki"]))
    for key in keys:
        entry = lookup.get(key)
        if not entry or not entry.get("image"):
            continue
        page = entry.get("page")
        if not page and place.get("wiki"):
            page = f'https://en.wikipedia.org/wiki/{place["wiki"].replace(" ", "_")}'
        if not page and entry.get("title"):
            page = f'https://en.wikipedia.org/wiki/{entry["title"].replace(" ", "_")}'
        return entry["image"], page
    return None, None


def promo_why(place):
    tags = {t.lower() for t in place.get("tags", [])}
    out = []
    if tags & {"heritage", "monument", "fort", "palace", "memorial", "architecture"}:
        out.append("Heritage")
    if tags & {"park", "garden", "lake", "nature reserve"}:
        out.append("Green")
    if tags & {"books", "library"}:
        out.append("Books")
    if tags & {"art", "gallery", "museum", "artwork"}:
        out.append("Art")
    if tags & {"market", "shopping", "bazaar"}:
        out.append("Market")
    if tags & {"temple", "church", "mosque", "hindu", "christian", "muslim"}:
        out.append("Quiet")
    if tags & {"viewpoint", "views", "sunset"}:
        out.append("Views")
    if place["cat"] in {"eat", "coffee"}:
        out.append("Local")
    if place["cat"] == "outdoors":
        out.append("Outdoors")
    if place["cat"] == "culture":
        out.append("Culture")
    return out[:3] or ["Atlas pick"]


def promo_note(place):
    area = place["area"]
    sub = place["sub"].lower()
    cat = place["cat"]
    if cat == "culture":
        return f"A {sub} in {area}, part of the city's quieter cultural layer."
    if cat == "worship":
        return f"A {sub} in {area}; go early or at dusk for the calm."
    if cat == "outdoors":
        return f"A {sub} in {area} — a green pause in the city."
    if cat == "shop":
        return f"A {sub} in {area} worth a slow browse."
    if cat == "coffee":
        return f"A neighbourhood {sub} in {area}."
    if cat == "eat":
        return f"A {sub} in {area}."
    if cat == "stay":
        return f"A stay in {area}."
    return f"A place in {area}."


def promo_best_time(cat):
    return {
        "culture": "Afternoon",
        "worship": "Early morning or dusk",
        "outdoors": "Morning or sunset",
        "shop": "Late morning",
        "coffee": "Morning or afternoon",
        "eat": "Lunch or dinner",
        "stay": None,
    }.get(cat)


def promote_interesting(remaining, curated_places, image_lookup):
    curated_names = [p["name"] for p in curated_places]
    selected = []
    area_counts = {}
    for cat, target in PROMOTE.items():
        pool = [
            p for p in remaining
            if p["cat"] == cat
            and p["score"] >= MIN_SCORE[cat]
            and p["sub"] not in EXCLUDE_SUB.get(cat, set())
            and not p.get("chain")
            and p["name"].strip().lower() not in GENERIC_NAMES
        ]
        # Do not repeat a hand-curated place under another OSM object.
        pool = [
            p for p in pool
            if not any(name_similarity(p["name"], name) >= 0.92 for name in curated_names)
        ]
        pool.sort(key=lambda p: (-p["score"], p["name"]))
        chosen = 0
        for p in pool:
            if chosen >= target:
                break
            if area_counts.get((cat, p["area"]), 0) >= PER_AREA[cat]:
                continue
            # Skip near-identical objects already promoted in this category.
            duplicate = any(
                q["cat"] == cat
                and (
                    name_similarity(p["name"], q["name"]) >= 0.92
                    or haversine_km(p["lat"], p["lon"], q["lat"], q["lon"]) < 0.12
                )
                for q in selected
            )
            if duplicate:
                continue
            img, img_page = promo_image(p, image_lookup)
            promoted = {
                **p,
                "note": promo_note(p),
                "why": promo_why(p),
                "bestTime": promo_best_time(cat),
                "price": p.get("price"),
                "img": img,
                "imgPage": img_page,
                "imgCredit": None,
                "imgLicense": None,
                "score": min(82, max(56, p["score"] + 18)),
                "gem": False,
                "curated": True,
                "tier": "atlas",
            }
            selected.append(promoted)
            area_counts[(cat, p["area"])] = area_counts.get((cat, p["area"]), 0) + 1
            chosen += 1
    return selected


WIKI_SKIP = re.compile(
    r"\b(inscriptions?|hero stones?|strike|riots?|battle|elections?|hospitals?|medical|"
    r"sanatorium|schools?|colleges?|universit|academy|institute|tech park|aerodrome|"
    r"air force|railway|ttmc|metro|bus station|sports club|aerodrome|company|limited|"
    r"loco shed|terminal|sanatorium|foundation|society|trust)\b",
    re.I,
)
WIKI_SKIP_TITLES = {
    "Indira Canteens", "JustBooks", "Treebo Hotels", "The Park Hotels", "Centro (store)",
    "Darshini (restaurant)", "Samsung Opera House", "Prestige Kingfisher Towers",
    "Global Village Tech Park", "Diesel & Electric Loco Shed, Krishnarajapuram",
    "Sir M. Visvesvaraya Terminal", "Atal Bihari Vajpayee TTMC", "Banashankari TTMC",
    "Three Ovals KSCA Stadium", "Kanteerava Indoor Stadium", "Koramangala Indoor Stadium",
    "Mantri Square", "Orion Mall", "Nexus Mall (Koramangala)", "Garuda Mall",
}
WIKI_SKIP_TEXT = re.compile(
    r"\b(hospital|multispecialty|school|college|university|software company|"
    r"information technology|tech park|residential|apartment|real estate|"
    r"railway station|metro station|bus terminus)\b",
    re.I,
)

WIKI_KINDS = [
    ("worship", re.compile(r"\b(temple|church|masjid|mosque|basilica|gudi|math|shrine|chapel|tabernacle)\b", re.I)),
    ("outdoors", re.compile(r"\b(lake|reservoir|tank|park|garden|stadium|aquatic|ground|betta|hill|nursery|grove)\b", re.I)),
    ("eat", re.compile(r"\b(restaurant|tiffin|cafe|coffee|bakery|food street|darshini|biryani|hotel)\b", re.I)),
    ("shop", re.compile(r"\b(market|mall|bazaar|bookshop|bookstore|books|street)\b", re.I)),
    ("culture", re.compile(r"\b(museum|gallery|palace|fort|soudha|memorial|hall|parishath|kalakshetra|planetarium|theatre|archive|library|cemetery|tower|mahal|observatory)\b", re.I)),
]

WIKI_SUBS = [
    ("Lake", r"\b(lake|reservoir|tank)\b"), ("Park", r"\bpark\b"), ("Garden", r"\bgarden"),
    ("Stadium", r"\b(stadium|aquatic centre|ground)\b"),
    ("Temple", r"\b(temple|gudi|shrine|math)\b"), ("Church", r"\bchurch\b"),
    ("Mosque", r"\b(masjid|mosque)\b"), ("Basilica", r"\bbasilica\b"),
    ("Museum", r"\bmuseum\b"), ("Gallery", r"\bgallery\b"), ("Palace", r"\bpalace\b"),
    ("Fort", r"\bfort\b"), ("Market", r"\b(market|bazaar)\b"), ("Mall", r"\bmall\b"),
    ("Theatre", r"\b(theatre|kalakshetra|hall)\b"), ("Memorial", r"\bmemorial\b"),
    ("Planetarium", r"\bplanetarium\b"), ("Library", r"\blibrary\b"),
    ("Street", r"\b(street|road)\b"), ("Building", r"\b(soudha|building|house)\b"),
]


def wiki_category(title, kinds):
    if re.search(r"\bpalace hotel\b|\bresort\b", title, re.I):
        return "stay"
    for cat, pattern in WIKI_KINDS:
        if pattern.search(title):
            return cat
    for kind in kinds:
        if kind != "culture":
            return kind
    return "culture"


def wiki_sub(title):
    for label, pattern in WIKI_SUBS:
        if re.search(pattern, title, re.I):
            return label
    return "Landmark"


def first_sentence(text, limit=170):
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if not text:
        return ""
    cut = re.split(r"(?<=[a-z0-9\)\]”\"'][.!?])\s+", text)[0]
    if len(cut) > limit:
        cut = cut[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return cut


def merge_wiki(rows, curated_places, osm_places, areas):
    """Turn Wikipedia entries into editorial picks with real photos."""
    existing = list(curated_places)
    out = []
    for row in rows:
        title = row["title"]
        if title in WIKI_SKIP_TITLES or WIKI_SKIP.search(title):
            continue
        if WIKI_SKIP_TEXT.search(first_sentence(row.get("extract"))):
            continue
        cat = wiki_category(title, row.get("kinds") or [])
        lat, lon = row.get("lat"), row.get("lon")
        osm = None
        if lat is None:
            # No coordinate on Wikipedia: fall back to a same-named OSM object,
            # but only when the name is unambiguous in the city.
            key = norm(title)
            matches = [
                p for p in osm_places
                if norm(p["name"]) == key or norm(p["name"]).startswith(key + " ")
            ]
            if not matches:
                continue
            if len(matches) > 1 and max(
                haversine_km(matches[0]["lat"], matches[0]["lon"], m["lat"], m["lon"])
                for m in matches[1:]
            ) > 1.0:
                continue
            osm = matches[0]
            lat, lon = osm["lat"], osm["lon"]
        else:
            # Prefer the OSM pin when one exists within 250 m.
            for p in osm_places:
                if haversine_km(lat, lon, p["lat"], p["lon"]) < 0.25 and name_similarity(p["name"], title) > 0.8:
                    osm = p
                    break
        if any(
            name_similarity(p["name"], title) >= 0.9
            or haversine_km(lat, lon, p["lat"], p["lon"]) < 0.12
            for p in existing
        ):
            continue
        note = first_sentence(row.get("extract"))
        area = nearest_area(lat, lon, areas)
        sub = wiki_sub(title)
        if not note:
            note = f"A {sub.lower()} in {area}."
        why = {
            "culture": ["Heritage", "Collection", "Architecture"],
            "worship": ["Calm", "Heritage", "Architecture"],
            "outdoors": ["Green", "Walk", "Fresh air"],
            "shop": ["Browse", "Local", "Market"],
            "eat": ["Local", "Classic", "Must try"],
            "stay": ["Stay", "Neighbourhood"],
        }.get(cat, ["City life"])
        place = {
            "id": f'wiki:{norm(title).replace(" ", "-")}',
            "name": title,
            "cat": cat,
            "sub": sub,
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "area": area,
            "note": note,
            "why": why[:3],
            "mustTry": None,
            "bestTime": promo_best_time(cat),
            "price": None,
            "diet": None,
            "tags": [sub.lower()],
            "addr": (osm or {}).get("addr") or "",
            "hours": (osm or {}).get("hours"),
            "web": (osm or {}).get("web"),
            "phone": (osm or {}).get("phone"),
            "wiki": title,
            "wd": row.get("wikidata"),
            "osm": (osm or {}).get("osm"),
            "img": row.get("image"),
            "imgPage": row.get("page"),
            "imgCredit": "Wikimedia Commons" if row.get("image") else None,
            "imgLicense": None,
            "score": 72 if row.get("image") else 64,
            "chain": False,
            "gem": False,
            "curated": True,
            "tier": "wiki",
        }
        out.append(place)
        existing.append(place)
    return out


def add_wiki_images(places, rows):
    """Give any place with a matching encyclopedia entry a real photo."""
    index = {}
    for row in rows:
        index.setdefault(norm(row["title"]), row)
        # "Foo, Bengaluru" also answers to "Foo".
        short = re.sub(r",?\s*(bengaluru|bangalore)$", "", row["title"], flags=re.I)
        index.setdefault(norm(short), row)
    added = 0
    for p in places:
        if p.get("img"):
            continue
        row = index.get(norm(p["name"]))
        if not row or not row.get("image"):
            continue
        # Avoid attaching a photo of a different place with the same name.
        if row.get("lat") is not None and haversine_km(p["lat"], p["lon"], row["lat"], row["lon"]) > 2.5:
            continue
        p["img"] = row["image"]
        p["imgPage"] = row["page"]
        p["imgCredit"] = "Wikimedia Commons"
        added += 1
    return added


def name_tokens(name):
    stop = {
        "restaurant", "temple", "church", "museum", "garden", "gardens", "park",
        "lake", "hotel", "house", "palace", "market", "bar", "cafe", "coffee",
        "bakery", "theatre", "theater", "gallery", "memorial", "statue", "circle",
        "road", "street", "layout", "nagar", "bengaluru", "bangalore", "indian",
        "south", "north", "east", "west", "new", "old", "the", "and", "of",
    }
    return {w for w in norm(name).split() if len(w) >= 5 and w not in stop}


def dedupe_final(places):
    """One entry per real-world place, across editor, wiki and OSM layers.

    The layers are built independently, so the same museum can arrive as an
    editor pick, a Wikipedia article and an OSM way within a few dozen metres.
    Keep the richest, most editorial version and drop the rest.
    """
    tier_rank = {"editor": 0, "wiki": 1, "atlas": 2}

    def rank(p):
        return (
            tier_rank.get(p.get("tier"), 3),
            0 if p.get("img") else 1,
            -p.get("score", 0),
        )

    kept = []
    for place in sorted(places, key=rank):
        duplicate = False
        for other in kept:
            km = haversine_km(place["lat"], place["lon"], other["lat"], other["lon"])
            if km > 1.2:
                continue
            similar = name_similarity(place["name"], other["name"])
            if km < 0.02 and similar >= 0.85:
                duplicate = True
                break
            if km < 0.8 and similar >= 0.85:
                duplicate = True
                break
            if km < 0.35 and similar >= 0.55:
                duplicate = True
                break
            if km < 0.25 and (name_tokens(place["name"]) & name_tokens(other["name"])):
                duplicate = True
                break
        if not duplicate:
            kept.append(place)
    return kept


def build():
    areas = load_json(DATA / "areas.json") or []
    curated = load_json(DATA / "curated.json") or []
    trails = load_json(DATA / "trails.json") or []
    wiki = load_json(DATA / "wiki_images.json") or {}
    wiki_rest = load_json(DATA / "wiki_images_rest.json") or {}
    images_manual = load_json(DATA / "images_manual.json") or {}
    wiki_places = (load_json(DATA / "wiki_places.json") or {}).get("places") or []

    # Transit is not a destination. Drop the old metro / railway / airport
    # entries from the editorial list so the atlas stays a guide to places.
    curated = [c for c in curated if c.get("category") != "transit"]

    elements = load_osm()
    osm_places = []
    for el in elements.values():
        p = make_osm_place(el, areas)
        if p:
            osm_places.append(p)

    curated_places, used = merge_curated(curated, osm_places, areas, wiki, wiki_rest, images_manual)
    remaining = dedupe_osm([p for p in osm_places if p["id"] not in used])
    # Keep the atlas curated and independent: drop generic chain outlets,
    # except any that scored unusually high (a historic chain location, etc.).
    remaining = [p for p in remaining if not p.get("chain") or p["score"] >= 55]

    wiki_picks = merge_wiki(wiki_places, curated_places, remaining, areas)
    image_lookup = build_image_lookup(wiki, wiki_rest)
    promoted = promote_interesting(remaining, curated_places + wiki_picks, image_lookup)
    promoted_ids = {p["id"] for p in promoted}
    promoted_wiki_ids = {p["id"] for p in wiki_picks}

    places = curated_places + wiki_picks + promoted + [
        p for p in remaining
        if p["id"] not in promoted_ids and f'wiki:{norm(p["name"]).replace(" ", "-")}' not in promoted_wiki_ids
    ]
    photos = add_wiki_images(places, wiki_places)
    before = len(places)
    places = dedupe_final(places)
    # Curated entries always win; sort by score then name for stable output.
    places.sort(key=lambda p: (-p["score"], p["name"]))
    print(f"dedupe: {before - len(places)} duplicate places removed")

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
            "OSRM / OpenStreetMap.de (road routing)",
            "traffic-monitor-lizard (live corridor readings)",
            "Wikipedia / Wikimedia Commons (curated photography)",
            "Open-Meteo (weather)",
        ],
        "note": "Travel times on the first cards are routed on real roads and adjusted for live corridor speeds; the rest are modelled from distance, mode and the same live readings. Check Google Maps before you set off.",
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
