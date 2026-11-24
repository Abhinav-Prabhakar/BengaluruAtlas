# Bengaluru Places Atlas
### Research + build plan for a travel-time-first, personal atlas of Bengaluru

*Last updated: 24 November 2026*

---

## 0. The short version

Build a **personal, map-first atlas of Bengaluru** that answers one question better than Google Maps:

> **"It's 4:30pm on a Saturday, I'm on Church Street, it might rain, I have two hours and ₹800 — where can I actually go, and what's worth the trip?"**

The core loop is **Where → What → How far → When → Decide → Remember → Share**.

The data foundation is **not** the Foursquare Places API. As of 2026 it gives you 500 free Pro calls/month, and the bulk OS Places dataset is now gated behind Foursquare's Places Portal. The right primary source is **Overture Places**:

- **~187,690 POIs in the Bengaluru extent** (NextGIS count, Sep 2026)
- **~4.4–4.8M POIs in India**
- **CDLA-Permissive-2.0 / Apache-2.0**, no OSM share-alike on the places theme
- Monthly GeoParquet releases on S3/Azure, queryable with DuckDB by bounding box
- Includes Foursquare, Meta, Microsoft, BrightQuery and other sources in one conflated schema

These counts are published/independent estimates, not yet reproduced locally. Phase 0 exists to reproduce them. The ~188k Bengaluru figure is the raw Overture count; after the `confidence >= 0.5` + named filter, expect a smaller working set — measure it, don't assume it. And Overture is a monthly snapshot, not a live registry — treat every row as "believed to exist", not "verified open today".

Then enrich with **OpenStreetMap** (parks, lakes, temples, heritage, metro, bus, parking), **Wikidata/Wikipedia** (descriptions, images, notable places), **BMTC + Namma Metro GTFS** (transit), **BBMP ward boundaries** (areas), **curated seeds + trails** (taste), and **Open-Meteo/eBird** (weather, birds).

Architecture: **static React + MapLibre + PMTiles + a tiny routing service + IndexedDB for your personal layer**. No heavy backend, no monthly data bill, works on your phone in Bengaluru.

Six weekends gets you a genuinely useful v1. The full "go all in" version is below.

---

## 1. What already exists

### 1.1 The data landscape

| Source | Scale | Licence | Great for | Gotchas |
|---|---|---|---|---|
| **Overture Places** | **~188k** in Bengaluru; **90.3M** globally (Nov 2026) | CDLA-Permissive-2.0 / Apache-2.0 | Primary POI base: names, categories, addresses, phones, websites, brands, confidence, operating status | No opening hours, no ratings. Known duplicates/junk at low confidence. Monthly, not live. |
| **Foursquare OS Places** | ~1.6M India; ~109M globally (Nov 2026) | Apache-2.0 | Alternative/complementary POI base; deltas; strong chain data | Now gated via Places Portal + Iceberg catalog. Core attributes only: **no hours, no ratings** in OS. Monthly. |
| **Foursquare Places API** | 500 free Pro calls/month (June 2026 rate change; some pages still say 10,000 — check your console) | Commercial | Shortlist enrichment, place match, details | Not viable for bulk. Premium fields (tips/photos) billed from call 1. Not the foundation. |
| **OpenStreetMap** | 538k points + 394k polygons in India | ODbL | Parks, lakes, temples, heritage, viewpoints, metro/bus, parking, ATMs, opening hours, accessible tags | Sparse business coverage; hours present but inconsistent; ODbL share-alike if you distribute a derived DB. |
| **Wikidata / Wikipedia** | 418k India POIs in Wikidata | CC0 / CC BY-SA | Descriptions, images, heritage status, "why is this interesting" | Patchy for small businesses; great for landmarks. |
| **Google Places** | Best coverage, ratings, hours | Paid + restrictive caching | Deep links, shortlist checks, ratings shown via link-out | Cannot store/cache most content; not a bulk source. Don't build on it. |
| **IndiaRestros** | 117,295 Bengaluru food places; timings, menus, phone | Unclear / "open data" claim | Optional food enrichment, menus, timings | Verify licence and freshness before depending on it. |
| **LocalSaathi / EatOutMap / Cafeography / WorldCafeMap** | 1.7k–15.6k Bengaluru food listings | Varies | Spot checks, curated ideas, hours for top places | Aggregators, not authoritative databases; don't scrape. |
| **Zomato / Swiggy / Justdial** | Huge | No open API | — | Scraping violates ToS. Deep links only. |
| **SafeGraph / Placekey / Dashmote** | Commercial | Paid | Verified POIs, ratings, footfall | Not free. |
| **BBMP / OpenCity / DataMeet** | 225 wards, zones, lakes, canteens | Public domain / CC BY / ODbL | Area polygons, ward stats, civic layers | Multiple delimitations (198/225/243/369) — pick one and document it. |
| **BMTC + Namma Metro GTFS** | ~4.4k–5k bus routes / ~9.8k stops; 103.6 km metro, ~88 stations (Nov 2026; Pink Line elevated opened, airport Blue Line targeted 2028) | ODbL (community feeds) | Metro/bus access, "last train", multimodal | Unofficial; verify against current schedules. |
| **eBird API** | Hotspots + recent sightings | Non-commercial | Birding layer for lakes, "what's been seen recently" | Key required; non-commercial; don't expose sensitive species. |
| **Open-Meteo** | Global weather/AQI/UV | Free, no key | Rain mode, heat, AQI, "go now" advice | Forecast, not live radar. |

**The single most important data decision:** use **Overture as the canonical POI table**, and treat OSM/Wikidata/FSQ/curated as enrichment layers. Overture is already conflated and has stable GERS IDs, which makes monthly refresh and "new/closed" detection possible.

**"Can I download only Bengaluru?"** Yes. Overture's place files are spatially sorted, so a DuckDB bbox query prunes to a handful of files and writes a ~20–40MB local Parquet. FSQ OS Places is partitioned by release date rather than city, so "only Bengaluru" is possible via an Iceberg/bbox predicate but is more work. Overture wins on ergonomics.

**Source mix varies by region.** Inspect `sources` per place rather than assuming "Overture = Foursquare". In the Nov 2026 release, the global mix is roughly **61.3M Meta, 16.8M BrightQuery, 5.9M Microsoft, 3.8M Foursquare**, plus smaller providers. Bengaluru may lean more on Meta/BrightQuery than Foursquare. That's fine for existence, but check attribute completeness (websites, phones, hours) before trusting a category.

### 1.2 The existing products

| Product | What it does well | What it doesn't do |
|---|---|---|
| **Google Maps** | Best coverage, hours, ratings, lists, transit | No isochrone + category + "open when I arrive" combination; no personal dataset; no "hidden gem" logic; search leads you to the popular. |
| **Reachable** | Tap a point, draw a real travel-time polygon, show places inside it | Generic, subscription, not Bengaluru-specific, no curated depth or personal memory. |
| **Around Us** | ~20M POIs, 16,000 filters, hidden gems | Generic global directory; no travel-time-first workflow; no local curation. |
| **Roadtrippers** | Categories along a route | Route/trip planning, not "what's near me now". |
| **Atlas Obscura / Offpath / TravelPOI / PinIt** | Curated hidden gems with stories | Tiny coverage; not comprehensive; not filterable by travel time. |
| **Time Out / Condé Nast / local guides** | Editorial quality | Lists, not a database; not personalised. |
| **Wanderlog / Triply** | Itinerary building | Planning after you've chosen; weak discovery. |
| **Hoodmaps** | Neighbourhood vibe | No POIs, no travel times. |

**The gap is real:** nobody combines (a) comprehensive POI coverage, (b) select-an-area / travel-time filtering, (c) Bengaluru-specific categories and taste, (d) personal memory, and (e) honest data freshness.

---

## 2. Product thesis

Google Maps answers **"where is X?"**
This answers **"what can I do with the next two hours, from here, given traffic, rain and what I've already seen?"**

Five principles:

1. **Travel time, not distance.** 2 km in Bengaluru is 8 minutes at 6am and 35 minutes at 6pm. The UI should never show "2 km away" as the primary fact.
2. **Area, not city.** "Bengaluru" is not a useful unit. Indiranagar 2nd Stage, Malleshwaram 8th Cross, HSR Sector 2 and the Pete lanes are different cities.
3. **Intent, not 1,000 categories.** People think "I want coffee", "I want a walk", "I want something weird", not "cafe > coffee_shop > specialty_coffee".
4. **Explainable, not star ratings.** Open data has no reliable ratings. Build a "worth a detour" score with reasons, not a fake 4.3★.
5. **Personal memory, not generic top-10.** The best filter is "I haven't been there" and "I loved that kind of place".

---

## 3. The core loop

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   WHERE     │ →  │    WHAT     │ →  │  HOW FAR    │ →  │    WHEN     │
│ area / pin  │    │  intent     │    │ walk/2W/cab │    │ open now /  │
│ lasso /     │    │  chips +    │    │ metro       │    │ arrive at / │
│ isochrone   │    │  counts     │    │ 5–30 min    │    │ day / time  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   SHARE     │ ←  │  REMEMBER   │ ←  │   DECIDE    │ ←  │   FILTER    │
│ WhatsApp /  │    │ visited /   │    │ 3 cards /   │    │ chain-free, │
│ GPX / link  │    │ rated /     │    │ surprise /  │    │ veg, rain-  │
│             │    │ notes/lists │    │ plan my day │    │ safe, quiet │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

Every screen should make the next step obvious. The map is always the background; the panel is always the answer.

### Three user stories

**1. The free Saturday afternoon**
> It's 4:30pm on Church Street. I have two hours, ₹800, and it might rain. I want coffee, a bookstore, and a walk — not another mall.

The app: area = Church Street / MG Road, intents = coffee + shop + outdoors, travel = 15 min walk, filters = independent + open now. It shows 14 places — Blossom, a filter-coffee place, Cubbon Park. Rain probability is 55%, so it offers a swap: "Cubbon Park → MAP museum, 8 min cab, open till 7pm." I save a 3-stop plan and share it.

**2. The one-day guest**
> A friend is visiting for a day. They've seen MG Road and UB City. I want to show them the Bangalore that isn't on the poster.

The app: "Old Bangalore Heritage Walk" trail — Pete lanes → KR Market → Bangalore Fort → Tipu's palace. It checks that KR Market is best at 5am, the fort closes at 5:30pm, and suggests filter coffee at a nearby old-school café. It builds a timeline and warns about the last metro.

**3. The workday break**
> I'm working from a café in Koramangala. I have 45 minutes and need a quiet place with Wi-Fi and a power socket, within 8 minutes.

The app: anchor = current pin, intent = coffee, filters = quiet + wifi + work-friendly, travel = 8 min walk. It hides the loud, crowded places and shows "Dyu Art Cafe — 6 min walk, quiet courtyard, open late, you marked it work-friendly last month." One tap to walk there.

---

## 4. Features

### 4.1 Core (the v1 must-haves)

1. **Area selection**
   - Click a neighbourhood polygon (curated "vibe areas" + OSM neighbourhoods + BBMP wards).
   - Search "Indiranagar", "HSR", "Malleshwaram 8th Cross" with aliases.
   - Lasso/freehand polygon.
   - Radius circle (secondary).
   - **Travel-time isochrone from a pin** (primary for "10 minutes away").
   - **Corridor selection** (draw a line, buffer 300m) for a café crawl along 100ft Road.
   - **Two-origin overlap** for meeting a friend.

2. **Intent categories with live counts**
   - Eat, Coffee & tea, Drinks & nightlife, Sweet tooth, Parks & water, Heritage & temples, Art & culture, Shop & markets, Play & sport, Wellness, Learn & make, Day trips, Practical, Stay, Getting around.
   - Subcategories appear only when useful; counts update with every filter.
   - Empty states suggest "+5 min" or "include chains".

3. **Travel-time filter**
   - Modes: walk, cycle, two-wheeler, cab/auto, metro + walk.
   - Times: 5 / 10 / 15 / 20 / 30 min.
   - Show the isochrone polygon, not a circle.
   - Every card shows **door-to-door time**, not distance.
   - **Peak-hour preview**: "10 min now → 22 min at 6pm".
   - Ranges for cab ("12–25 min"), single values for walk.

4. **Open now / open when I arrive**
   - Evaluate opening hours at `now + travel time`.
   - Warn "closes 10 min after you arrive".
   - "Hours unknown" chip + "call ahead" link.
   - "Closed today" and "closes soon" filters.

5. **Search + filters**
   - Free text with synonyms ("dosa", "filter coffee", "bookstore", "sunset").
   - Cuisine, price level, pure veg / vegan / Jain / halal, outdoor seating, wifi, work-friendly (plugs/quiet), wheelchair, pet-friendly, parking, quiet, late-night, breakfast, chain-free.
   - "Only places with known hours" toggle for reliability.

6. **Place cards with actions**
   - Name, intent, "why it's worth it" line, time, hours, address, phone, website, Instagram.
   - Save, visited, rate, note, add to plan.
   - Open in Google Maps / Uber / Ola / Namma Yatri.
   - Copy coordinates; share.

7. **Map + list sync**
   - Clustered pins coloured by intent.
   - Hover a card → pin pulses; click a pin → card scrolls into view.
   - Area polygon and isochrone overlay.
   - Metro lines and stations as a layer.
   - Parks/lakes as green/blue polygons, not just pins.

8. **Save / visited / rate / note / lists**
   - Personal layer in IndexedDB, exportable as JSON.
   - Lists: "Want to go", "Rainy day", "With parents", "Date night", "Work cafés".
   - "Hide visited" on by default in discovery mode.

9. **Explainable recommendations**
   - Every card has 2–3 reasons: "Independent", "Heritage", "12 min walk", "Open till 11pm", "Rare category in this area".
   - No black-box ranking.

10. **Share / export**
    - WhatsApp-friendly link with a static map + list.
    - GPX / KML for Google Maps / Apple Maps.
    - Add plan to Calendar.
    - No app install required to view.

### 4.2 The delightful 36 (small features, big payoff)

Grouped by job. Pick these up after the core loop works.

**Time & traffic**
1. **Door-to-door time** — includes walk to the road, pickup wait, parking walk. "8 min ride + 3 min walk".
2. **Peak preview** — toggle now / +1h / Saturday 7pm. Shows how the map shrinks.
3. **Travel-time unlock** — "Extend to 15 min: +38 restaurants, +2 parks, +1 bookstore". Makes the slider meaningful.
4. **Leave-by time** — for a saved plan, "leave by 5:42pm to make sunset".
5. **Last metro home** — GTFS-based warning; "last train from MG Road 11:00pm".
6. **Closing-soon / kitchen-closes** — don't send someone to a place that stops serving in 15 min.

**Weather & light**
7. **Rain escape** — if precipitation > 40% in the next 90 min, offer indoor swaps within the same time budget. "Cubbon Park → MAP museum, 8 min cab".
8. **Heat/AQI advisory** — midday UV or winter AQI; prefer indoor/shaded.
9. **Golden hour** — compute sunset; highlight west-facing lakes, rooftops, viewpoints. "Sunset in 47 min, 12 min away".
10. **Best time to go** — per-place ideal window (KR Market 5am, Vidyarthi Bhavan 7am, brewery 6pm). Curated + category heuristics.

**Discovery**
11. **Hidden-gem score** — independent, high confidence, category-rare, not on top-10 lists. "Worth a detour".
12. **Chain-free toggle** — exclude Starbucks, CCD, Third Wave, Blue Tokai, Domino's, etc. using Overture `brand` + a known chain list.
13. **New in town** — places first seen in the last 1–3 releases; "opened since September".
14. **Ghost watch** — places that disappeared/closed since the last release; hidden by default, shown as "recently closed nearby" so you don't waste a trip.
15. **Area DNA** — for a selected area: café density, green share, heritage count, chain ratio, late-night count, metro access, avg price, "best for". Compare two areas side-by-side.
16. **What's missing** — "This area has 42 cafés but no bookstore; nearest is 3.2 km". Gap analysis is fun and genuinely useful.
17. **Surprise me** — weighted random within filters; avoids chains, visited places and tourist traps.
18. **Three-card decision** — Safe pick / Adventurous pick / Wildcard, with reasons. For decision fatigue.
19. **Pairings** — after a restaurant, suggest a 5-min-walk dessert/coffee/park. "Make an evening of it".
20. **What's around this place** — 5 things within 5 min walk; turns one destination into an outing.

**Planning**
21. **Plan my day** — start point/time, duration, budget, interests, pace; route with opening hours, meal windows, sunset and last metro. Drag to reorder.
22. **Trails** — Filter Coffee Trail, Dosa Trail, Old Bangalore Heritage Walk, Lakes at Sunrise, Bookstore Crawl, Microbrewery Mile, Temple Trail, Market Morning, Birding Lakes, Monsoon Day Trip. Curated YAML; auto-checked for hours.
23. **Park-once stroll** — cluster 3–4 places around one parking lot; "park once, walk to all".
24. **Loop walks** — generate a 2–4 km walking loop with 3 stops; great for morning walks.
25. **Budget-aware** — price level + entry tickets + estimated spend for the plan.
26. **Time-budget-aware** — "I have 90 minutes" → one micro-itinerary, not a list.

**Personal**
27. **Import history** — Google Takeout (`Saved Places.json` + list CSVs), Foursquare/Swarm check-ins, GPX. Then "new to me" is real.
28. **Taste profile** — simple, explainable weights learned from saves/skips/visits. "Because you save independent coffee shops and heritage walks."
29. **One-tap correction** — "I'm here / open / closed / wrong pin / duplicate". Store locally; export as OSM note or FSQ suggested edit.
30. **Memory map** — visits, photos, notes, "would return"; year-in-review map.

**Local & trust**
31. **Kannada names** — show `name:kn` where available; area names in Kannada.
32. **Landmark directions** — "behind Forum Mall", "opposite Cubbon Park gate"; helps with autos.
33. **Metro-first filter** — places within 8 min walk of a Namma Metro station; show station + exit.
34. **Birding layer** — eBird hotspots and recent sightings at lakes; "38 species seen here this week".
35. **Confidence badge** — verified / likely / unverified; "hours unknown"; "last checked 3 months ago".
36. **Source attribution** — every detail can show where it came from.

### 4.3 Later / dream

- Public shared atlases and friend recommendations.
- Event layer (theatre, music, markets, festivals) — manual curation at first.
- AI concierge ("plan a rainy Sunday for two, budget ₹1,500") on top of the structured filters.
- Offline packs for day trips (tiles + POIs + walking isochrones).
- Multi-city (Mysuru, Coorg, Hampi) using the same pipeline.
- Live traffic calibration from TomTom/historical probes.
- "Time capsule" historical map overlay.

---

## 5. Data plan

### 5.1 Source hierarchy

```
Overture Places  ──►  canonical place (id, name, category, address, phone, website, brand, confidence)
        │
        ├── OSM        ──►  parks, lakes, temples, heritage, metro, bus, parking, hours, accessibility
        ├── Wikidata   ──►  description, image, heritage status, Wikipedia link
        ├── GTFS       ──►  metro/bus access, last train, multimodal
        ├── BBMP/OSM   ──►  area polygons (ward / neighbourhood / vibe area)
        ├── Curated    ──►  200–300 seeds, trails, best-time notes, price/ticket info
        ├── eBird      ──►  birding hotspots + recent sightings (runtime)
        └── Open-Meteo ──►  weather, rain, AQI, UV (runtime)
```

### 5.2 The pipeline (DuckDB + Python)

**Step 1 — extract Overture for Bengaluru**

```sql
INSTALL spatial; LOAD spatial;
INSTALL httpfs; LOAD httpfs;
SET s3_region = 'us-west-2';

COPY (
  SELECT
    id,
    names.primary              AS name,
    names.common               AS name_common,
    basic_category,
    taxonomy.primary           AS category,
    taxonomy.hierarchy         AS category_path,
    confidence,
    operating_status,
    addresses[1].freeform      AS address,
    addresses[1].locality      AS locality,
    addresses[1].postcode      AS postcode,
    phones[1]                  AS phone,
    websites[1]                AS website,
    socials                    AS socials,
    brand.names.primary        AS brand,
    brand.wikidata             AS brand_wikidata,
    ST_X(geometry)             AS lon,
    ST_Y(geometry)             AS lat,
    sources
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/2026-11-18.0/theme=places/type=place/*'
  )
  WHERE bbox.xmin BETWEEN 77.35 AND 77.85
    AND bbox.ymin BETWEEN 12.75 AND 13.20
    AND confidence >= 0.5
    AND names.primary IS NOT NULL
    AND (operating_status IS NULL OR operating_status <> 'permanently_closed')
) TO 'data/raw/overture_bengaluru.parquet' (FORMAT PARQUET);
```

> Pin a release date. Resolve the latest via `stac.overturemaps.org/catalog.json` rather than hard-coding. The bbox covers the city plus the airport corridor. The day-trip ring (Nandi Hills, Skandagiri, Savandurga, Ramanagara, Chunchi Falls) falls outside it — either widen to `77.25–77.90, 12.60–13.45`, or keep a separate curated `daytrips.geojson` with ~40 hand-checked places. For v1, curate; don't import 100k rural POIs.
>
> Keep low-confidence (`< 0.5`) and unnamed rows in a separate `long_tail` table. They're useful for "include the long tail" and for discovering small stalls, but shouldn't pollute the default results.

**Step 2 — OSM extract**

Use a Geofabrik Karnataka extract or a BBBike Bengaluru extract, then `osmium tags-filter`:

```bash
osmium tags-filter karnataka.osm.pbf \
  nwr/amenity=restaurant,cafe,bar,pub,fast_food,marketplace,place_of_worship,pharmacy,atm,toilets,drinking_water,parking,bus_station,taxi \
  nwr/tourism=museum,gallery,viewpoint,attraction,artwork,zoo,aquarium,hotel,guest_house \
  nwr/leisure=park,garden,nature_reserve,playground,sports_centre,swimming_pool \
  nwr/historic=monument,memorial,fort,ruins,archaeological_site \
  nwr/natural=water,peak,wood \
  nwr/shop=books,art,antiques,gift,clothes \
  nwr/railway=station,subway_entrance \
  -o data/raw/bengaluru_osm.osm.pbf
```

Convert to GeoJSON/Parquet with `osmium export` or GDAL. Keep OSM-derived rows in a separate table (`place_osm`) so ODbL obligations stay separable.

**Step 3 — Wikidata enrichment**

SPARQL query by bounding box, filtered to heritage/museum/park/temple/attraction, fetching label, description, image, heritage designation, Wikipedia link. Match to places by `wikidata` tag first, then name + <100m.

**Step 4 — area polygons**

- BBMP 225 final wards (2023) from OpenCity/DataMeet.
- BBMP zones.
- OSM `place=suburb/neighbourhood` polygons.
- Pincode boundaries from DataMeet.
- **~50 curated "vibe areas"** drawn by hand (see Appendix A). These are the primary UX, because wards are too big and administrative.

**Step 5 — merge and normalise**

- Overture is canonical. Attach OSM attributes by `wikidata`, then name + proximity + category.
- Add OSM-only features that Overture misses (parks, lakes, temples, heritage, viewpoints, metro stations).
- Deduplicate by normalised name + <50m + compatible category. A workable recipe: lowercase, strip punctuation and generic words ("the", "restaurant", "cafe"), block by geohash-7 (~150m), then match on name similarity >0.9 + distance <50m + compatible intent. Keep the Overture row as canonical; log every merge in `place_source` for review.
- Parse `opening_hours` with a library; store raw + structured + source + checked date.
- Detect chains via `brand`, `brand:wikidata`, and a hand-maintained chain list.
- Map categories to intents (see 5.4).
- Compute `quality_score`, `hidden_gem_score`, `area_dna`.

**Step 6 — export**

- `places.parquet` (server/analysis).
- `places.json` shards (details on demand).
- `poi_index.bin` (compact lat/lon/intent/flags for instant client filtering; ~3MB for 188k).
- `areas.geojson`, `metro.geojson`, `trails.json`.
- `bengaluru.pmtiles` (basemap + optional POI layers).

### 5.3 Schema

```sql
place(
  id TEXT PRIMARY KEY,              -- Overture GERS id
  name TEXT NOT NULL,
  name_kn TEXT,
  lat DOUBLE, lon DOUBLE,
  intent TEXT,                      -- eat | coffee | drinks | sweets | outdoors | heritage | culture | shop | play | wellness | learn | daytrip | practical | stay | transit
  subcategories TEXT[],             -- south_indian, bookstore, lake, ...
  basic_category TEXT,
  category_path TEXT[],
  address TEXT,
  locality TEXT,
  postcode TEXT,
  area_id TEXT,                     -- primary curated area
  phone TEXT,
  website TEXT,
  instagram TEXT,
  hours_raw TEXT,
  hours_json JSON,
  hours_source TEXT,                -- osm | fsq | manual | unknown
  hours_checked_at DATE,
  price_level INT,
  brand TEXT,
  is_chain BOOLEAN,
  confidence DOUBLE,
  operating_status TEXT,
  sources TEXT[],
  wikidata_id TEXT,
  wikipedia_url TEXT,
  description TEXT,
  image_url TEXT,
  heritage BOOLEAN,
  outdoor BOOLEAN,
  rain_safe BOOLEAN,
  veg TEXT,                         -- veg | vegan | jain | halal | unknown
  wifi BOOLEAN,
  wheelchair BOOLEAN,
  pet_friendly BOOLEAN,
  parking_nearby BOOLEAN,
  metro_station_id TEXT,
  metro_walk_min INT,
  best_time TEXT,                   -- morning | midday | sunset | night | any
  editorial_note TEXT,
  quality_score DOUBLE,
  hidden_gem_score DOUBLE,
  first_seen DATE,
  last_seen DATE,
  data_updated_at DATE
)

place_osm(place_id, osm_id, osm_tags JSON, geom)
area(id, name, name_kn, type, parent_id, geom, dna JSON)
visit(place_id, visited_at, rating, note, would_return)
list(id, name, created_at)
list_item(list_id, place_id, note, position)
trip(id, name, start_at, mode, notes)
trip_stop(trip_id, place_id, arrive_at, depart_at, position)
correction(place_id, kind, note, created_at, exported)
isochrone_cache(cell, mode, minutes, hour_bucket, polygon, created_at)
```

### 5.4 Category taxonomy

Don't expose Overture's hundreds of categories. Build **15 intents** with a small set of subcategories.

| Intent | Overture / OSM examples | UI label |
|---|---|---|
| **eat** | restaurant, fast_food, casual_eatery, food_court, bakery | Eat |
| **coffee** | cafe, coffee_shop, tea_room | Coffee & tea |
| **drinks** | bar, pub, brewery, wine_bar, cocktail_bar | Drinks & nightlife |
| **sweets** | dessert_shop, ice_cream, bakery, confectionery | Sweet tooth |
| **outdoors** | park, garden, lake, nature_reserve, viewpoint, trail | Parks & water |
| **heritage** | temple, mosque, church, monument, fort, palace, ruins | Heritage & temples |
| **culture** | museum, art_gallery, theatre, cinema, concert_hall, library | Art & culture |
| **shop** | bookstore, market, boutique, antique, gift, mall | Shop & markets |
| **play** | arcade, bowling, amusement_park, zoo, sports_centre, pool | Play & sport |
| **wellness** | spa, yoga, gym, massage | Wellness |
| **learn** | planetarium, science_museum, workshop | Learn & make |
| **daytrip** | fort, ruins, dam, waterfall, trek, birding | Day trips |
| **practical** | pharmacy, ATM, hospital, parking, toilets, police | Practical |
| **stay** | hotel, hostel, guest_house, resort | Stay |
| **transit** | metro_station, bus_station, railway_station, taxi | Getting around |

Keep a thesaurus for search: `dosa → south_indian_restaurant`, `filter coffee → coffee_shop`, `sunset → viewpoint`, `bookstore → book_store`, `thali → restaurant`, `biriyani → biryani_restaurant`.

### 5.5 Quality, ranking and the ratings gap

**The honest problem:** Overture and FSQ OS have **no ratings**. OSM has tags, not stars. Google has ratings but you can't store them. Zomato/Swiggy have ratings but no open API.

Don't fake it. Build a **"Worth a detour"** score:

```
quality =
  0.35 * confidence
+ 0.15 * source_diversity        (1–3 sources)
+ 0.15 * wikidata_or_heritage
+ 0.20 * editorial_seed
+ 0.15 * attribute_completeness   (phone/website/hours/address)

hidden_gem =
  quality
* (1 - 0.6 * is_chain)
* (1 - 0.4 * popularity_proxy)
* category_rarity               (1 / log(1 + count in area))
* (1 - visited)
```

`popularity_proxy` comes from brand presence, "top-10 list" membership and category ubiquity (not review counts — the open data doesn't have them). Show the **reasons**, not just the number:

- Independent (no brand)
- Heritage / Wikidata
- Rare category in this area
- 12 min walk
- Open till 11pm
- 3 sources agree

**Hours gap:** only ~27–40% of Bengaluru food places have listed hours in commercial datasets; OSM is patchier. So:

- Show "Hours unknown" instead of guessing.
- "Open now" filter only includes known-hours places; show the count of excluded places.
- Let the user add hours on visit ("I'm here — open till 11").
- Curate hours for the top 200 places.
- Use FSQ API only for shortlist enrichment if you want (500 free calls/month; $15/1000 after).
- Never claim "open" without a source.

**Freshness:** store `last_seen`, `date_refreshed`, `operating_status`. Show "last checked 3 months ago". Hide `permanently_closed` by default; show a collapsed "recently closed nearby" section.

**Quality gates before you trust the dataset:**

- ≥95% of rows have coordinates and a non-empty name.
- ≥85% map to one of the 15 intents; the rest are reviewed, not silently dumped into "other".
- Duplicate rate <2% on a 500-row random sample.
- Hours parse rate is measured and displayed, never assumed.
- A **100-place golden set** of places you know (Vidyarthi Bhavan, CTR, Blossom, Cubbon, MAP, etc.) is present with the right intent and coordinates.
- 20 random places are checked on the ground in Bengaluru before v1 ships.

### 5.6 Areas

Three layers:

1. **BBMP 225 wards (2023 final)** — for official stats and coverage. 243 KGIS/DataMeet and the proposed 369-ward GBA exist; pick 225 and document the crosswalk.
2. **OSM neighbourhoods/suburbs** — for names people actually use.
3. **~50 curated "vibe areas"** — the primary selection UX. Hand-drawn polygons for the places you actually go: Indiranagar 100ft Road, Koramangala 5th Block, HSR 27th Main, Malleshwaram 8th Cross, Basavanagudi Gandhi Bazaar, Church Street, the Pete lanes, etc. (Appendix A.)

Each area gets a **DNA profile**:

- Food density / coffee density
- Green share (park area / total)
- Heritage count
- Chain ratio
- Late-night count (closing ≥ 23:00)
- Metro access (% within 10 min walk)
- Average price level
- Quiet score (parks + cafés vs bars)
- Walkability (intersection density + sidewalk coverage)
- "Best for" tags

This powers "compare Indiranagar vs HSR" and "what's missing here".

### 5.7 Refresh

- **Monthly**: Overture release → diff against previous (`first_seen`, `last_seen`, `operating_status`).
- **Weekly**: OSM extract, GTFS feeds.
- **Daily/runtime**: weather, eBird, isochrones.
- **Diff report**: new places, closed places, moved places, hours changed. This is also the "New in town" and "Ghost watch" feature.
- **No CI**: a local `make refresh` script + a launchd/cron reminder, per your setup. Commit the generated data or keep it on a volume; don't add GitHub Actions.

---

## 6. Travel-time engine

### 6.1 Modes and honest speeds

| Mode | Typical speed | Notes |
|---|---|---|
| Walk | 4.5 km/h | Most reliable; use 4.2–4.8 depending on area. |
| Cycle | 12 km/h | Bengaluru heat/rain; show shade? later. |
| Two-wheeler | 20–25 km/h | Often the fastest short hop; filter by "no highway". |
| Cab/auto | 18–22 km/h off-peak, 12–15 km/h peak | Show a **range**, not a single ETA. |
| Metro + walk | GTFS | Walk to station + wait + ride + walk; last train warning. |

### 6.2 Isochrones

**MVP: OpenRouteService hosted API**

- Free Standard plan: 500 isochrones/day, 20/min; 2,000 directions/day, 40/min; 500 matrix/day. No card. Free for everyone, including commercial use, but check the current terms.
- **Use the new HeiGIT host:** `POST https://api.heigit.org/openrouteservice/v2/isochrones/{profile}`. The old `api.openrouteservice.org` host was deprecated in 2026 and shut down in the week of 16 November 2026.
- Profiles: `foot-walking`, `cycling-regular`, `driving-car`. Max range is 1 hour for driving, 20 hours for foot, 10 intervals per request.
- Results are **CC-BY-SA 4.0** under the current HeiGIT terms (older ORS pages say CC-BY 4.0). Attribute `© openrouteservice by HeiGIT | Data from OpenStreetMap` wherever isochrones or routes are shown, and keep the attribution on exported plans.
- Cache aggressively.

```http
POST /openrouteservice/v2/isochrones/foot-walking
Host: api.heigit.org
Authorization: <HEIGIT_API_KEY>
Content-Type: application/json

{
  "locations": [[77.6412, 12.9719]],
  "range": [600],
  "range_type": "time",
  "units": "m",
  "location_type": "start"
}
```

Response is a `FeatureCollection`; take the polygon, store it, and point-in-polygon the POI index. For "10 minutes", `range: [600]`. For a cab, use `driving-car` then apply the time-of-day multiplier and present a range.

**Production: self-hosted Valhalla**

- Docker, Bengaluru OSM extract + GTFS.
- `/isochrone` supports time contours and multimodal/transit.
- 2–4GB RAM for a city extract; tiles ~300–600MB.
- No quotas; works offline; better for "metro + walk".

**Don't rely on TomTom Reachable Range** for v1: the pricing page lists 2.5K free/month, but the SDK docs describe it as private preview/enterprise. Treat it as a later calibration option, not a dependency.

### 6.3 Traffic realism

- ORS/Valhalla use free-flow speeds; Bengaluru peak traffic can double travel time.
- Apply **time-of-day multipliers** by mode and area:
  - Weekday 7:30–10:30: 1.7×
  - Weekday 17:00–20:30: 1.9×
  - Weekday midday: 1.3×
  - Saturday evening: 1.4×
  - Sunday morning: 0.9×
  - Monsoon: +20%
- Show **ranges** for cab/auto: "12–25 min".
- Add **door-to-door**: +3 min pickup/walk for cab, +5 min parking.
- Offer a **peak preview** toggle: now / +1h / Saturday 7pm.
- If you want real calibration, sample TomTom Traffic Flow API on 30–50 corridors for two weeks and fit multipliers by hour/day. Store as a small JSON table; don't call it at runtime.

### 6.4 Caching

- Round origin to an H3 cell (res 9, ~200m) or a 150m grid.
- Key: `cell + mode + minutes + hour_bucket + weekday/weekend`.
- Cache polygons in IndexedDB and server-side.
- Precompute the 10/15/20-min walking isochrones for the areas you use most.
- Invalidate monthly or when the routing graph changes.

### 6.5 Point-in-polygon + ranking

- Filter the 188k POI index by bbox, then point-in-polygon in a Web Worker.
- Rank by `quality × open × time_suitability × weather_suitability × personal_fit`.
- Return top 200 to the UI; cluster the rest.
- Show counts per intent before rendering pins.

---

## 7. Architecture

### 7.1 Recommended: static-first + tiny routing service

```
┌──────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE (local)                     │
│  Overture S3 ─┐                                                  │
│  OSM extract ─┤                                                  │
│  Wikidata ────┼──► DuckDB + Python ──► places.parquet/json       │
│  GTFS ────────┤                       areas.geojson              │
│  BBMP ────────┤                       metro.geojson              │
│  Curated YAML ┘                       poi_index.bin / pmtiles    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND (static, PWA)                       │
│  React + Vite + TypeScript                                       │
│  MapLibre GL + PMTiles (self-hosted basemap)                     │
│  Tailwind + shadcn/ui                                            │
│  Zustand (UI state) + Dexie (personal layer)                     │
│  MiniSearch (names) + Web Worker (spatial filter)                │
│  IndexedDB cache (isochrones, tiles, place details)              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ROUTING API (small, stateless)                  │
│  FastAPI or Hono                                                 │
│  ORS hosted (MVP)  →  Valhalla Docker (production)               │
│  /isochrone?origin=&mode=&minutes=&at=                           │
│  /route?from=&to=&mode=                                          │
│  /metro?from=&to=                                                │
│  cache: SQLite + in-memory                                       │
└──────────────────────────────────────────────────────────────────┘
```

Why static-first:

- **188k POIs is small.** A compact index of lat/lon/intent/flags is ~3MB. Filtering in the browser is instant.
- **No backend for browsing** means no cold starts, no DB bills, works offline.
- **Only routing needs a service**, and it's stateless and cacheable.
- **Personal data stays on your device** (IndexedDB), exportable as JSON.

### 7.2 Stack choices

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript | Fast, familiar, easy to deploy static. Next.js optional if you want SSR/share pages. |
| Map | MapLibre GL JS + PMTiles | Open, no token, self-hostable, fast. |
| Basemap | Protomaps/OSM extract → PMTiles | No tile provider lock-in; offline-friendly. |
| UI | Tailwind + shadcn/ui + Framer Motion | Fast to build, good defaults. |
| State | Zustand + TanStack Query | Simple; query cache for place details. |
| Personal DB | Dexie (IndexedDB) | Local-first; export/import JSON. |
| Search | MiniSearch / FlexSearch | Client-side, typo-tolerant, no server. |
| Data pipeline | Python + DuckDB + GeoPandas/Shapely | DuckDB reads Overture Parquet directly; GeoPandas for geometry. |
| Routing | ORS → Valhalla | Start free; self-host when it matters. |
| Deploy | Cloudflare Pages (static) + Fly.io/Hetzner (routing) | Cheap, fast, no CI. |
| Analytics | None, or self-hosted Umami | Privacy; personal tool. |

### 7.3 Alternatives

**A. Local-only**
- Docker Compose on your laptop; Tailscale to reach it from your phone.
- Zero hosting cost; best privacy.
- Downside: laptop must be awake; not great when travelling.

**B. Static + hosted routing (recommended)**
- Cloudflare Pages + Fly.io routing API.
- Works anywhere; ~$5–10/month.
- Downside: routing service is a small ops surface.

**C. Full-stack PostGIS + Valhalla**
- Next.js + Postgres/PostGIS + Martin/PMTiles + Valhalla.
- Most powerful (server-side spatial SQL, multi-user, sharing).
- Downside: more ops, more cost, slower to start.

Start with **B**; migrate to **C** only if you make it public or multi-user.

### 7.4 Sizing

| Asset | Size |
|---|---|
| Overture Bengaluru Parquet (selected cols) | 20–40MB |
| Compact POI index | ~3MB |
| Place detail shards | 20–30MB |
| PMTiles basemap (z0–14) | 50–150MB |
| Valhalla tiles | 300–600MB |
| Total | <1GB |

A $5–10/month VPS (2 vCPU, 2–4GB RAM) is enough for personal use.

### 7.5 Look & feel

The app should feel like a **field guide**, not a dashboard.

**Palette**
- Paper: `#F7F3EA` (light) / `#121417` (night)
- Ink: `#23201C`
- Water: `#C9DDE8`
- Parks: `#DCE8D0`
- Food: `#E4572E`
- Coffee: `#8C5A3C`
- Culture: `#6C5CE7`
- Outdoors: `#2E8B57`
- Heritage: `#B8860B`

**Map**
- Muted basemap; POI pins only for the active intents.
- Isochrone: translucent accent fill + dashed boundary; the rest of the city fades slightly.
- Area polygon: thin outline + label, no heavy fill.
- Metro lines: line colours, small station dots.
- Parks/lakes as polygons, not pins.

**Sidebar wireframe**

```
┌──────────────────────────────────────────────┐
│  Bengaluru Atlas            [search]   [me]  │
├──────────────────────────────────────────────┤
│  WHERE   Basavanagudi                [change]│
│  WHAT    [Eat 128] [Coffee 46] [Walk 12] ... │
│  HOW FAR [Walk] [2W] [Cab] [Metro]           │
│          5   10   15   20   30 min           │
│  WHEN    [Now] [Arrive 6:30pm] [Sat 7pm]     │
│  FILTERS [Open now] [Chain-free] [Veg] ...   │
├──────────────────────────────────────────────┤
│  46 places · sorted by Worth a detour        │
│  ┌────────────────────────────────────────┐  │
│  │ 🥞  Vidyarthi Bhavan       6 min walk  │  │
│  │     Independent · open till 8pm        │  │
│  │     Benne masala dosa; go before 8am   │  │
│  │     [Save] [Been] [Go]                 │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ 🛕  Bull Temple           10 min walk  │  │
│  │     Heritage · 16th century · free     │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Micro-interactions**
- Filter changes animate the count and the map, not a full reload.
- Hovering a card gently pulses the pin; clicking a pin slides the card into view.
- The isochrone draws in over 300ms when the time slider changes.
- Empty state: "Nothing within 10 min. Try 15 min → +38 places."
- Save action: a small stamp animation, not a confetti explosion.

---

## 8. Build plan

### Phase 0 — Data spike (2 days)

**Goal:** prove the data is good enough and learn its shape.

- DuckDB query Overture bbox; count by `basic_category` and `taxonomy.hierarchy`.
- OSM extract; count parks, lakes, temples, heritage, metro stations.
- Download BBMP 225 wards and the two GTFS feeds.
- Build a notebook with 10 maps: all POIs, food, coffee, parks, heritage, metro access, chains vs independents, confidence distribution, hours coverage, area counts.
- Write `data-spike.md`: counts, gaps, surprises.

**Acceptance:** you can answer "how many cafés are in Indiranagar?" and "how many parks within 2km of Cubbon?" from your own data.

### Phase 1 — Map MVP (weekend 1)

**Goal:** a usable map you'd actually open.

- Pipeline v1: Overture → `places.parquet` + `areas.geojson` + `poi_index.bin`.
- MapLibre + PMTiles; intent chips with counts; area click/search; place cards.
- Save to localStorage; "open in Google Maps".
- Basic filters: open now (if hours known), chain-free, price.
- Deploy to Cloudflare Pages.

**Acceptance:** pick Indiranagar, tap "Coffee", see 40+ places, save 3, share a link.

### Phase 2 — Travel time (weekend 2)

**Goal:** "less than 10 minutes away" actually works.

- Routing API with ORS isochrones; walk/cycle/cab modes.
- Time slider + isochrone overlay + point-in-polygon filtering.
- Door-to-door time on cards; peak preview; ranges for cab.
- Cache isochrones in IndexedDB + server.
- "Travel-time unlock" counts.

**Acceptance:** drop a pin in HSR, choose "10 min walk", see only places inside the polygon, with times on cards.

### Phase 3 — Enrichment & quality (weekends 3–4)

**Goal:** it feels local, not like a data dump.

- OSM merge: parks, lakes, temples, heritage, metro, bus, parking.
- Wikidata descriptions/images; heritage flags.
- Hours parsing + "open when I arrive" + "hours unknown".
- Chain detection; hidden-gem score; "why this" reasons.
- Area DNA + compare areas.
- Curated seeds: 150–250 places with notes, best time, price/ticket.
- Ghost watch / new in town (release diff).

**Acceptance:** a place card tells you why it's worth the trip, whether it's open when you arrive, and whether it's a chain.

### Phase 4 — Personal layer (weekend 5)

**Goal:** the app knows you.

- Visits, ratings, notes, "would return".
- Lists; "hide visited"; "new to me".
- Import Google Takeout (Saved Places.json + list CSVs), Foursquare/Swarm, GPX.
- Taste profile with explainable weights.
- "Surprise me" + three-card decision.

**Acceptance:** after importing your history, the app stops recommending places you've been and starts suggesting things you'd actually save.

### Phase 5 — Planning & sharing (weekend 6)

**Goal:** from "where?" to "here's the plan".

- Plan my day: timeline, travel legs, opening hours, meal windows, sunset, last metro.
- 10–12 curated trails.
- Share link (static map + list), GPX/KML export, add to Calendar.
- PWA install + basic offline cache.

**Acceptance:** plan a 4-hour Saturday in Malleshwaram, reorder stops, share it on WhatsApp, and it opens on a friend's phone without an app.

### Phase 6 — Polish & deploy (ongoing)

- Mobile layout; bottom sheets; big touch targets.
- Performance: virtualized lists, prefetch, debounce.
- Monthly refresh + diff report.
- Backups; export personal data.
- Optional: Valhalla self-host, eBird layer, weather/rain mode, golden hour.

### If you only have one weekend

Ship Phase 1 only: map + intents + area + save. It's already more useful than a list of blog posts.

### If you have two weekends

Add Phase 2: the isochrone. That's the "aha" moment.

---

## 9. Costs

| Item | Cost |
|---|---|
| Overture / OSM / Wikidata / GTFS / BBMP | ₹0 |
| ORS hosted (MVP) | ₹0 (500 isochrones/day) |
| Cloudflare Pages | ₹0 |
| Fly.io / Hetzner routing API | ~₹400–900/month |
| Domain | ~₹800/year |
| Optional FSQ API enrichment | 500 free calls/month; $15/1000 after |
| Optional Google Places | Pay-per-call; avoid bulk |
| Map tiles | ₹0 self-hosted |
| **Total** | **₹0–1,000/month** |

---

## 10. Legal & attribution

- **Overture Places**: CDLA-Permissive-2.0 / Apache-2.0. Attribute "© Overture Maps Foundation" and list sources. No OSM share-alike on the places theme.
- **OpenStreetMap**: ODbL. Attribute "© OpenStreetMap contributors". If you distribute a derived database, share-alike applies — keep OSM-derived layers separable, or comply.
- **Foursquare OS Places**: Apache-2.0. Attribute.
- **Wikidata**: CC0. **Wikipedia**: CC BY-SA; attribute text/images.
- **GTFS**: ODbL/CC; attribute BMTC, BMRCL and the community maintainers (Vonter et al.).
- **openrouteservice / HeiGIT**: isochrone and route results are CC-BY-SA 4.0 under the current terms. Attribute `© openrouteservice by HeiGIT | Data from OpenStreetMap` on the map and on exported/shared plans. If you make the app public, treat share-alike on derived route/isochrone data as a real obligation; self-hosted Valhalla avoids it.
- **eBird**: non-commercial, key-based, attribution; do not expose sensitive species.
- **Google Maps**: deep links only. Do not store/cache ratings, hours, photos, or reviews.
- **Zomato/Swiggy/Justdial**: no scraping; deep links only.
- **Public vs personal**: personal use is low-risk. If you make it public, add terms, privacy, rate limits, moderation and an ODbL compliance plan.

---

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Closed places waste a trip | High | High | `operating_status`, `last_seen`, confidence, ghost watch, one-tap correction, "call ahead". |
| Hours unknown/wrong | High | Medium | "Hours unknown" chip; curated top 200; user contributions; never guess. |
| Traffic estimates wrong | High | Medium | Ranges, peak preview, time-of-day multipliers; don't promise exact ETAs. |
| Duplicates/junk in Overture | Medium | Medium | Confidence filter, dedupe by name+distance, manual review of top results. |
| Coverage bias (chains/malls over small stalls) | Medium | Medium | OSM + curated seeds + "independent" boost; long-tail toggle. |
| ODbL share-alike | Medium | Medium | Keep OSM layer separable; attribute; personal-first. |
| Google ToS | Low | High | Deep links only; no stored ratings/hours. |
| Scope creep | High | High | Phase gates; cut list; ship the loop. |
| Maintenance fatigue | Medium | High | Monthly `make refresh` + diff report; no CI; automate the boring parts. |
| Mobile performance | Medium | Medium | Compact index, Web Worker, virtualized lists, offline cache. |

---

## 12. Success metrics

Personal, not vanity:

- **Time to decide** < 90 seconds from opening the app.
- **70%** of your Bengaluru outings start from the app.
- **≥1 new place** per trip that you'd never have found via Google's first page.
- **<5%** wasted trips due to closed/wrong places.
- **Data refresh** < 30 days old.
- **"Would return"** on ≥60% of visited places.

---

## 13. Open decisions

1. **Web PWA or native?** Recommend PWA first: one codebase, shareable links, offline, no app-store friction.
2. **Hosted or local-only?** Recommend static + small hosted routing API; Tailscale fallback for privacy.
3. **Personal or public?** Recommend personal first. Public adds auth, moderation, ODbL compliance and cost.
4. **Ratings?** Recommend no star ratings; use "Worth a detour" + Google deep link. If you need ratings, use FSQ API sparingly or your own visits.
5. **How much curation?** Recommend 150–250 seeds + 12 trails. That's the difference between "a database" and "a guide".
6. **Which areas first?** Pick the 5–8 areas you actually stay in. Build those deeply before widening.

---

## Appendix A — 49 Bengaluru areas to curate first

**Central / old city**
MG Road & Brigade Road · Church Street · Cubbon Park · Lavelle Road · Richmond Town · Shivajinagar · Frazer Town · Cooke Town · Ulsoor · **Pete lanes (Chickpet / Avenue Road / KR Market)** · Basavanagudi / Gandhi Bazaar · Malleshwaram 8th Cross · Rajajinagar · Yeshwanthpur

**East**
Indiranagar 100ft Road · Indiranagar 12th Main · Domlur · Koramangala 5th Block · Koramangala 7th Block · HSR Layout 27th Main · Bellandur · Marathahalli · Whitefield / ITPL · Kadugodi · Kalyan Nagar · Kammanahalli · Banaswadi · Hebbal · Sanjaynagar

**South**
Jayanagar 4th Block · JP Nagar · BTM Layout · Banashankari · Vijayanagar · Rajarajeshwari Nagar · Kengeri · Electronic City · Sarjapur Road · HSR Sector 2

**North / day trips**
Yelahanka · Devanahalli · Nandi Hills · Hesaraghatta · Ramanagara · Savandurga · Skandagiri · Chunchi Falls / Mekedatu · Dodda Alada Mara (Big Banyan) · Nrityagram

> Start with 12–15 of these. Draw the polygons by hand in QGIS/geojson.io; they don't need to be official.

## Appendix B — 12 trails

1. **Filter Coffee Trail** — Malleshwaram → Basavanagudi → Jayanagar.
2. **Dosa Trail** — Vidyarthi Bhavan → CTR → Rameshwaram → 99 Varieties.
3. **Old Bangalore Heritage Walk** — Pete lanes → KR Market → Bangalore Fort → Tipu Sultan's Summer Palace.
4. **Lakes at Sunrise** — Ulsoor → Sankey Tank → Hebbal.
5. **Bookstore Crawl** — Church Street → MG Road → Indiranagar.
6. **Microbrewery Mile** — Indiranagar → Koramangala → HSR.
7. **Art & Design Day** — MAP → NGMA → Chitrakala Parishath → Rangoli Metro Art Centre.
8. **Temple Trail** — Halasuru Someshwara → Gavi Gangadhareshwara → Bull Temple → Dodda Ganesha.
9. **Market Morning** — KR Market (5am) → Chickpet → Avenue Road.
10. **Birding Lakes** — Hebbal → Hesaraghatta → Madiwala.
11. **Monsoon Day Trip** — Chunchi Falls → Mekedatu → Sangama.
12. **Sunrise Trek** — Skandagiri or Nandi Hills.

## Appendix C — Sample category crosswalk

| Search term | Intent | Subcategory |
|---|---|---|
| dosa, idli, vada | eat | south_indian |
| filter coffee, kaapi | coffee | filter_coffee |
| biryani, biriyani | eat | biryani |
| thali, meals | eat | thali |
| bookstore, second-hand books | shop | bookstore |
| sunset, viewpoint | outdoors | viewpoint |
| lake, kere | outdoors | lake |
| temple, gudi, kovil | heritage | temple |
| fort, kote | heritage | fort |
| market, santhe | shop | market |
| brewery, microbrewery | drinks | brewery |
| trek, betta | daytrip | trek |
| waterfall, falls | daytrip | waterfall |

## Appendix D — Useful links

- Overture Places guide: https://docs.overturemaps.org/guides/places
- Overture schema: https://docs.overturemaps.org/schema/reference/places/place/
- Overture cloud access: https://docs.overturemaps.org/getting-data/cloud-sources
- FSQ OS Places: https://docs.foursquare.com/data-products/docs/access-fsq-os-places
- FSQ OS schema: https://docs.foursquare.com/data-products/docs/places-os-data-schema
- OSM: https://www.openstreetmap.org / https://overpass-turbo.eu
- Geofabrik India: https://download.geofabrik.de/asia/india.html
- Wikidata SPARQL: https://query.wikidata.org
- BBMP wards: https://data.opencity.in/dataset/bbmp-ward-information
- DataMeet spatial data: http://projects.datameet.org/Municipal_Spatial_Data/bangalore
- BMTC GTFS: https://github.com/Vonter/bmtc-gtfs
- BMRCL GTFS: https://github.com/Vonter/bmrcl-gtfs
- ORS isochrones (new host): https://api.heigit.org/ · https://openrouteservice.org/dev/#/api-docs
- HeiGIT plans/quotas: https://account.heigit.org/info/plans
- Valhalla isochrone: https://valhalla.github.io/valhalla/api/isochrone/
- Protomaps: https://protomaps.com
- MapLibre: https://maplibre.org
- Open-Meteo: https://open-meteo.com
- eBird API: https://documenter.getpostman.com/view/664302/S1ENwy59
- Google Takeout: https://takeout.google.com

## Appendix E — The 15 small features I'd fight for

If you build nothing else from section 4.2, build these:

1. Open when I arrive.
2. Peak-hour preview with ranges.
3. Rain escape.
4. Chain-free toggle.
5. Hidden-gem score + reasons.
6. New in town / ghost watch.
7. Golden hour + sunset.
8. Metro + last train.
9. Park-once stroll.
10. Pairings / what's around.
11. Import history / new to me.
12. One-tap correction.
13. Area DNA / compare.
14. Travel-time unlock.
15. Share a plan without an app.

---

*End of plan.*
