const fs = require('fs');
const path = require('path');

const fr = JSON.parse(fs.readFileSync('frontend/src/locales/fr.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('frontend/src/locales/en.json', 'utf8'));

function resolve(obj, key) {
  return key.split('.').reduce((v, k) => (v && typeof v === 'object' && k in v) ? v[k] : undefined, obj);
}

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(full);
  }
  return files;
}

const files = walk('frontend/src');
const missingFr = {};
const missingEn = {};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /\bt\(['"]([a-zA-Z0-9_.]+)['"]\s*[,)]/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const key = m[1];
    if (!key.includes('.')) continue;
    const rel = file.replace('frontend/src/', '');
    if (resolve(fr, key) === undefined) {
      if (!missingFr[key]) missingFr[key] = [];
      if (!missingFr[key].includes(rel)) missingFr[key].push(rel);
    }
    if (resolve(en, key) === undefined) {
      if (!missingEn[key]) missingEn[key] = [];
      if (!missingEn[key].includes(rel)) missingEn[key].push(rel);
    }
  }
}

console.log('=== MANQUANT dans fr.json (' + Object.keys(missingFr).length + ') ===');
Object.keys(missingFr).sort().forEach(k => console.log(' FR -', k, '  [' + missingFr[k][0] + ']'));

console.log('\n=== MANQUANT dans en.json seulement (' + Object.keys(missingEn).filter(k => !missingFr[k]).length + ') ===');
Object.keys(missingEn).sort().filter(k => !missingFr[k]).forEach(k => console.log(' EN -', k, '  [' + missingEn[k][0] + ']'));
