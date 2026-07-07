import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Fix safetyScore
content = content.replace("activeSuburb.metrics.safetyScore", "(activeSuburb.metrics as any).safetyScore")

# Fix houseYield, unitYield, houseDaysOnMarket, houseStockOnMarket, totalProperties, vacancyRate
for prop in ["houseGrossRentalYield", "unitGrossRentalYield", "houseDaysOnMarket", "houseStockOnMarket", "totalProperties", "vacancyRate"]:
    content = content.replace(f"activeSuburb.{prop}", f"(activeSuburb as any).{prop}")

with open('src/App.tsx', 'w') as f:
    f.write(content)
