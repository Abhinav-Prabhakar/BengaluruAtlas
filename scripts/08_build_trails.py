#!/usr/bin/env python3
"""Compose a large, curated trail library from the atlas.

The hand-written twelve trails stay untouched. This script adds neighbourhood
walks, food crawls, temple runs, lake loops and day trips by clustering the
best places in the atlas: curated picks first, then high-scoring local finds.
Every trail is ordered by proximity, measured, and given a title, a time of day
and a note that names its first and last stops.

Output: data/trails_generated.json. The atlas build resolves every stopId back
to the live place record, so trail stops open the same detail panel as a card.

Stdlib only.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "app" / "public" / "data" / "atlas.json"
OUT = ROOT / "data" / "trails_generated.json"

CENTRE = (12.9716, 77.5946)
CITY_RADIUS_KM = 55.0

EXCLUDE_SUBS = {
    "memorial", "statue", "attraction", "artwork", "ruins", "mural",
    "apartment", "office", "company", "atm", "bus stop", "taxi",
    "clinic", "hospital", "pharmacy",
}
GENERIC_NAMES = {
    "hotel", "restaurant", "cafe", "coffee", "bakery", "bar", "pub", "park",
    "temple", "church", "mosque", "museum", "gallery", "market", "mall",
    "supermarket", "store", "shop", "the store", "the cafe",
}
FOOD_WORDS = re.compile(
    r"dosa|idli|tiffin|breakfast|south indian|udupi|bhavan|sagar|darshini|"
    r"biryani|kebab|kabab|mughlai|andhra|hyderabadi|military hotel|"
    r"chaat|pani puri|pav bhaji|street food|snack|sweet|"
    r"bakery|bread|cake|pastry|croissant|patisserie|"
    r"chinese|sichuan|schezwan|noodle|dim sum|manchurian|"
    r"pizza|pasta|italian|burger|sandwich|seafood|fish|prawn|"
    r"coffee|kaapi|espresso|roaster|"
    r"bar|pub|brew|cocktail|taproom|beer",
    re.I,
)


def load(path: Path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def haversine_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(h))


def quality(place: dict) -> float:
    score = float(place.get("score") or 0) * 0.55
    if place.get("curated"):
        score += 24
    tier = place.get("tier")
    if tier == "editor":
        score += 12
    elif tier == "wiki":
        score += 8
    elif tier == "atlas":
        score += 6
    if place.get("img"):
        score += 3
    if place.get("note"):
        score += 5
    if place.get("gem"):
        score += 2
    return score


def text_of(place: dict) -> str:
    return " ".join([
        place.get("name", ""),
        place.get("sub", ""),
        " ".join(place.get("tags") or []),
    ]).lower()


def usable(place: dict) -> bool:
    if place.get("cat") == "experience":
        return False
    if place.get("chain"):
        return False
    if place.get("sub", "").lower() in EXCLUDE_SUBS:
        return False
    name = place.get("name", "").strip().lower()
    if name in GENERIC_NAMES:
        return False
    if re.match(r"^(statue|bust|memorial) of\b", name):
        return False
    return True


def theme_pool(places: list[dict], predicate) -> list[dict]:
    return [p for p in places if usable(p) and predicate(p)]


def nearest_order(stops: list[dict]) -> list[dict]:
    if len(stops) < 3:
        return stops
    remaining = [s for s in stops if s is not stops[0]]
    ordered = [stops[0]]
    while remaining:
        last = ordered[-1]
        nxt = min(
            remaining,
            key=lambda p: haversine_km(last["lat"], last["lon"], p["lat"], p["lon"]),
        )
        ordered.append(nxt)
        remaining.remove(nxt)
    return ordered


def route_km(stops: list[dict], factor: float = 1.28) -> float:
    total = 0.0
    for a, b in zip(stops, stops[1:]):
        total += haversine_km(a["lat"], a["lon"], b["lat"], b["lon"])
    return total * factor


def centre_km(place: dict) -> float:
    return haversine_km(CENTRE[0], CENTRE[1], place["lat"], place["lon"])


def fmt_duration(minutes: float) -> str:
    minutes = max(30, round(minutes / 15) * 15)
    hours, mins = divmod(int(minutes), 60)
    if hours and mins:
        return f"{hours} hr {mins} min"
    if hours:
        return f"{hours} hour" if hours == 1 else f"{hours} hours"
    return f"{mins} min"


def fmt_distance(km: float) -> str:
    if km < 10:
        return f"{km:.1f} km"
    return f"{round(km)} km"


def dominant_area(stops: list[dict]) -> str:
    areas = Counter(s.get("area") for s in stops if s.get("area"))
    return areas.most_common(1)[0][0] if areas else "Bengaluru"


def stop_note(place: dict) -> str:
    note = (place.get("note") or "").strip()
    if note:
        return note
    return f"{place.get('sub', 'Place')} in {place.get('area', 'Bengaluru')}."


def make_stop(place: dict) -> dict:
    return {
        "placeId": place["id"],
        "name": place["name"],
        "lat": place["lat"],
        "lon": place["lon"],
        "cat": place["cat"],
        "note": stop_note(place),
        "area": place.get("area"),
        "tags": place.get("tags") or [],
    }


KIND_LABEL = {
    "walk": "City walk",
    "food": "Food crawl",
    "culture": "Culture walk",
    "outdoors": "Green loop",
    "shop": "Shop crawl",
    "night": "After dark",
    "daytrip": "Day trip",
}

KIND_COLOR = {
    "walk": ["#C2542E", "#B5713F", "#8A5A35", "#A44551"],
    "food": ["#C2542E", "#B5713F", "#A44551", "#9A6B2F"],
    "culture": ["#3F5D86", "#7D4A66", "#8A6A45", "#5A6E8C"],
    "outdoors": ["#4E7A4B", "#3F6F86", "#6B7A45", "#4F7F63"],
    "shop": ["#7D4A66", "#8A5A70", "#6E5A7D", "#9A6B2F"],
    "night": ["#6A4A86", "#9A6B2F", "#7A4A5C", "#4E6A86"],
    "daytrip": ["#7D6A4A", "#6B7A45", "#3F6F86", "#8A6A45"],
}


THEMES = [
    {
        "id": "coffee",
        "kind": "food",
        "label": "Coffee crawl",
        "want": 12,
        "radius": 2.4,
        "max_stops": 5,
        "bestTime": "8am–11am",
        "titles": ["{area}, cup by cup", "A slow coffee crawl in {area}", "Filter coffee in {area}"],
        "kicker": "Roasters, old rooms and a strong filter kaapi",
        "intro": "A short coffee crawl for a slow morning.",
        "match": lambda p: p["cat"] == "coffee" or re.search(r"coffee|kaapi|roaster|espresso", text_of(p)),
    },
    {
        "id": "breakfast",
        "kind": "food",
        "label": "Tiffin trail",
        "want": 12,
        "radius": 2.6,
        "max_stops": 4,
        "bestTime": "7am–10.30am",
        "titles": ["{area} before nine", "The {area} tiffin trail", "Dosas at dawn in {area}"],
        "kicker": "Dosas, idlis and a queue worth joining",
        "intro": "Old-school tiffin rooms, best before the city gets going.",
        "match": lambda p: p["cat"] in {"eat", "coffee"} and re.search(
            r"dosa|idli|tiffin|breakfast|south indian|udupi|bhavan|sagar|darshini",
            text_of(p),
        ),
    },
    {
        "id": "food",
        "kind": "food",
        "label": "Food crawl",
        "want": 18,
        "radius": 2.8,
        "max_stops": 4,
        "bestTime": "12.30pm–3pm",
        "titles": ["Eating through {area}", "{area} in four plates", "The {area} table"],
        "kicker": "Four kitchens, one neighbourhood",
        "intro": "A compact crawl through the neighbourhood's kitchens.",
        "match": lambda p: p["cat"] == "eat" and not re.search(r"\bbar\b|pub|brew", text_of(p)),
    },
    {
        "id": "biryani",
        "kind": "food",
        "label": "Biryani run",
        "want": 8,
        "radius": 4.0,
        "max_stops": 4,
        "bestTime": "12.30pm–3pm",
        "titles": ["{area} biryani run", "Rice, smoke and {area}", "The {area} dum trail"],
        "kicker": "Dum biryani, kebabs and military hotels",
        "intro": "A rice-and-smoke run through the city's biryani heartland.",
        "match": lambda p: re.search(r"biryani|kebab|kabab|mughlai|andhra|hyderabadi|military hotel", text_of(p)),
    },
    {
        "id": "street-food",
        "kind": "food",
        "label": "Street bites",
        "want": 8,
        "radius": 3.0,
        "max_stops": 5,
        "bestTime": "5pm–8pm",
        "titles": ["{area} street bites", "Chaat and chatter in {area}", "{area}, one bite at a time"],
        "kicker": "Chaat, grills and food-street energy",
        "intro": "A street-food wander for the early evening.",
        "match": lambda p: re.search(r"chaat|pani puri|pav bhaji|street food|snack|sweet|grill", text_of(p)),
    },
    {
        "id": "bakery",
        "kind": "food",
        "label": "Bakery trail",
        "want": 8,
        "radius": 3.0,
        "max_stops": 4,
        "bestTime": "9am–12pm",
        "titles": ["{area}, fresh from the oven", "The {area} bakery trail", "Bread and cake in {area}"],
        "kicker": "Puffs, bread and old-school cake counters",
        "intro": "A bakery trail for the mid-morning hunger.",
        "match": lambda p: re.search(r"bakery|bakehouse|bread|cake|pastry|croissant|patisserie|puff", text_of(p)),
    },
    {
        "id": "bars",
        "kind": "night",
        "label": "Pub crawl",
        "want": 10,
        "radius": 2.8,
        "max_stops": 4,
        "bestTime": "6pm–late",
        "titles": ["{area} after dark", "A {area} pub crawl", "Cold ones in {area}"],
        "kicker": "Old boozers, new taps and a long table",
        "intro": "A pub crawl that starts before the crowds and ends when you do.",
        "match": lambda p: re.search(r"\bbar\b|pub|brew|cocktail|taproom|lounge|tavern", text_of(p)),
    },
    {
        "id": "breweries",
        "kind": "night",
        "label": "Brewery crawl",
        "want": 8,
        "radius": 5.0,
        "max_stops": 4,
        "bestTime": "4pm–9pm",
        "titles": ["Taps and tables in {area}", "{area} brewery crawl", "The {area} taproom run"],
        "kicker": "Tanks, taps and long shared tables",
        "intro": "A short run between the city's brewhouses.",
        "match": lambda p: re.search(r"brew|beer|taproom|brewpub", text_of(p)),
    },
    {
        "id": "market",
        "kind": "shop",
        "label": "Market walk",
        "want": 8,
        "radius": 3.2,
        "max_stops": 4,
        "bestTime": "7am–11am",
        "titles": ["Bargains in {area}", "The {area} market walk", "{area}, stall by stall"],
        "kicker": "Flowers, vegetables and old market lanes",
        "intro": "A market wander for the early hours.",
        "match": lambda p: re.search(r"market|bazaar|santhe|flower|vegetable|produce", text_of(p)),
    },
    {
        "id": "books",
        "kind": "culture",
        "label": "Book trail",
        "want": 8,
        "radius": 3.8,
        "max_stops": 4,
        "bestTime": "11am–6pm",
        "titles": ["Shelves of {area}", "A {area} reading list", "Bookshops of {area}"],
        "kicker": "Second-hand stacks and quiet reading rooms",
        "intro": "A bookshop trail for a long, unhurried afternoon.",
        "match": lambda p: re.search(r"book|library|reading|publisher", text_of(p)),
    },
    {
        "id": "heritage",
        "kind": "culture",
        "label": "Heritage walk",
        "want": 14,
        "radius": 2.6,
        "max_stops": 5,
        "bestTime": "7am–10am",
        "titles": ["{area}, layer by layer", "Old stones of {area}", "The {area} heritage walk"],
        "kicker": "Forts, palaces and colonial leftovers",
        "intro": "A heritage walk through the older layers of the neighbourhood.",
        "match": lambda p: p["cat"] in {"culture", "worship"} and re.search(
            r"heritage|fort|palace|monument|memorial|soudha|colonial|historic|ruins|tower|temple|church|basilica",
            text_of(p),
        ),
    },
    {
        "id": "museum",
        "kind": "culture",
        "label": "Museum trail",
        "want": 8,
        "radius": 4.0,
        "max_stops": 4,
        "bestTime": "10am–4pm",
        "titles": ["A museum afternoon in {area}", "{area} in collections", "The {area} museum trail"],
        "kicker": "Collections, archives and quiet rooms",
        "intro": "A museum trail for a rainy or scorching afternoon.",
        "match": lambda p: p["cat"] == "culture" and re.search(
            r"museum|archive|collection|planetarium|gallery", text_of(p)
        ),
    },
    {
        "id": "art",
        "kind": "culture",
        "label": "Art trail",
        "want": 8,
        "radius": 4.0,
        "max_stops": 4,
        "bestTime": "11am–6pm",
        "titles": ["{area}, frame by frame", "Art around {area}", "The {area} art walk"],
        "kicker": "Galleries, murals and small studios",
        "intro": "An art walk through galleries and public works.",
        "match": lambda p: re.search(r"gallery|art|mural|sculpture|design|studio", text_of(p))
        and p["cat"] in {"culture", "shop"},
    },
    {
        "id": "temple",
        "kind": "culture",
        "label": "Temple trail",
        "want": 12,
        "radius": 3.2,
        "max_stops": 4,
        "bestTime": "6.30am–9am",
        "titles": ["Temple bells in {area}", "{area}'s quiet courtyards", "Old shrines of {area}"],
        "kicker": "Old stone, lamplit shrines and quiet courtyards",
        "intro": "A temple trail for the calm end of the morning.",
        "match": lambda p: p["cat"] == "worship" and re.search(
            r"temple|gudi|kovil|math|shrine|devasthanam", text_of(p)
        ),
    },
    {
        "id": "church",
        "kind": "culture",
        "label": "Church walk",
        "want": 6,
        "radius": 4.0,
        "max_stops": 4,
        "bestTime": "8am–11am",
        "titles": ["Steeples of {area}", "A {area} church walk", "Stained glass in {area}"],
        "kicker": "Steeples, stained glass and Sunday choirs",
        "intro": "A church walk through the older Christian quarters.",
        "match": lambda p: p["cat"] == "worship" and re.search(
            r"church|basilica|cathedral|chapel|parish", text_of(p)
        ),
    },
    {
        "id": "park",
        "kind": "outdoors",
        "label": "Park loop",
        "want": 10,
        "radius": 3.6,
        "max_stops": 4,
        "bestTime": "6am–8am",
        "titles": ["{area} green loop", "Shade and lawns in {area}", "A {area} garden walk"],
        "kicker": "Lawns, gardens and shady loops",
        "intro": "A green loop for the early morning or late afternoon.",
        "match": lambda p: p["cat"] == "outdoors" and re.search(
            r"park|garden|green|lawn|nursery|grove", text_of(p)
        ),
    },
    {
        "id": "lake",
        "kind": "outdoors",
        "label": "Lake loop",
        "want": 7,
        "radius": 5.0,
        "max_stops": 4,
        "bestTime": "5pm–7pm",
        "titles": ["{area} by the water", "The {area} lake loop", "Water and birds in {area}"],
        "kicker": "Water, birds and the evening breeze",
        "intro": "A lake loop timed for the golden hour.",
        "match": lambda p: p["cat"] == "outdoors" and re.search(
            r"lake|reservoir|kere|tank", text_of(p)
        ),
    },
    {
        "id": "sunset",
        "kind": "outdoors",
        "label": "Golden hour",
        "want": 7,
        "radius": 5.0,
        "max_stops": 4,
        "bestTime": "5pm–7pm",
        "titles": ["{area} at golden hour", "West-facing {area}", "Sunset in {area}"],
        "kicker": "Rocks, terraces and west-facing water",
        "intro": "A golden-hour route to the best west-facing spots.",
        "match": lambda p: re.search(r"sunset|viewpoint|view point|hill|rock|betta|terrace|rooftop", text_of(p)),
    },
    {
        "id": "shopping",
        "kind": "shop",
        "label": "Shop crawl",
        "want": 7,
        "radius": 3.2,
        "max_stops": 4,
        "bestTime": "11am–6pm",
        "titles": ["A {area} shopping wander", "Small labels of {area}", "{area}, shop to shop"],
        "kicker": "Silk, tailoring and small labels",
        "intro": "A shopping wander through small labels and old counters.",
        "match": lambda p: p["cat"] == "shop" and re.search(
            r"boutique|clothing|silk|fashion|tailor|designer|saree|apparel|fabric|mall|market|gift|handicraft",
            text_of(p),
        ),
    },
    {
        "id": "south-indian",
        "kind": "food",
        "label": "South Indian trail",
        "want": 7,
        "radius": 2.8,
        "max_stops": 4,
        "bestTime": "7am–11am",
        "titles": ["Dosas and idlis in {area}", "The {area} tiffin run", "Old kitchens of {area}"],
        "kicker": "Dosas, idlis and old-school tiffin rooms",
        "intro": "A south Indian run through the neighbourhood's old kitchens.",
        "match": lambda p: p["cat"] in {"eat", "coffee"} and re.search(
            r"dosa|idli|tiffin|south indian|udupi|bhavan|sagar|darshini|military hotel|vegetarian",
            text_of(p),
        ),
    },
    {
        "id": "sweets",
        "kind": "food",
        "label": "Sweet trail",
        "want": 5,
        "radius": 3.0,
        "max_stops": 4,
        "bestTime": "10am–1pm",
        "titles": ["{area}, something sweet", "Mithai in {area}", "The {area} sweet counter"],
        "kicker": "Mithai, halwa and old sweet counters",
        "intro": "A short, sweet crawl through the neighbourhood's counters.",
        "match": lambda p: re.search(
            r"sweet|mithai|halwa|laddu|peda|jalebi|dessert|ice cream|gelato|bakery|cake",
            text_of(p),
        ),
    },
    {
        "id": "architecture",
        "kind": "culture",
        "label": "Architecture walk",
        "want": 7,
        "radius": 2.6,
        "max_stops": 5,
        "bestTime": "8am–11am",
        "titles": ["Buildings of {area}", "A {area} architecture walk", "{area}, stone by stone"],
        "kicker": "Facades, colonnades and old bungalows",
        "intro": "An architecture walk through the neighbourhood's older buildings.",
        "match": lambda p: p["cat"] in {"culture", "worship", "stay"} and re.search(
            r"heritage|colonial|architecture|bungalow|palace|fort|cathedral|basilica|temple|gopuram|facade|building",
            text_of(p),
        ),
    },
    {
        "id": "theatre",
        "kind": "culture",
        "label": "Stage & screen",
        "want": 6,
        "radius": 4.0,
        "max_stops": 4,
        "bestTime": "4pm–8pm",
        "titles": ["Stages of {area}", "A {area} culture crawl", "{area} after the lights go up"],
        "kicker": "Theatres, cinemas and small auditoriums",
        "intro": "A crawl between the rooms where the city performs.",
        "match": lambda p: re.search(
            r"theatre|theater|cinema|auditorium|performance|music|concert|amphitheatre",
            text_of(p),
        ),
    },
    {
        "id": "sunrise",
        "kind": "outdoors",
        "label": "Early loop",
        "want": 7,
        "radius": 4.2,
        "max_stops": 4,
        "bestTime": "5.30am–7.30am",
        "titles": ["{area} at first light", "Before the city wakes in {area}", "An early {area} loop"],
        "kicker": "Rocks, lakes and the first hour of light",
        "intro": "An early loop for the hour before the city gets going.",
        "match": lambda p: p["cat"] in {"outdoors", "culture"} and re.search(
            r"hill|rock|betta|lake|park|garden|viewpoint|sunrise",
            text_of(p),
        ),
    },
    {
        "id": "temple-tiffin",
        "kind": "food",
        "label": "Temple & tiffin",
        "want": 7,
        "radius": 2.8,
        "max_stops": 4,
        "bestTime": "6.30am–10am",
        "titles": ["Bells and dosas in {area}", "A {area} temple-and-tiffin run", "Courtyards and coffee in {area}"],
        "kicker": "A quiet shrine, then a plate of dosa",
        "intro": "A morning that pairs an old shrine with a tiffin room.",
        "match": lambda p: (
            p["cat"] == "worship"
            and re.search(r"temple|gudi|kovil|shrine|devasthanam", text_of(p))
        ) or (
            p["cat"] in {"eat", "coffee"}
            and re.search(r"dosa|idli|tiffin|breakfast|south indian|udupi|bhavan|sagar|darshini", text_of(p))
        ),
    },
    {
        "id": "lake-coffee",
        "kind": "outdoors",
        "label": "Lake & coffee",
        "want": 6,
        "radius": 4.0,
        "max_stops": 4,
        "bestTime": "7am–10am",
        "titles": ["{area} by water, then coffee", "A {area} lake-and-coffee loop", "Still water, strong coffee in {area}"],
        "kicker": "A lap of the water, then a flat white",
        "intro": "A slow loop that starts at the water and ends at a coffee counter.",
        "match": lambda p: (
            p["cat"] == "outdoors"
            and re.search(r"lake|reservoir|kere|tank|park|garden", text_of(p))
        ) or p["cat"] == "coffee",
    },
    {
        "id": "book-coffee",
        "kind": "culture",
        "label": "Books & coffee",
        "want": 6,
        "radius": 3.2,
        "max_stops": 4,
        "bestTime": "10am–5pm",
        "titles": ["Shelves and cups in {area}", "A {area} reading morning", "Bookshops, then coffee in {area}"],
        "kicker": "Second-hand stacks and a long cup",
        "intro": "A bookshop-to-cafe wander for a slow afternoon.",
        "match": lambda p: (
            re.search(r"book|library|reading|publisher", text_of(p))
            or p["cat"] == "coffee"
        ),
    },
    {
        "id": "photo-walk",
        "kind": "walk",
        "label": "Photo walk",
        "want": 6,
        "radius": 2.6,
        "max_stops": 5,
        "bestTime": "7am–10am",
        "titles": ["{area}, frame by frame", "A {area} photo walk", "Light and stone in {area}"],
        "kicker": "Markets, facades and the good light",
        "intro": "A photo walk through the neighbourhood's most photogenic corners.",
        "match": lambda p: p["cat"] in {"culture", "worship", "shop", "outdoors"} and re.search(
            r"market|heritage|fort|palace|temple|church|basilica|gallery|art|mural|lake|park|facade|street",
            text_of(p),
        ),
    },
    {
        "id": "rainy-day",
        "kind": "culture",
        "label": "Rainy day",
        "want": 5,
        "radius": 3.6,
        "max_stops": 4,
        "bestTime": "11am–5pm",
        "titles": ["{area} when it rains", "A dry afternoon in {area}", "Under cover in {area}"],
        "kicker": "Museums, galleries and a long lunch",
        "intro": "An indoor route for the days the afternoon rain arrives.",
        "match": lambda p: (
            p["cat"] == "culture"
            and re.search(r"museum|gallery|archive|collection|planetarium|theatre", text_of(p))
        ) or p["cat"] in {"eat", "coffee"},
    },
]


def use_cap(place: dict) -> int:
    """Let a good editorial pick anchor a few trails, but not every one."""
    return 12 if place.get("curated") else 3


def unique_title(title: str, area: str) -> str:
    taken = {trail["title"] for trail in trail_list}
    if title not in taken:
        return title
    for suffix in (" II", " III", " IV"):
        candidate = f"{title}{suffix}"
        if candidate not in taken:
            return candidate
    return f"{title} · {area}"


def build_theme(theme: dict, places: list[dict], trail_ids: set[str], signatures: list[set[str]], use_count: Counter):
    pool = theme_pool(places, theme["match"])
    pool.sort(key=lambda p: (-quality(p), p["name"]))
    # Every trail needs at least one editorial anchor. Start from those, then
    # let good non-editorial places seed more trails as long as a curated stop
    # comes along for the walk.
    anchors = [p for p in pool if p.get("curated")]
    seed_pool = anchors + [p for p in pool if not p.get("curated")]
    made = 0
    attempts = 0
    while made < theme["want"] and attempts < len(seed_pool) * 3:
        attempts += 1
        seed = next(
            (p for p in seed_pool if use_count[p["id"]] < use_cap(p)),
            None,
        )
        if not seed:
            break
        nearby = [
            p for p in pool
            if p is not seed
            and use_count[p["id"]] < use_cap(p)
            and haversine_km(seed["lat"], seed["lon"], p["lat"], p["lon"]) <= theme["radius"]
        ]
        if len(nearby) < 2:
            use_count[seed["id"]] += 99
            continue
        # Editorial picks first, then the closest, then the best.
        nearby.sort(
            key=lambda p: (
                not p.get("curated"),
                haversine_km(seed["lat"], seed["lon"], p["lat"], p["lon"]),
                -quality(p),
            )
        )
        picked = [seed]
        seen_cats = Counter([seed["cat"]])
        for candidate in nearby:
            if len(picked) >= theme["max_stops"]:
                break
            # Four restaurants in a row is a meal, not a trail.
            if len(picked) >= 3 and seen_cats[candidate["cat"]] >= 3:
                continue
            picked.append(candidate)
            seen_cats[candidate["cat"]] += 1
        if len(picked) < 3:
            use_count[seed["id"]] += 99
            continue
        if not any(p.get("curated") for p in picked):
            use_count[seed["id"]] += 99
            continue
        stops = nearest_order(picked)
        max_route = theme["radius"] * 2.4
        while len(stops) > 3 and route_km(stops) > max_route:
            # Drop the outlier, keep the anchor and the tightest cluster.
            seed_lat, seed_lon = seed["lat"], seed["lon"]
            outlier = max(
                stops[1:],
                key=lambda p: haversine_km(seed_lat, seed_lon, p["lat"], p["lon"]),
            )
            stops.remove(outlier)
        if route_km(stops) > max_route:
            use_count[seed["id"]] += 99
            continue
        ids = [p["id"] for p in stops]
        signature = set(ids)
        if any(len(signature & other) >= 3 for other in signatures):
            use_count[seed["id"]] += 99
            continue
        area = dominant_area(stops)
        distance = route_km(stops)
        title = unique_title(
            theme["titles"][made % len(theme["titles"])].format(area=area),
            area,
        )
        base = f"{theme['id']}-{norm(area).replace(' ', '-')}"
        trail_id = base
        suffix = 2
        while trail_id in trail_ids:
            trail_id = f"{base}-{suffix}"
            suffix += 1
        trail_ids.add(trail_id)
        signatures.append(signature)
        for p in stops:
            use_count[p["id"]] += 1
        minutes = (
            distance / 4.5 * 60
            + len(stops) * (30 if theme["kind"] in {"food", "night"} else 22)
            if theme["kind"] != "daytrip"
            else distance / 35 * 60 + len(stops) * 40
        )
        first = stops[0]["name"]
        last = stops[-1]["name"]
        note = (
            f"{theme['intro']} Start at {first}, finish at {last}, "
            f"with {len(stops)} stops across {area}."
        )
        if stops[0].get("note"):
            note = f"{theme['intro']} Start at {first}: {stops[0]['note']}"
        color = KIND_COLOR[theme["kind"]][made % len(KIND_COLOR[theme["kind"]])]
        out = {
            "id": trail_id,
            "title": title,
            "kicker": theme["kicker"],
            "note": note,
            "kind": theme["kind"],
            "theme": theme["id"],
            "area": area,
            "tags": [theme["label"], area, KIND_LABEL[theme["kind"]]],
            "duration": fmt_duration(minutes),
            "distance": fmt_distance(distance),
            "bestTime": theme["bestTime"],
            "color": color,
            "stops": [make_stop(p) for p in stops],
        }
        trail_list.append(out)
        made += 1
    return made


def build_area_walks(places: list[dict], trail_ids: set[str], signatures: list[set[str]], use_count: Counter):
    by_area = defaultdict(list)
    for p in places:
        if not p.get("area") or not usable(p):
            continue
        if p.get("curated") or quality(p) >= 32:
            by_area[p["area"]].append(p)
    made = 0
    title_styles = [
        ["A morning in {area}", "An afternoon in {area}"],
        ["{area}, on foot", "The {area} loop"],
    ]
    for area, pool in sorted(by_area.items(), key=lambda kv: -len(kv[1])):
        if len(pool) < 3 or not any(p.get("curated") for p in pool):
            continue
        pool.sort(key=lambda p: (-quality(p), p["name"]))
        for variant in range(2 if len(pool) >= 8 else 1):
            seed = next(
                (
                    p for p in pool
                    if p.get("curated") and use_count[p["id"]] < 6
                ),
                None,
            )
            if not seed:
                break
            candidates = [
                p for p in pool
                if p is not seed and use_count[p["id"]] < use_cap(p)
                and haversine_km(seed["lat"], seed["lon"], p["lat"], p["lon"]) <= 2.6
            ]
            candidates.sort(
                key=lambda p: (
                    not p.get("curated"),
                    haversine_km(seed["lat"], seed["lon"], p["lat"], p["lon"]),
                )
            )
            picked = [seed]
            seen_cats = Counter([seed["cat"]])
            for p in candidates:
                if len(picked) >= 5:
                    break
                if seen_cats[p["cat"]] >= 2:
                    continue
                picked.append(p)
                seen_cats[p["cat"]] += 1
            if len(picked) < 3:
                continue
            stops = nearest_order(picked)
            while len(stops) > 3 and route_km(stops) > 5.5:
                stops.pop()
                stops = nearest_order(stops)
            distance = route_km(stops)
            if distance > 5.5:
                use_count[seed["id"]] += 99
                continue
            signature = {p["id"] for p in stops}
            if any(len(signature & other) >= 3 for other in signatures):
                use_count[seed["id"]] += 99
                continue
            title = unique_title(
                title_styles[variant % len(title_styles)][
                    variant % len(title_styles[variant % len(title_styles)])
                ].format(area=area),
                area,
            )
            base = f"area-{norm(area).replace(' ', '-')}"
            trail_id = base if variant == 0 else f"{base}-{variant + 1}"
            suffix = 2
            while trail_id in trail_ids:
                trail_id = f"{base}-{variant + 1}-{suffix}"
                suffix += 1
            trail_ids.add(trail_id)
            signatures.append(signature)
            for p in stops:
                use_count[p["id"]] += 1
            minutes = distance / 4.5 * 60 + len(stops) * 20
            note = (
                f"A {fmt_distance(distance)} walk through {area}, from {stops[0]['name']} "
                f"to {stops[-1]['name']}."
            )
            trail_list.append({
                "id": trail_id,
                "title": title,
                "kicker": "Neighbourhood stops, one after another",
                "note": note,
                "kind": "walk",
                "theme": "area",
                "area": area,
                "tags": ["Neighbourhood walk", area, "City walk"],
                "duration": fmt_duration(minutes),
                "distance": fmt_distance(distance),
                "bestTime": "8am–11am" if variant == 0 else "3pm–6pm",
                "color": KIND_COLOR["walk"][made % len(KIND_COLOR["walk"])],
                "stops": [make_stop(p) for p in stops],
            })
            made += 1
    return made


def build_day_trips(places: list[dict], trail_ids: set[str], signatures: list[set[str]], use_count: Counter):
    pool = [
        p for p in places
        if usable(p)
        and 9 <= centre_km(p) <= CITY_RADIUS_KM
        and p["cat"] in {"outdoors", "culture", "worship", "experience", "eat", "stay"}
        and (p.get("curated") or quality(p) >= 26)
    ]
    by_area = defaultdict(list)
    for p in pool:
        by_area[p.get("area") or p["name"]].append(p)
    made = 0
    title_styles = [
        "{area} in a day",
        "A day out in {area}",
        "{area}, out past the ring road",
    ]
    for area, group in sorted(by_area.items(), key=lambda kv: -len(kv[1])):
        if len(group) < 2:
            continue
        group.sort(key=lambda p: (-quality(p), p["name"]))
        seed = next(
            (p for p in group if p.get("curated") and use_count[p["id"]] < 5),
            group[0],
        )
        candidates = [
            p for p in group
            if p is not seed and use_count[p["id"]] < use_cap(p)
            and haversine_km(seed["lat"], seed["lon"], p["lat"], p["lon"]) <= 30
        ]
        candidates.sort(key=lambda p: (not p.get("curated"), -quality(p)))
        picked = [seed] + candidates[:4]
        # A far-flung pair is still a viable half-day out.
        if len(picked) < 2 or (len(picked) < 3 and centre_km(seed) < 14):
            continue
        stops = nearest_order(picked)
        signature = {p["id"] for p in stops}
        if any(len(signature & other) >= 3 for other in signatures):
            continue
        distance = route_km(stops, 1.35)
        if area == "Bengaluru" or distance < 8:
            continue
        base = f"day-{norm(area).replace(' ', '-')}"
        trail_id = base
        suffix = 2
        while trail_id in trail_ids:
            trail_id = f"{base}-{suffix}"
            suffix += 1
        trail_ids.add(trail_id)
        signatures.append(signature)
        for p in stops:
            use_count[p["id"]] += 1
        minutes = distance / 35 * 60 + len(stops) * 40
        trail_list.append({
            "id": trail_id,
            "title": unique_title(
                title_styles[made % len(title_styles)].format(area=area),
                area,
            ),
            "kicker": "Out past the ring road, and back by dinner",
            "note": f"A full day out around {area}, with {len(stops)} stops and a lot of road.",
            "kind": "daytrip",
            "theme": "daytrip",
            "area": area,
            "tags": ["Day trip", area, "Out of town"],
            "duration": fmt_duration(minutes),
            "distance": fmt_distance(distance),
            "bestTime": "Start early",
            "color": KIND_COLOR["daytrip"][made % len(KIND_COLOR["daytrip"])],
            "stops": [make_stop(p) for p in stops],
        })
        made += 1
        if made >= 24:
            break
    return made


trail_list: list[dict] = []


def main() -> None:
    atlas = load(ATLAS) or {}
    places = [
        p for p in atlas.get("places", [])
        if p.get("lat") and p.get("lon")
    ]
    trail_ids: set[str] = set()
    signatures: list[set[str]] = []
    use_count: Counter = Counter()

    total = 0
    for theme in THEMES:
        # Reuse across themes is fine: a café can anchor a coffee crawl and a
        # breakfast trail. Within a theme, keep the stops varied.
        made = build_theme(theme, places, trail_ids, signatures, Counter())
        total += made
        print(f"{theme['id']}: {made}")
    area_count = build_area_walks(places, trail_ids, signatures, Counter())
    print(f"area walks: {area_count}")
    trip_count = build_day_trips(places, trail_ids, signatures, Counter())
    print(f"day trips: {trip_count}")
    total += area_count + trip_count

    # Best trails first: more curated stops, then tighter routes.
    def rank(trail: dict) -> tuple:
        curated = sum(1 for stop in trail["stops"] if any(
            p["id"] == stop["placeId"] and p.get("curated") for p in places
        ))
        return (-curated, len(trail["stops"]), trail["title"])

    trail_list.sort(key=rank)
    OUT.write_text(json.dumps(trail_list, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT} with {len(trail_list)} trails")
    kinds = Counter(t["kind"] for t in trail_list)
    areas = Counter(t.get("area") for t in trail_list)
    print("kinds", dict(kinds))
    print("areas", len(areas), areas.most_common(8))


if __name__ == "__main__":
    main()
