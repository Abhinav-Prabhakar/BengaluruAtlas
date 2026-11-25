#!/usr/bin/env python3
"""Collect notable Bengaluru places from Wikipedia, with photos and coordinates.

The atlas already has tens of thousands of OpenStreetMap listings. This script
adds the layer above them: the museums, lakes, temples, markets, gardens and
old buildings that have their own encyclopedia entry, a coordinate and usually
a photograph. Output is data/wiki_places.json, which the atlas build merges in
as editorial picks.

Stdlib only. Wikipedia asks for a descriptive User-Agent and modest request
rates, so this sleeps between batches and backs off on 429.
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "wiki_places.json"
UA = "BengaluruAtlas/1.0 (https://github.com/Abhinav-Prabhakar/BengaluruAtlas; abhinav@example.com)"

CENTRE = (12.9716, 77.5946)
MAX_KM = 55.0

CATEGORIES = {
    "Tourist attractions in Bengaluru": "culture",
    "Buildings and structures in Bengaluru": "culture",
    "Lakes of Bengaluru": "outdoors",
    "Parks in Bengaluru": "outdoors",
    "Gardens in Bengaluru": "outdoors",
    "Places of worship in Bangalore": "worship",
    "Museums in Bengaluru": "culture",
    "Heritage sites in Bangalore": "culture",
    "Markets in Bengaluru": "shop",
    "Shopping malls in Bengaluru": "shop",
    "Theatres in Bengaluru": "culture",
    "Sports venues in Bengaluru": "outdoors",
    "Restaurants in Bengaluru": "eat",
    "Hotels in Bengaluru": "stay",
    "Neighbourhoods of Bangalore": "experience",
    "Bangalore Pete": "experience",
    "Tourism in Bengaluru": "culture",
    "History of Bengaluru": "culture",
    "Art museums and galleries in Bengaluru": "culture",
    "Churches in Bengaluru": "worship",
    "Hindu temples in Bengaluru": "worship",
    "Mosques in Bengaluru": "worship",
}

SKIP_WORDS = {
    "list of", "timeline", "history of", "culture of", "economy of", "geography of",
    "transport in", "media in", "education in", "demographics", "bibliography",
    "category:", "template:", "bangalore", "bengaluru", "karnataka", "india",
    "metro station", "railway station", "bus station", "airport", "ward",
    "assembly constituency", "lok sabha", "cricket", "football", "premier league",
    "university", "college", "institute", "school", "hospital", "company",
    "software", "technology park", "aerospace", "election",
}

# Titles that are interesting even though their name trips a skip word.
KEEP = {
    "Bangalore Fort", "Bengaluru Palace", "Bangalore Town Hall", "Attara Kacheri",
    "Vidhana Soudha", "Bangalore Aquarium", "Tipu Sultan's Summer Palace",
    "Government Museum, Bengaluru", "National Gallery of Modern Art, Bengaluru",
    "Visvesvaraya Industrial and Technological Museum", "Jawaharlal Nehru Planetarium",
    "Bangalore Golf Club", "Karnataka Chitrakala Parishath", "Ravindra Kalakshetra",
    "Chowdiah Memorial Hall", "St. Mary's Basilica, Bengaluru", "Bull Temple",
    "Dodda Ganesha Temple", "Gavi Gangadhareshwara Temple", "ISKCON Temple Bangalore",
    "Infant Jesus Church, Bengaluru", "St. Patrick's Church, Bengaluru",
    "St. Mark's Cathedral, Bangalore", "Jamia Mosque, Bangalore",
    "Bangalore Club", "Century Club", "Bowring Institute",
}


def api(params, tries=6):
    params = {**params, "format": "json", "formatversion": "2"}
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as fh:
                return json.load(fh)
        except Exception as exc:  # noqa: BLE001 - network retries are the point
            wait = min(30, 2 ** attempt)
            print(f"  retry {attempt + 1} in {wait}s ({exc})")
            time.sleep(wait)
    return {}


def category_members(title):
    if not title.startswith("Category:"):
        title = "Category:" + title
    out, cont = [], {}
    while True:
        data = api({
            "action": "query", "list": "categorymembers", "cmtitle": title,
            "cmlimit": "500", "cmtype": "page|subcat", **cont,
        })
        members = data.get("query", {}).get("categorymembers", [])
        if not members and not out:
            print(f"  ! {title} returned nothing: {json.dumps(data)[:160]}")
        out.extend(members)
        if "continue" not in data:
            return out
        cont = data["continue"]
        time.sleep(1.5)


def collect_titles():
    titles = {}
    queue = [(cat, kind, 0) for cat, kind in CATEGORIES.items()]
    seen_cats = set()
    while queue:
        cat, kind, depth = queue.pop(0)
        if cat in seen_cats:
            continue
        seen_cats.add(cat)
        members = category_members(cat)
        print(f"{cat}: {len(members)}")
        for m in members:
            name = m["title"]
            if m["ns"] == 14:
                low = name.lower()
                if (depth < 1
                        and ("bengaluru" in low or "bangalore" in low)
                        and not any(w in low for w in ("people", "companies", "alumni", "sportspeople", "films", "wikipedia"))):
                    queue.append((name, kind, depth + 1))
                continue
            titles.setdefault(name, set()).add(kind)
        time.sleep(1.2)
    return titles


def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0088
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def enrich(titles):
    rows = []
    names = list(titles)
    for i in range(0, len(names), 40):
        chunk = names[i:i + 40]
        data = api({
            "action": "query",
            "titles": "|".join(chunk),
            "prop": "coordinates|pageimages|extracts|pageprops",
            "exintro": "1",
            "explaintext": "1",
            "exsentences": "3",
            "piprop": "thumbnail",
            "pithumbsize": "1200",
            "redirects": "1",
        })
        pages = data.get("query", {}).get("pages", [])
        for page in pages:
            coords = page.get("coordinates") or []
            lat = round(coords[0]["lat"], 5) if coords else None
            lon = round(coords[0]["lon"], 5) if coords else None
            if lat is not None and haversine(CENTRE[0], CENTRE[1], lat, lon) > MAX_KM:
                continue
            title = page["title"]
            low = title.lower()
            if low not in {k.lower() for k in KEEP} and any(w in low for w in SKIP_WORDS):
                continue
            thumb = page.get("thumbnail", {}).get("source")
            rows.append({
                "title": title,
                "lat": lat,
                "lon": lon,
                "image": thumb,
                "page": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "extract": (page.get("extract") or "").strip(),
                "kinds": sorted(titles.get(title, {"culture"})),
                "wikidata": (page.get("pageprops") or {}).get("wikibase_item"),
            })
        print(f"  {i + len(chunk)}/{len(names)} -> {len(rows)} kept")
        time.sleep(1.2)
    return rows


def backfill_coordinates(rows):
    """Second pass for pages the first batch query returned without coords.

    The coordinates prop is occasionally dropped when a batch mixes pages with
    and without coordinates. Asking again for just the missing titles is cheap
    and unlocks a lot of notable places (Vidyarthi Bhavan, Russell Market,
    Bangalore Fort, Koshy's...).
    """
    missing = [row["title"] for row in rows if row.get("lat") is None]
    if not missing:
        return 0

    found = {}
    aliases = {}
    for i in range(0, len(missing), 40):
        chunk = missing[i:i + 40]
        data = api({
            "action": "query",
            "titles": "|".join(chunk),
            "prop": "coordinates",
            "redirects": "1",
        })
        query = data.get("query", {})
        for redirect in query.get("redirects", []):
            aliases[redirect["from"]] = redirect["to"]
        for page in query.get("pages", []):
            coords = page.get("coordinates") or []
            if coords:
                found[page["title"]] = (round(coords[0]["lat"], 5), round(coords[0]["lon"], 5))
        print(f"  backfill {i + len(chunk)}/{len(missing)} -> {len(found)} located")
        time.sleep(1.2)

    updated = 0
    for row in rows:
        if row.get("lat") is not None:
            continue
        target = aliases.get(row["title"], row["title"])
        if target in found:
            row["lat"], row["lon"] = found[target]
            updated += 1
    return updated


def main():
    titles = collect_titles()
    print(f"{len(titles)} candidate titles")
    rows = enrich(titles)
    rows.sort(key=lambda r: (r["kinds"][0], r["title"]))
    OUT.write_text(json.dumps({
        "source": "Wikipedia / Wikimedia Commons",
        "generated": time.strftime("%Y-%m-%d"),
        "places": rows,
    }, ensure_ascii=False, indent=1) + "\n")
    with_img = sum(1 for r in rows if r["image"])
    print(f"wrote {OUT} with {len(rows)} places ({with_img} with photos)")


if __name__ == "__main__":
    if "--backfill" in sys.argv:
        data = json.loads(OUT.read_text())
        count = backfill_coordinates(data["places"])
        OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
        located = sum(1 for row in data["places"] if row.get("lat") is not None)
        print(f"backfilled {count} coordinates; {located}/{len(data['places'])} rows located")
    else:
        main()
