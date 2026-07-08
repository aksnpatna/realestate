import fs from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

const code = fs.readFileSync('src/App.tsx', 'utf8');
const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  JSXElement(path) {
    const open = path.node.openingElement;
    const close = path.node.closingElement;
    if (open.name.name === 'div' && close) {
      console.log(`div opened at ${open.loc.start.line}, closed at ${close.loc.end.line}`);
    }
  }
});
