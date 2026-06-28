import json
import random

def update_json(file_path):
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        for sub in data:
            if "metrics" in sub:
                score = round(random.uniform(0.5, 9.5), 1)
                if score > 7:
                    sentiment = f"Bullish ({score})"
                elif score > 4:
                    sentiment = f"Neutral ({score})"
                else:
                    sentiment = f"Bearish ({score})"
                sub["metrics"]["aiNewsSentiment"] = sentiment
        with open(file_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Updated {file_path}")
    except Exception as e:
        print(f"Failed to update {file_path}: {e}")

update_json("backend/suburbs_data.json")
update_json("src/data/suburbs_generated.json")
update_json("src/data/enriched_suburbs.json")
