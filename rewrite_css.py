import re

with open('src/index.css', 'r') as f:
    css = f.read()

# 1. Update font to Inter
css = css.replace("family=Outfit:wght@300;400;500;600;700", "family=Inter:wght@300;400;500;600;700")
css = css.replace("'Outfit', sans-serif", "'Inter', sans-serif")

# 2. Update :root variables
root_replacement = """
:root {
  --bg-dark: #F8FAFC; /* Light gray body */
  --bg-card: #FFFFFF; /* White cards */
  --border-glass: #E2E8F0; /* Light borders */
  --text-primary: #0F172A; /* Dark slate text */
  --text-secondary: #64748B;
  --text-muted: #94A3B8;
  --accent-cyan: #2563EB; /* Bright Blue */
  --accent-purple: #1E40AF; /* Deep Blue */
  --success: #059669;
  --warning: #D97706;
  --danger: #DC2626;
  --bg-glass: #FFFFFF;
}
"""
css = re.sub(r':root\s*\{[^}]+\}', root_replacement.strip(), css)

# 3. Fix title-glow to be solid text
title_glow_replacement = """
.title-glow {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}
"""
css = re.sub(r'\.title-glow\s*\{[^}]+\}', title_glow_replacement.strip(), css)

# 4. Fix glass-card
glass_card_replacement = """
.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  padding: 2rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}
"""
css = re.sub(r'\.glass-card\s*\{[^}]+\}', glass_card_replacement.strip(), css)

# 5. Fix premium-select / inputs to light theme
css = css.replace("background: rgba(0, 0, 0, 0.4);", "background: #FFFFFF;")
css = css.replace("background: rgba(0, 0, 0, 0.3);", "background: #F8FAFC;")
css = css.replace("background: rgba(0, 0, 0, 0.2);", "background: #F1F5F9;")
css = css.replace("background: rgba(0, 0, 0, 0.25);", "background: #F1F5F9;")
css = css.replace("background: var(--bg-dark);", "background: #FFFFFF;") # For select options

# 6. Main score gradient text
main_score_replacement = """
.main-score-value {
  font-size: 3.5rem;
  font-weight: 700;
  color: var(--accent-cyan);
  line-height: 1;
}
"""
css = re.sub(r'\.main-score-value\s*\{[^}]+\}', main_score_replacement.strip(), css)

# 7. metric-box background
metric_box_replacement = """
.metric-box {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-glass);
}
"""
css = re.sub(r'\.metric-box\s*\{[^}]+\}', metric_box_replacement.strip(), css)

with open('src/index.css', 'w') as f:
    f.write(css)

print("index.css updated.")
