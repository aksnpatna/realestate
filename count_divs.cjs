const fs = require('fs');
const content = fs.readFileSync('src/components/BuyFinder.tsx', 'utf8').split('\n');
const slice = content.slice(97, 263); // lines 98 to 264
let open = 0;
let closed = 0;
for (let i = 0; i < slice.length; i++) {
  const line = slice[i];
  const openMatches = line.match(/<div(\s|>)/g);
  const closeMatches = line.match(/<\/div>/g);
  if (openMatches) open += openMatches.length;
  if (closeMatches) closed += closeMatches.length;
  if (openMatches || closeMatches) {
    console.log(`${i+98}: +${openMatches ? openMatches.length : 0} -${closeMatches ? closeMatches.length : 0} | Open: ${open-closed}`);
  }
}
console.log(`Total Open: ${open}, Total Closed: ${closed}, Diff: ${open - closed}`);
