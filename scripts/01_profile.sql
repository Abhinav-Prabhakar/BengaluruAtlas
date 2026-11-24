-- Phase 0: profile the extracted Bengaluru slice.
-- Run after scripts/00_extract_overture.sql.

INSTALL spatial;
LOAD spatial;

-- How many places did we get?
SELECT count(*) AS places
FROM 'data/raw/overture_bengaluru.parquet';

-- Top categories. These are the raw Overture categories, before the
-- 15-intent crosswalk.
SELECT
  basic_category,
  count(*) AS n
FROM 'data/raw/overture_bengaluru.parquet'
GROUP BY 1
ORDER BY n DESC
LIMIT 60;

-- Confidence distribution. If the high-confidence set is too small,
-- lower the threshold or add a long-tail toggle.
SELECT
  round(confidence, 1) AS confidence,
  count(*) AS n
FROM 'data/raw/overture_bengaluru.parquet'
GROUP BY 1
ORDER BY 1 DESC;

-- Operating status and freshness signals.
SELECT
  operating_status,
  count(*) AS n
FROM 'data/raw/overture_bengaluru.parquet'
GROUP BY 1
ORDER BY n DESC;

-- Attribute completeness: website / phone / address coverage.
SELECT
  count(*) AS places,
  count(website) AS with_website,
  count(phone) AS with_phone,
  count(address) AS with_address,
  count(brand) AS with_brand
FROM 'data/raw/overture_bengaluru.parquet';

-- How many sources back each place? A proxy for confidence/quality.
SELECT
  len(sources) AS source_count,
  count(*) AS n
FROM 'data/raw/overture_bengaluru.parquet'
GROUP BY 1
ORDER BY 1;

-- Quick sanity check: the 20 most common named coffee/cafe places.
SELECT name, category, confidence, lon, lat
FROM 'data/raw/overture_bengaluru.parquet'
WHERE basic_category IN ('cafe', 'coffee_shop')
ORDER BY confidence DESC
LIMIT 20;

-- Quick sanity check: parks and temples.
SELECT name, category, confidence, lon, lat
FROM 'data/raw/overture_bengaluru.parquet'
WHERE basic_category IN ('park', 'garden', 'hindu_temple', 'religious_place')
ORDER BY confidence DESC
LIMIT 20;
