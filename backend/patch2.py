with open("backend/ask/geo_discovery.py", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "rows = db.execute(sql, params).fetchall()" in line:
        lines.insert(i+1, "    print(f'GEO_DISCOVERY: question={question}, rows={len(rows)}, budget={budget}', flush=True)\n")
        break

for i, line in enumerate(lines):
    if "candidates.sort(key=lambda x: x.get(\"match_score\", 0), reverse=True)" in line:
        lines.insert(i, "    print(f'GEO_DISCOVERY: candidates_after_haversine={len(candidates)}', flush=True)\n")
        break

with open("backend/ask/geo_discovery.py", "w") as f:
    f.writelines(lines)
