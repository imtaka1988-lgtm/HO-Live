
const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');
const oldLine = 'const JWT_SECRET = process.env.JWT_SECRET || "s6-lol-admin-secret-key-2026";';
const newLines = [
  'const JWT_SECRET = process.env.JWT_SECRET;',
  'if (!JWT_SECRET) {',
  '  console.error("JWT_SECRET missing");',
  '  process.exit(1);',
  '}'
].join('\n');
c = c.replace(oldLine, newLines);
fs.writeFileSync('server.js', c);
console.log('DONE');

