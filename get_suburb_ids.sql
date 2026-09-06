SELECT id, name, state, postcode FROM suburbs_ui_v3 
WHERE name ILIKE '%Albert Park%' OR postcode = '3206'
ORDER BY state, name;
