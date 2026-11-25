#!/usr/bin/env python3
"""Bake the Bengaluru traffic model used by the atlas at runtime.

Inputs
  data/raw/traffic_bangalore.csv  13 monitored corridors, speed readings every 10 min
  data/raw/routes_bangalore.csv   corridor names and endpoints

Output
  app/public/data/traffic.json
    - real road geometry for each corridor (OSRM)
    - free-flow speed and a 24-hour speed profile per corridor
    - a build-time snapshot of the latest readings

The app reads this once, then polls GitHub for newer readings and blends them
with the hourly profile when the network is unavailable.

Stdlib only.
"""

from __future__ import annotations

import csv
import json
import statistics
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "app" / "public" / "data" / "traffic.json"
TRAFFIC_CSV = RAW / "traffic_bangalore.csv"
ROUTES_CSV = RAW / "routes_bangalore.csv"
GEO_CACHE = RAW / "corridor_geo.json"

UA = "BengaluruAtlas/1.0 (https://github.com/Abhinav-Prabhakar/BengaluruAtlas; abhinav@example.com)"
CENTRE = (12.9716, 77.5946)

# A couple of dataset labels use old spellings or a landmark the geocoder
# does not know; give those an explicit, unambiguous query.
GEO_OVERRIDES = {
    "Karmelaram": "Carmelaram railway station, Bengaluru",
    "St. Francis College": "St. Francis College, Koramangala, Bengaluru",
}


def geo_query(name):
    for needle, query in GEO_OVERRIDES.items():
        if needle.lower() in name.lower():
            return query
    return f"{name}, Bengaluru"


def load_csv(path):
    with path.open(newline="") as fh:
        return list(csv.DictReader(fh))


def http_json(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=40) as fh:
                return json.load(fh)
        except Exception as exc:  # noqa: BLE001
            print(f"  retry {attempt + 1}: {exc}")
            time.sleep(2 * (attempt + 1))
    return None


def geocode(query):
    url = "https://photon.komoot.io/api/?" + urllib.parse.urlencode({
        "q": query, "limit": "1",
        "lat": str(CENTRE[0]), "lon": str(CENTRE[1]),
    })
    data = http_json(url)
    features = (data or {}).get("features") or []
    if not features:
        return None
    lon, lat = features[0]["geometry"]["coordinates"]
    return round(lat, 6), round(lon, 6)


def route_geometry(a, b):
    url = (
        "https://routing.openstreetmap.de/routed-car/route/v1/driving/"
        f"{a[1]},{a[0]};{b[1]},{b[0]}?overview=full&geometries=geojson"
    )
    data = http_json(url)
    routes = (data or {}).get("routes") or []
    if not routes:
        return None
    return [[round(lon, 5), round(lat, 5)] for lon, lat in routes[0]["geometry"]["coordinates"]]


def main():
    routes = load_csv(ROUTES_CSV)
    readings = load_csv(TRAFFIC_CSV)
    print(f"{len(routes)} corridors · {len(readings)} readings")

    cache = {}
    if GEO_CACHE.exists():
        cache = json.loads(GEO_CACHE.read_text())

    # --- aggregate speeds per corridor and hour -------------------------------
    speeds = defaultdict(lambda: defaultdict(list))
    for row in readings:
        try:
            duration = float(row["duration"])
            km = float(row["distance"])
            hour = int(row["time"].split(":")[0])
        except (ValueError, KeyError):
            continue
        if duration <= 0 or km <= 0:
            continue
        kmph = km / duration * 60
        if 0 < kmph < 90:
            speeds[row["route_code"]][hour].append(kmph)

    latest_ts = max(f"{r['date']} {r['time']}" for r in readings)
    latest = {}
    for row in readings:
        if f"{row['date']} {row['time']}" != latest_ts:
            continue
        try:
            latest[row["route_code"]] = round(
                float(row["distance"]) / float(row["duration"]) * 60, 1
            )
        except (ValueError, ZeroDivisionError, KeyError):
            pass

    corridors = []
    for route in routes:
        code = route["route_code"]
        label = route["label_full"]
        if "→" in label:
            start_name, end_name = [part.strip() for part in label.split("→", 1)]
        else:
            start_name, end_name = label, ""

        key = code
        if key not in cache:
            print(f"geocoding {route['label_short']}…")
            start = geocode(geo_query(start_name))
            time.sleep(1.0)
            end = geocode(geo_query(end_name)) if end_name else None
            time.sleep(1.0)
            cache[key] = {"start": start, "end": end}
            GEO_CACHE.write_text(json.dumps(cache, indent=1))

        geo = cache[key]
        if not geo.get("start") or not geo.get("end"):
            print(f"  ! no geometry for {route['label_short']}")
            continue

        path = route_geometry(geo["start"], geo["end"])
        time.sleep(0.8)
        if not path:
            continue

        hourly = []
        for hour in range(24):
            values = speeds[code].get(hour) or []
            hourly.append(round(statistics.median(values), 1) if values else None)
        known = [v for v in hourly if v]
        peak = max(known) if known else 20
        free = round(statistics.quantiles(known, n=20)[-1], 1) if len(known) > 4 else peak * 1.4

        corridors.append({
            "id": code,
            "name": route["label_short"],
            "from": start_name,
            "to": end_name,
            "start": list(geo["start"]),
            "end": list(geo["end"]),
            "path": path,
            "freeKmph": free,
            "hourly": hourly,
            "liveKmph": latest.get(code),
        })
        print(f"  {route['label_short']}: free {free} kmph, {len(path)} points")

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latestReading": latest_ts,
        "source": "traffic-monitor-lizard · OpenStreetMap routing",
        "corridors": corridors,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB) with {len(corridors)} corridors")


if __name__ == "__main__":
    main()
