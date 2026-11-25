#!/usr/bin/env python3
"""Find openly licensed photographs for as many atlas places as possible.

The atlas cannot use Google Maps photos: they are copyrighted, cannot be
hotlinked, and scraping them breaks both the terms and the build. Instead this
script asks three open sources, in order of confidence:

  1. Wikidata P18 / Wikipedia page images for places with an encyclopedia entry.
  2. OpenStreetMap ``image`` and ``wikimedia_commons`` tags, resolved through
     Wikimedia Commons for a licence and a credit.
  3. One good neighbourhood photograph per area, used as a fallback for
     editorial picks that have no photograph of their own.

Output is data/place_photos.json keyed by atlas place id, plus
data/area_photos.json keyed by area id. The atlas build merges them only where
the place has no photo yet, and marks neighbourhood photos as such. Places with
no open photograph still get a unique designed cover in the app, so no card is
ever a bare icon.

Stdlib only. Commons asks for a descriptive User-Agent and moderate rates.
"""

from __future__ import annotations

import html
import json
import math
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "app" / "public" / "data" / "atlas.json"
AREAS = ROOT / "data" / "areas.json"
OUT = ROOT / "data" / "place_photos.json"
AREA_OUT = ROOT / "data" / "area_photos.json"
UA = "BengaluruAtlas/1.0 (https://github.com/Abhinav-Prabhakar/BengaluruAtlas; abhinav@example.com)"
COMMONS = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA = "https://en.wikipedia.org/w/api.php"
WIKIDATA = "https://www.wikidata.org/w/api.php"
OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = (12.83, 77.43, 13.10, 77.78)


def api(url: str, params: dict, tries: int = 5, data: dict | None = None):
    payload = None
    if data is not None:
        payload = urllib.parse.urlencode(data).encode()
    else:
        url = f"{url}?{urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': '2'})}"
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "User-Agent": "BengaluruAtlas/1.0" if "overpass-api" in url else UA,
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            with urllib.request.urlopen(req, timeout=60) as fh:
                return json.load(fh)
        except Exception as exc:  # noqa: BLE001 - network retries are the point
            wait = min(20, 2 ** attempt)
            print(f"  retry {attempt + 1} in {wait}s ({exc})")
            time.sleep(wait)
    return {}


def strip_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def haversine_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(h))


def file_from_commons_value(value: str) -> str | None:
    """Turn a Commons File:/Category: or upload URL into a File: title."""
    value = (value or "").strip()
    if not value:
        return None
    if value.lower().startswith("file:"):
        return value
    if "/wiki/File:" in value:
        return urllib.parse.unquote(value.split("/wiki/", 1)[1]).replace("_", " ")
    if "upload.wikimedia.org" in value:
        tail = urllib.parse.unquote(value.split("/")[-1])
        tail = re.sub(r"^\d+px-", "", tail)
        return f"File:{tail}" if tail else None
    return None


def commons_images(titles: list[str]) -> dict[str, dict]:
    """Resolve up to 50 File: titles into thumbnail + licence metadata."""
    titles = [t for t in dict.fromkeys(titles) if t]
    out: dict[str, dict] = {}
    for start in range(0, len(titles), 40):
        batch = titles[start:start + 40]
        data = api(COMMONS, {
            "action": "query",
            "titles": "|".join(batch),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "960",
        })
        for page in data.get("query", {}).get("pages", []):
            title = page.get("title", "")
            info = (page.get("imageinfo") or [{}])[0]
            url = info.get("thumburl") or info.get("url")
            if not url:
                continue
            meta = info.get("extmetadata", {})
            out[title] = {
                "image": url,
                "page": info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "credit": strip_html(meta.get("Artist", {}).get("value")) or "Wikimedia Commons",
                "license": strip_html(meta.get("LicenseShortName", {}).get("value")) or "Wikimedia Commons",
            }
        time.sleep(0.35)
    return out


def category_lead_image(category: str) -> str | None:
    data = api(COMMONS, {
        "action": "query",
        "generator": "categorymembers",
        "gcmtitle": category,
        "gcmtype": "file",
        "gcmlimit": "8",
        "prop": "imageinfo",
        "iiprop": "url",
    })
    pages = data.get("query", {}).get("pages", [])
    for page in pages:
        title = page.get("title", "")
        if re.search(r"\.(svg|gif|webm|ogv)$", title, re.I):
            continue
        if re.search(r"\b(logo|map|coat of arms|seal|flag)\b", title, re.I):
            continue
        return title
    return None


def quality_place(place: dict) -> bool:
    """Only spend requests on places worth a photo."""
    if place.get("img"):
        return False
    if place.get("chain"):
        return False
    return True


def area_candidates(name: str) -> list[str]:
    special = {
        "mg road": ["M G Road, Bengaluru", "MG Road, Bengaluru"],
        "church street": ["Church Street, Bengaluru"],
        "brigade road": ["Brigade Road"],
        "commercial street": ["Commercial Street, Bengaluru"],
        "cubbon park": ["Cubbon Park"],
        "richmond town": ["Richmond Town, Bengaluru"],
        "frazer town": ["Fraser Town, Bengaluru"],
        "old airport road": ["Old Airport Road"],
        "new bel road": ["New BEL Road"],
        "btm layout": ["BTM Layout"],
        "hsr layout": ["HSR Layout"],
        "jp nagar": ["J. P. Nagar"],
        "jayanagar": ["Jayanagar, Bengaluru"],
        "rajajinagar": ["Rajajinagar"],
        "rr nagar": ["Rajarajeshwari Nagar"],
        "yelahanka": ["Yelahanka"],
        "whitefield": ["Whitefield, Bengaluru"],
        "electronic city": ["Electronic City"],
        "bannerghatta road": ["Bannerghatta Road"],
        "kanakapura road": ["Kanakapura Road"],
        "mysore road": ["Mysore Road"],
        "hosur road": ["Hosur Road"],
        "old madras road": ["Old Madras Road"],
        "bellary road": ["Bellary Road"],
        "hennur road": ["Hennur"],
        "sarjapur road": ["Sarjapur Road"],
        "cv raman nagar": ["C. V. Raman Nagar"],
        "bengaluru": ["Bangalore"],
    }
    key = name.strip().lower()
    if key in special:
        return special[key]
    return [name, f"{name}, Bengaluru", f"{name}, Bangalore"]


def title_matches_area(name: str, title: str) -> bool:
    """Reject a search result that happens to be about something else."""
    key = norm(name).replace(" ", "")
    candidate = norm(title).replace(" ", "")
    if not key or not candidate:
        return False
    if key in candidate or candidate in key:
        return True
    # Bengaluru and Bangalore are the same city in different spellings.
    if key in {"bengaluru", "bangalore"} and candidate in {"bengaluru", "bangalore"}:
        return True
    tokens = [word for word in norm(name).split() if len(word) > 2]
    return bool(tokens) and all(
        re.search(rf"\b{re.escape(word)}\b", norm(title)) for word in tokens
    )


def area_photos(areas: list[dict]) -> dict[str, dict]:
    """One encyclopedic photograph per neighbourhood, with licence metadata."""
    title_to_area: dict[str, str] = {}
    for area in areas:
        for title in area_candidates(area["name"]):
            title_to_area.setdefault(title, area["id"])

    found: dict[str, dict] = {}
    titles = list(title_to_area)
    file_by_area: dict[str, str] = {}
    for start in range(0, len(titles), 40):
        batch = titles[start:start + 40]
        data = api(WIKIPEDIA, {
            "action": "query",
            "titles": "|".join(batch),
            "prop": "pageimages",
            "piprop": "name|thumbnail",
            "pithumbsize": "1200",
            "redirects": "1",
        })
        # Wikipedia normalises and redirects titles; map back through both.
        alias: dict[str, str] = {}
        for item in data.get("query", {}).get("redirects", []):
            alias[item.get("to", "")] = item.get("from", "")
        for item in data.get("query", {}).get("normalized", []):
            alias[item.get("to", "")] = item.get("from", "")
        pages = data.get("query", {}).get("pages", [])
        for page in pages:
            title = page.get("title", "")
            original = alias.get(title, title)
            area_id = title_to_area.get(original) or title_to_area.get(title)
            if not area_id or area_id in found:
                continue
            area_name = next((a["name"] for a in areas if a["id"] == area_id), "")
            if not title_matches_area(area_name, title):
                continue
            image = (page.get("thumbnail") or {}).get("source")
            file_name = page.get("pageimage")
            if not image or not file_name:
                continue
            found[area_id] = {
                "image": image,
                "page": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                "credit": "Wikipedia / Wikimedia Commons",
                "license": "See source",
                "title": title,
            }
            file_by_area[area_id] = f"File:{file_name}"
        time.sleep(0.35)

    # Upgrade credit and licence from Commons where possible.
    resolved = commons_images(list(file_by_area.values()))
    resolved_by_norm = {norm(title): value for title, value in resolved.items()}
    for area_id, file_title in file_by_area.items():
        info = resolved.get(file_title) or resolved_by_norm.get(norm(file_title))
        if info and area_id in found:
            found[area_id].update({
                "image": info["image"],
                "page": info["page"],
                "credit": info["credit"],
                "license": info["license"],
            })
    return found


def main() -> None:
    atlas = json.loads(ATLAS.read_text())
    places = atlas.get("places", [])
    areas = json.loads(AREAS.read_text())
    by_osm = {p["osm"]: p for p in places if p.get("osm")}
    by_norm: dict[str, list[dict]] = {}
    for place in places:
        by_norm.setdefault(norm(place["name"]), []).append(place)

    file_by_place: dict[str, str] = {}
    source_by_place: dict[str, str] = {}

    def assign(place: dict, file_title: str, source: str) -> None:
        if not file_title or place.get("img"):
            return
        if re.search(r"logo|wordmark|emblem|seal|coat[_ ]of[_ ]arms", file_title, re.I):
            return
        file_by_place.setdefault(place["id"], file_title)
        source_by_place.setdefault(place["id"], source)

    # 1. Wikipedia page images for places with an article.
    wiki_places = [p for p in places if p.get("wiki") and quality_place(p)]
    wiki_titles = [p["wiki"].replace("_", " ") for p in wiki_places]
    page_file: dict[str, str] = {}
    for start in range(0, len(wiki_titles), 40):
        batch = wiki_titles[start:start + 40]
        data = api(WIKIPEDIA, {
            "action": "query",
            "titles": "|".join(batch),
            "prop": "pageimages",
            "piprop": "name",
            "redirects": "1",
        })
        for page in data.get("query", {}).get("pages", []):
            title = page.get("title")
            name = page.get("pageimage")
            if title and name:
                page_file[norm(title)] = f"File:{name}"
        time.sleep(0.3)
    for place in wiki_places:
        file_title = page_file.get(norm(place["wiki"]))
        if file_title:
            assign(place, file_title, "Wikipedia")

    # 2. Wikidata P18 for every place with an entity id.
    wd_places = [p for p in places if p.get("wd") and quality_place(p)]
    ids = [p["wd"] for p in wd_places]
    wd_file: dict[str, str] = {}
    for start in range(0, len(ids), 45):
        batch = ids[start:start + 45]
        data = api(WIKIDATA, {
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "claims",
        })
        for qid, entity in data.get("entities", {}).items():
            claims = entity.get("claims", {}).get("P18", [])
            for claim in claims:
                value = claim.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(value, str) and value:
                    wd_file[qid] = file_from_commons_value(value) or f"File:{value}"
                    break
        time.sleep(0.35)
    for place in wd_places:
        file_title = wd_file.get(place.get("wd", ""))
        if file_title:
            assign(place, file_title, "Wikidata")

    # 3. OSM image / Commons tags across the whole city.
    query = f"""[out:json][timeout:180];
(
 nwr["name"]["image"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
 nwr["name"]["wikimedia_commons"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out tags center;"""
    overpass = api(OVERPASS, {}, data={"data": query})
    elements = overpass.get("elements", [])
    print(f"OSM image tags: {len(elements)} elements")
    category_file: dict[str, str] = {}
    for element in elements:
        tags = element.get("tags", {})
        osm_id = f"{element.get('type')}/{element.get('id')}"
        place = by_osm.get(osm_id)
        if not place:
            # Fall back to an exact name within 150 m.
            candidates = by_norm.get(norm(tags.get("name", "")), [])
            lat, lon = element.get("lat"), element.get("lon")
            if element.get("center"):
                lat = element["center"].get("lat")
                lon = element["center"].get("lon")
            if not lat or not lon:
                continue
            near = [
                p for p in candidates
                if haversine_km(lat, lon, p["lat"], p["lon"]) <= 0.15
            ]
            place = near[0] if near else None
        if not place or not quality_place(place):
            continue
        commons = tags.get("wikimedia_commons", "")
        direct = tags.get("image", "")
        file_title = file_from_commons_value(commons) if commons else None
        if not file_title and direct:
            file_title = file_from_commons_value(direct)
        if file_title:
            assign(place, file_title, "OpenStreetMap")
        elif commons.lower().startswith("category:"):
            if commons not in category_file:
                category_file[commons] = category_lead_image(commons) or ""
                time.sleep(0.3)
            if category_file[commons]:
                assign(place, category_file[commons], "Wikimedia Commons")

    # Resolve all file titles to real image URLs and licences.
    resolved = commons_images(list(file_by_place.values()))
    # Commons normalises titles; map back case-insensitively.
    resolved_by_norm = {norm(title): value for title, value in resolved.items()}
    out: dict[str, dict] = {}
    for place_id, title in file_by_place.items():
        info = resolved.get(title) or resolved_by_norm.get(norm(title))
        if not info:
            continue
        out[place_id] = {
            **info,
            "source": source_by_place.get(place_id, "Wikimedia Commons"),
        }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT} with {len(out)} place photos")
    print(f"  candidates: {len(file_by_place)}; resolved: {len(out)}")

    areas_out = area_photos(areas)
    AREA_OUT.write_text(json.dumps(areas_out, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {AREA_OUT} with {len(areas_out)} of {len(areas)} area photos")


if __name__ == "__main__":
    main()
