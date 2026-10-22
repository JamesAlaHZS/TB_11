const fs = require('node:fs');
const acorn = require('acorn');
const crypto = require('node:crypto');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
function normalize(code) {
  const ast = acorn.parse(code, {ecmaVersion: 'latest'});
  function visit(n) {
    if (!n || typeof n !== 'object') return;
    delete n.start; delete n.end; delete n.raw;
    if (n.type === 'VariableDeclarator' && ['pvStr','endStr','gStr'].includes(n.id.name)) {
      if (n.init?.type !== 'Literal' || typeof n.init.value !== 'string') throw Error('Campaign declaration shape changed');
      n.init.value = '<TG-ala>';
    }
    for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(visit); else visit(v);
  }
  visit(ast);
  return JSON.stringify(ast);
}
const a = normalize(input.source);
const b = normalize(input.target);
if (a !== b) throw Error('Sanitizer changed JavaScript logic');
process.stdout.write(JSON.stringify({sha256: crypto.createHash('sha256').update(b).digest('hex')}));
