import re, sys

content = open(sys.argv[1]).read()
content = re.sub(r'\{/\*.*?\*/\}', '', content, flags=re.DOTALL)
content = re.sub(r'//.*', '', content)

lines = content.split('\n')
depth = 0
for i, line in enumerate(lines):
    opens = len(re.findall(r'<[a-zA-Z]+[^>]*[^/]>', line))
    closes = len(re.findall(r'</[a-zA-Z]+>', line))
    depth += opens - closes
    print(f"L{i+1}: +{opens} -{closes} | depth={depth} | {line[:50]}")
