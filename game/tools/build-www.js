// Copies the playable game into www/ for Capacitor (skips tooling, docs and native projects).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const SKIP = new Set(['www', 'node_modules', 'ios', 'android', 'tools', '.git', 'package.json', 'package-lock.json', 'capacitor.config.json', 'README.md', 'MONETIZATION.md', 'store', 'sw.js.bak', 'agents', 'release.json']);
fs.rmSync(out, { recursive: true, force: true });
(function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const n of fs.readdirSync(src)) {
    if (src === root && SKIP.has(n)) continue;
    const s = path.join(src, n), d = path.join(dst, n);
    if (fs.statSync(s).isDirectory()) copy(s, d); else fs.copyFileSync(s, d);
  }
})(root, out);
console.log('www/ ready');
