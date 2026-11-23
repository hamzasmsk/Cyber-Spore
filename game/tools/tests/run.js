// Runs every browser test (Playwright + Chromium) one after another and prints a pass/fail summary.
// Usage (from game/):  node tools/tests/run.js            all tests
//                      node tools/tests/run.js qa tower   only some
// A test passes when it exits 0 and its last line says "errors none". Screenshots go to tools/tests/out/.
const { spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
const ALL = ['qa', 'weap', 'mon', 'pass', 'tw', 'tree', 'perk', 'daily', 't13', 'flow', 'dev', 'charm', 'journey', 'variants', 'i18nscan', 'icons', 'neo'];
const pick = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
let fail = 0; const rows = [];
for (const t of pick) {
  const f = path.join(__dirname, t + '.js'); if (!fs.existsSync(f)) { rows.push([t, 'YOK']); fail++; continue; }
  const t0 = Date.now(), r = spawnSync('node', [f], { encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || ''), last = out.trim().split('\n').filter(l => /errors/.test(l)).pop() || out.trim().split('\n').pop() || '';
  const ok = r.status === 0 && /errors none/.test(last);
  if (!ok) { fail++; fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', t + '.log'), out); }
  rows.push([t, ok ? 'GEÇTİ' : 'KALDI', ((Date.now() - t0) / 1000).toFixed(0) + ' sn', ok ? '' : last.slice(0, 160)]);
  console.log(rows[rows.length - 1].join('  '));
}
console.log(fail ? `\n${fail} test kaldı (ayrıntı: tools/tests/out/<test>.log)` : '\nTüm testler geçti');
process.exit(fail ? 1 : 0);
