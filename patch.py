with open("backend/routers/ask_property.py", "r") as f:
    content = f.read()
import re
new_content = re.sub(
    r"raw = discover_suburbs\(db, req.question, budget=req.budget\)",
    "print('INCOMING req:', req.json())\n    raw = discover_suburbs(db, req.question, budget=req.budget)\n    print('OUTGOING raw:', raw)",
    content
)
with open("backend/routers/ask_property.py", "w") as f:
    f.write(new_content)
