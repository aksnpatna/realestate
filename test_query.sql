-- Test the query being used in /api/suburbs
SELECT id, name, state, postcode, dq_score, house_median_price
FROM suburbs_ui_v3
WHERE 
    state = 'VIC' 
    AND is_enriched = true 
    AND dq_score >= 80
ORDER BY house_median_price DESC NULLS LAST
LIMIT 50;
