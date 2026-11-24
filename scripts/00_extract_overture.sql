-- Phase 0: extract the Bengaluru slice from Overture Places.
--
-- The bbox covers Bengaluru city plus the airport corridor. Day trips
-- (Nandi Hills, Skandagiri, Savandurga, Ramanagara) are outside it; keep
-- those as a small curated layer, or widen the bbox deliberately.
--
-- Prereqs:
--   duckdb 1.2+
--   mkdir -p data/raw
--
-- Pin the release before running. Resolve the latest at:
--   https://stac.overturemaps.org/catalog.json
-- Replace the date below if a newer release exists.

INSTALL spatial;
LOAD spatial;
INSTALL httpfs;
LOAD httpfs;
SET s3_region = 'us-west-2';

-- Default results: reliable, open, named places.
COPY (
  SELECT
    id,
    names.primary              AS name,
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
    socials,
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

-- Long tail: low-confidence and unnamed rows. Useful for small stalls and
-- "include the long tail", but not for the default view.
COPY (
  SELECT
    id,
    names.primary              AS name,
    basic_category,
    taxonomy.primary           AS category,
    taxonomy.hierarchy         AS category_path,
    confidence,
    operating_status,
    addresses[1].freeform      AS address,
    phones[1]                  AS phone,
    websites[1]                AS website,
    brand.names.primary        AS brand,
    ST_X(geometry)             AS lon,
    ST_Y(geometry)             AS lat,
    sources
  FROM read_parquet(
    's3://overturemaps-us-west-2/release/2026-11-18.0/theme=places/type=place/*'
  )
  WHERE bbox.xmin BETWEEN 77.35 AND 77.85
    AND bbox.ymin BETWEEN 12.75 AND 13.20
    AND (confidence IS NULL OR confidence < 0.5)
) TO 'data/raw/overture_bengaluru_long_tail.parquet' (FORMAT PARQUET);
