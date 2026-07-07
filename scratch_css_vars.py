import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Fix broken CSS variables
content = content.replace("var(--text-muted)", "var(--text-secondary)")
content = content.replace("var(--border-card)", "var(--border-glass)")

with open('src/App.tsx', 'w') as f:
    f.write(content)
