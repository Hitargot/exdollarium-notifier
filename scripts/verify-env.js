const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const s = fs.readFileSync(envPath, 'utf8');
const lines = s.split(/\r?\n/).filter(Boolean);
const env = {};
lines.forEach(l => {
  if (l.trim().startsWith('#')) return;
  const arr = l.split('=');
  const k = arr.shift();
  const v = arr.join('=');
  env[k.trim()] = v ? v.trim() : '';
});
const raw = env.API_URL || '';
const parsed = raw.replace(/^['\"]|['\"]$/g, '').trim();
console.log('--- Read .env from', envPath);
console.log('raw API_URL =>', raw);
console.log('parsed API_URL =>', parsed);
console.log('ENV =>', env.ENV || '');
