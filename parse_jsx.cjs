const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let openTags = [];
let regex = /<(\/?)([a-zA-Z0-9]+)[^>]*?(\/?)>/g;

for (let i = 241; i < 986; i++) {
  let line = lines[i];
  let match;
  while ((match = regex.exec(line)) !== null) {
    const isClose = match[1] === '/';
    const tag = match[2];
    const isSelfClosing = match[3] === '/';
    
    // Ignore some known self-closing or non-div elements if we want
    if (tag.toLowerCase() === 'br' || tag.toLowerCase() === 'hr' || tag.toLowerCase() === 'input' || tag.toLowerCase() === 'img') continue;
    
    if (isSelfClosing) continue;
    
    if (!isClose) {
      openTags.push({tag, line: i+1});
    } else {
      if (openTags.length > 0) {
        const last = openTags.pop();
        if (last.tag !== tag) {
          console.log(`Mismatch at line ${i+1}: Expected </${last.tag}> (from line ${last.line}) but found </${tag}>`);
        }
      } else {
        console.log(`Extra closing tag at line ${i+1}: </${tag}>`);
      }
    }
  }
}
if (openTags.length > 0) {
  console.log("Unclosed tags:", openTags);
}
