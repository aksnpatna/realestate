const { parse } = require('@babel/parser');
const fs = require('fs');

const code = fs.readFileSync('.old_app_jsx', 'utf8');
try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("Parsed successfully!");
} catch (e) {
  console.log("Error:", e.message);
}
