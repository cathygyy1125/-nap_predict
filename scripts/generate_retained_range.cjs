const fs = require('fs');
const path = require('path');

const gmPath = path.resolve(__dirname, '..', 'group_mean_by_age.ts');
const gmText = fs.readFileSync(gmPath, 'utf8');
const groupMeanByAge = {};
{
  const match = gmText.match(/export const groupMeanByAge: Record<number, number> = \{([\s\S]*?)\};/);
  if (match) {
    const body = match[1];
    const lines = body.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/(\d+)\s*:\s*([0-9.]+)/);
      if (m) {
        groupMeanByAge[Number(m[1])] = Number(m[2]);
      }
    }
  }
}

const priorCsvPath = path.resolve(__dirname, '..', '小睡次数群体分布 - Sheet1.csv');
const csv = fs.readFileSync(priorCsvPath, 'utf8').trim();
const lines = csv.split(/\r?\n/).filter(Boolean);
const rows = lines.slice(1);
const priorMap = new Map();
for (const raw of rows) {
  const cells = raw.split(',');
  const ageStr = cells[0].replace(/^\ufeff/, '').trim();
  const age = parseInt(ageStr, 10);
  if (!Number.isFinite(age)) continue;
  const probs = [];
  for (let k = 0; k <= 6; k++) {
    const txt = (cells[k+1] || '').trim();
    if (!txt) { probs[k] = 0; continue; }
    const num = parseFloat(txt.replace('%',''));
    probs[k] = Number.isFinite(num) ? num/100 : 0;
  }
  priorMap.set(age, probs);
}

function computeMean(age) {
  if (groupMeanByAge[age] != null) return groupMeanByAge[age];
  const probs = priorMap.get(age);
  if (!probs) return NaN;
  let mu = 0, total = 0;
  for (let k = 0; k < probs.length; k++) { mu += k * (probs[k] || 0); total += (probs[k] || 0); }
  return total > 0 ? mu / total : NaN;
}

const ages = Array.from(new Set([...Object.keys(groupMeanByAge).map(Number), ...Array.from(priorMap.keys())])).sort((a,b)=>a-b);

const outHeader = ['月龄','平均小睡次数','下界(均值-2.5)','上界(均值+2.5)','保留范围'];
const out = [outHeader.join(',')];

for (const age of ages) {
  const mean = computeMean(age);
  if (!Number.isFinite(mean)) continue;
  const low = mean - 2.5;
  const high = mean + 2.5;
  const minNap = Math.max(0, Math.ceil(low));
  const maxNap = Math.min(6, Math.floor(high));
  const range = `${minNap}-${maxNap}`;
  out.push([
    age,
    mean.toFixed(2),
    low.toFixed(2),
    high.toFixed(2),
    range
  ].join(','));
}

const outPath = path.resolve(__dirname, '..', '各月龄_均值±2.5_保留范围.csv');
fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('生成完成:', outPath);

