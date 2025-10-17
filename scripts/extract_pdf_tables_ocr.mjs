import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';

const PDF_PATH = '3-35 月龄小睡次数&日程模板.pdf';
const OUT_DIR = 'extracted/pages';
const MD_OUT = 'docs/3-35_月龄小睡次数_参数_OCR.md';

async function ensureScreenshots() {
  const parser = new PDFParse({ data: fs.readFileSync(PDF_PATH) });
  const shots = await parser.getScreenshot({ desiredWidth: 1600, imageBuffer: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const p of shots.pages) {
    const fname = path.join(OUT_DIR, `page-${String(p.pageNumber).padStart(2, '0')}.png`);
    if (!fs.existsSync(fname)) {
      fs.writeFileSync(fname, Buffer.from(p.data));
    }
  }
  return shots.pages.length;
}

async function extractMonths() {
  // Use text extraction (more reliable than OCR for month labels)
  const parser = new PDFParse({ data: fs.readFileSync(PDF_PATH) });
  const res = await parser.getText();
  const map = new Map(); // page -> month
  for (const p of res.pages) {
    const t = (p.text || '').replace(/\u0001/g, '');
    const m = t.match(/(\d{1,2})[月⽉]龄/);
    if (m) {
      map.set(p.num, Number(m[1]));
    }
  }
  return map;
}

function toHMMFromMinutes(numStr) {
  const n = parseInt(numStr, 10);
  if (!Number.isFinite(n)) return numStr;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function normalizeTokens(tokens) {
  // Convert numeric tokens (minutes) to h:mm
  return tokens.map((tok) => {
    if (tok.includes(':')) return tok; // already formatted
    const clean = tok.replace(/[^0-9]/g, '');
    if (!clean) return tok;
    // Treat all numeric tokens as minutes
    return toHMMFromMinutes(clean);
  });
}

function parseOcrText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ww = [];
  const dd = [];
  const meta = { wake: [], bed: [] };
  for (const line of lines) {
    const wake = line.match(/(\d{1,2}:\d{2})\s*-?$/);
    if (wake) meta.wake.push(wake[1]);
    const w = line.match(/^WW(\d+)\s+([0-9:]+)\s+([0-9:]+)$/i) || line.match(/^WW(\d+)\s+([0-9]+)\s+([0-9]+)$/i);
    if (w) {
      const idx = Number(w[1]);
      const tokens = normalizeTokens([w[2], w[3]]);
      ww.push({ idx, from: tokens[0], to: tokens[1] });
      continue;
    }
    const d = line.match(/^D(\d+)\s+([0-9:]+)\s+([0-9:]+)$/i) || line.match(/^D(\d+)\s+([0-9]+)\s+([0-9]+)$/i);
    if (d) {
      const idx = Number(d[1]);
      const tokens = normalizeTokens([d[2], d[3]]);
      dd.push({ idx, from: tokens[0], to: tokens[1] });
      continue;
    }
  }
  ww.sort((a, b) => a.idx - b.idx);
  dd.sort((a, b) => a.idx - b.idx);
  return { ww, dd, meta };
}

async function run() {
  const pages = await ensureScreenshots();
  const pageToMonth = await extractMonths();
  const worker = await createWorker('eng', undefined, { langPath: 'tessdata', gzip: true });
  await worker.setParameters({ tessedit_char_whitelist: '0123456789:-WDN() ' });

  const perMonth = [];
  for (let i = 1; i <= pages; i++) {
    const imgPath = path.join(OUT_DIR, `page-${String(i).padStart(2, '0')}.png`);
    const { data: { text } } = await worker.recognize(fs.readFileSync(imgPath));
    const parsed = parseOcrText(text);
    const month = pageToMonth.get(i) || null;
    perMonth.push({ page: i, month, ...parsed, raw: text });
  }
  await worker.terminate();

  // Write Markdown
  const lines = [];
  lines.push('# 3–35 月龄小睡次数参数（OCR 自动提取，待人工校对）');
  lines.push('');
  lines.push('说明：OCR 仅使用英文模型，表格为图片，存在识别误差。时间已做简单格式化规则（如 120 → 1:20，2 → 2:00，30 → 0:30）。建议人工核对。');
  lines.push('');
  for (const m of perMonth) {
    lines.push(`## ${m.month ? `${m.month} 月龄` : `第 ${m.page} 页（未识别月龄）`}`);
    if (m.meta.wake.length) lines.push(`- 起床（识别）：${m.meta.wake.join('，')}`);
    // Bedtime not reliably captured; left to raw
    if (m.ww.length) {
      lines.push('- 清醒窗（WW）：');
      for (const r of m.ww) lines.push(`  - WW${r.idx}: ${r.from} – ${r.to}`);
    }
    if (m.dd.length) {
      lines.push('- 小睡时长（D）：');
      for (const r of m.dd) lines.push(`  - D${r.idx}: ${r.from} – ${r.to}`);
    }
    lines.push('- 原始 OCR 文本（摘录）：');
    lines.push('  ' + m.raw.replace(/\s+/g, ' ').slice(0, 600));
    lines.push('');
  }

  fs.mkdirSync(path.dirname(MD_OUT), { recursive: true });
  fs.writeFileSync(MD_OUT, lines.join('\n'));
  console.log(`Written ${MD_OUT}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
