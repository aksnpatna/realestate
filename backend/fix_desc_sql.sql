-- Fix mortgage band: use PostgreSQL regex on raw_json description
UPDATE suburbs_ui_v3 
SET typical_mortgage_band = subq.mortgage,
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        (regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'likely\s+to\s+be\s+repaying\s+(\$\s*\d[\d,]*\s*-\s*\$\s*[\d,]+)\s+per\s+month',
            'i'
        ))[1] AS mortgage
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.typical_mortgage_band IS NULL
  AND subq.mortgage IS NOT NULL;

-- Fix occupation
UPDATE suburbs_ui_v3 
SET predominant_occupation = subq.occ,
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        initcap((regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'people\s+in\s+\w+\s+work\s+in\s+(?:a\s+|an\s+)?([\w\s\-]+?)\s+occupation',
            'i'
        ))[1]) AS occ
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.predominant_occupation IS NULL
  AND subq.occ IS NOT NULL;

-- Fix area_sqkm
UPDATE suburbs_ui_v3 
SET area_sqkm = subq.area_sqkm::numeric,
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        (regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'approximately\s+([\d,.]+)\s+square\s+kilometres?',
            'i'
        ))[1] AS area_sqkm
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.area_sqkm IS NULL
  AND subq.area_sqkm IS NOT NULL;

-- Fix parks_count
UPDATE suburbs_ui_v3 
SET parks_count = subq.parks::int,
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        (regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'There\s+are\s+(\d+)\s+parks?',
            'i'
        ))[1] AS parks
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.parks_count IS NULL
  AND subq.parks IS NOT NULL;

-- Fix population_2016
UPDATE suburbs_ui_v3 
SET population_2016 = subq.pop2016::int,
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        (regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'population\s+(?:of\s+\w+\s+)?in\s+2016\s+was\s+([\d,]+)\s+people',
            'i'
        ))[1] AS pop2016
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.population_2016 IS NULL
  AND subq.pop2016 IS NOT NULL;

-- Fix population_cagr
UPDATE suburbs_ui_v3 
SET population_cagr = replace(subq.cagr, ',', '')::numeric(10,2),
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        (regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'population\s+growth\s+of\s+([\d,\-.]+)\s*%',
            'i'
        ))[1] AS cagr
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.population_cagr IS NULL
  AND subq.cagr IS NOT NULL;

-- Fix parks_coverage
UPDATE suburbs_ui_v3 
SET parks_coverage_pct = replace(subq.cov, ',', '')::numeric(10,2),
    last_updated = NOW()
FROM (
    SELECT 
        r.id,
        (regexp_match(
            r.raw_json #>> '{suburb,suburb_detail,description}',
            'covering\s+(?:nearly\s+)?([\d,.]+)\s*%',
            'i'
        ))[1] AS cov
    FROM suburbs_raw_v3 r
    WHERE r.status = 'complete'
      AND r.raw_json #>> '{suburb,suburb_detail,description}' IS NOT NULL
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND suburbs_ui_v3.parks_coverage_pct IS NULL
  AND subq.cov IS NOT NULL;
