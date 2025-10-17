import React, { useMemo, useState } from 'react';
// 直接从 CSV 加载群体先验分布（Vite 原生支持 ?raw 导入为文本）
// 文件路径包含空格和中文，按相对路径引入即可
// @ts-ignore - 开发模式下不做类型检查；若需构建可补充 *?raw 声明
import csvText from './小睡次数群体分布 - Sheet1.csv?raw';
import { getGroupMean } from './group_mean_by_age';

type ProbMap = Record<string, number>;
type Scenario = {
  n: number;
  description: string;
  probabilities: ProbMap;
  predicted: number;
  weights?: string;
};

const EBNapProbabilityCalculator = () => {
  const S = 7; // 先验强度
  // 短觉降权（计数模型的逐日权重）参数：参见《经验贝叶斯法计算小睡次数.md》第9节
  const BETA = 0.5;    // 影响系数 beta
  const W_MIN = 0.5;   // 天级最小权重 w_min

  // 计算原始均值（不归一化）与期望均值（归一化）
  const getMeans = (age: number): { rawMean: number; expMean: number } => {
    const prior: ProbMap = priorDistributions[age] || {};
    const entries = Object.entries(prior).map(([k, v]) => [Number(k), Number(v)] as [number, number]);
    const sumP = entries.reduce((acc, [, p]) => acc + (Number.isFinite(p) ? p : 0), 0);
    const rawCandidate = entries.reduce((acc, [k, p]) => acc + k * (Number.isFinite(p) ? p : 0), 0);
    const expMean = sumP > 0 ? rawCandidate / sumP : 0;
    // 原始群体均值优先取 nap_summary_table.tsx 的参考值，若缺失则回退到 CSV 估计
    const ref = getGroupMean(age);
    const rawMean = typeof ref === 'number' ? ref : rawCandidate;
    return { rawMean, expMean };
  };

  // 基于“原始均值 ± 2.5 次阈值”的动态保留范围
  // 规则：min = ceil(rawMean-2.5)，max = floor(rawMean+2.5)，并截断到 [0,6]
  const getRetainRange = (age: number): [number, number] => {
    const { rawMean } = getMeans(age);
    const minNap = Math.max(0, Math.ceil(rawMean - 2.5));
    const maxNap = Math.min(6, Math.floor(rawMean + 2.5));
    if (minNap > maxNap) {
      const mid = Math.max(0, Math.min(6, Math.floor(rawMean)));
      return [mid, mid];
    }
    return [minNap, maxNap];
  };

  // 返回用于显示的两个均值与区间：
  //  - expMean：归一化后的期望
  //  - rawMean：原始群体均值（阈值基于它计算）
  const getMeanAndWindow = (age: number): { expMean: number; rawMean: number; low: number; high: number } => {
    const { rawMean, expMean } = getMeans(age);
    return { expMean, rawMean, low: rawMean - 2.5, high: rawMean + 2.5 };
  };

  // 基于 CSV 先验的规范化分布、σ_full 与 HDI
  const getNormalizedPrior = (age: number): Record<number, number> => {
    const prior: ProbMap = priorDistributions[age] || {};
    const total = Object.values(prior).reduce((a: number, b: number) => a + (Number.isFinite(b) ? b : 0), 0);
    if (total <= 0) {
      const out0: Record<number, number> = {};
      for (const [k, v] of Object.entries(prior)) out0[Number(k)] = Number(v);
      return out0;
    }
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(prior)) out[Number(k)] = Number(v) / total;
    return out;
  };

  const getSigmaFromCSV = (age: number): { mean: number; sigma: number } => {
    const p = getNormalizedPrior(age);
    const support = [0,1,2,3,4,5,6];
    const mu = support.reduce((acc, k) => acc + k * (p[k] || 0), 0);
    const e2 = support.reduce((acc, k) => acc + k * k * (p[k] || 0), 0);
    const variance = Math.max(0, e2 - mu * mu);
    return { mean: mu, sigma: Math.sqrt(variance) };
  };

  const getHDIRange = (age: number, mass = 0.95): { low: number; high: number; covered: number } => {
    const p = getNormalizedPrior(age);
    const support = [0,1,2,3,4,5,6];
    const probs = support.map(k => p[k] || 0);
    const prefix = [0];
    for (let i = 0; i < probs.length; i++) prefix.push(prefix[i] + probs[i]);
    let best = { i: 0, j: 0, width: Infinity as number, covered: 0 };
    for (let i = 0; i < probs.length; i++) {
      for (let j = i; j < probs.length; j++) {
        const cov = prefix[j+1] - prefix[i];
        if (cov + 1e-9 >= mass) {
          const width = j - i;
          if (width < best.width || (width === best.width && cov > best.covered)) {
            best = { i, j, width, covered: cov };
          }
        }
      }
    }
    return { low: support[best.i], high: support[best.j], covered: best.covered };
  };

  const getRetainByMode = (age: number): { minNap: number; maxNap: number; note: string } => {
    if (thresholdMode === 'fixed') {
      const { rawMean } = getMeans(age);
      const low = rawMean - FIXED_T;
      const high = rawMean + FIXED_T;
      const minNap = Math.max(0, Math.ceil(low));
      const maxNap = Math.min(6, Math.floor(high));
      return { minNap, maxNap, note: `基于原始群体均值 ${rawMean.toFixed(2)} ± ${FIXED_T} 次 → [${low.toFixed(2)}, ${high.toFixed(2)}]` };
    }
    if (thresholdMode === 'sigma') {
      const { mean, sigma } = getSigmaFromCSV(age);
      const low = mean - kSigma * sigma;
      const high = mean + kSigma * sigma;
      const minNap = Math.max(0, Math.ceil(low));
      const maxNap = Math.min(6, Math.floor(high));
      return { minNap, maxNap, note: `基于期望均值 ${mean.toFixed(2)} ± ${kSigma}σ (σ=${sigma.toFixed(2)}) → [${low.toFixed(2)}, ${high.toFixed(2)}]` };
    }
    const h = getHDIRange(age, 0.95);
    return { minNap: h.low, maxNap: h.high, note: `基于 95% HDI 最短区间，覆盖率 ${(h.covered*100).toFixed(1)}%` };
  };

  // 从 CSV 文本解析群体先验分布
  const priorDistributions = useMemo<Record<number, ProbMap>>(() => {
    const text = (csvText || '').trim();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return {} as Record<number, ProbMap>;
    // 跳过表头
    const body = lines.slice(1);
    const map: Record<number, ProbMap> = {};
    for (const rawLine of body) {
      const line = rawLine.trim();
      if (!line) continue;
      const cells = line.split(',');
      // 兼容 BOM
      const ageStr = cells[0].replace(/^\ufeff/, '').trim();
      const age = parseInt(ageStr, 10);
      if (Number.isNaN(age)) continue;

      // 按列顺序读取 0~5 次小睡的百分比（可能为空）
      const probs: ProbMap = {};
      for (let k = 0; k <= 5; k++) {
        const raw = (cells[k + 1] || '').trim();
        if (!raw) continue;
        const num = parseFloat(raw.replace('%', ''));
        if (!Number.isFinite(num)) continue;
        const p = num / 100;
        if (p > 0) probs[String(k)] = p;
      }
      map[age] = probs;
    }
    return map;
  }, []);

  const [selectedAge, setSelectedAge] = useState(7);
  const ages = useMemo(() => Object.keys(priorDistributions).map(Number).sort((a,b) => a-b), [priorDistributions]);
  // 阈值模式：固定±2.5 / μ±kσ_full / 95%HDI
  const [thresholdMode, setThresholdMode] = useState<'fixed' | 'sigma' | 'hdi'>('hdi');
  const [kSigma, setKSigma] = useState(2);
  const FIXED_T = 2.5;

  // 计算EB概率（允许使用“有效样本量 n_eff”）
  const calculateEB = (prior: ProbMap, individualCounts: ProbMap, n_eff: number): ProbMap => {
    const groupWeight = S / (S + n_eff);
    const indWeight = n_eff / (S + n_eff);
    
    const results: ProbMap = {};
    const allCounts = new Set<string>([...Object.keys(prior), ...Object.keys(individualCounts)]);
    
    allCounts.forEach((count) => {
      const priorProb = Number(prior[count] || 0);
      const indProb = Number(individualCounts[count] || 0);
      results[count] = groupWeight * priorProb + indWeight * indProb;
    });
    
    return results;
  };

  // 预测最终次数
  const predictNapCount = (probabilities: ProbMap): number | null => {
    let maxCount: number | null = null;
    let maxProb = -1;
    for (const [countStr, prob] of Object.entries(probabilities)) {
      const p = Number(prob);
      if (Number.isFinite(p) && p > maxProb) {
        maxProb = p;
        maxCount = Number(countStr);
      }
    }
    return maxCount;
  };

  // 生成代表性场景（引入“Nd 达阈值 ⇒ 视作 ρ_d ≥ 1/3”的降权规则）
  const generateScenarios = (age: number): Scenario[] => {
    const { minNap, maxNap } = getRetainByMode(age);
    const validCounts: number[] = [];
    for (let i = minNap; i <= maxNap; i++) {
      validCounts.push(i);
    }
    
    const scenarios: Scenario[] = [];
    const prior: ProbMap = priorDistributions[age] || {};
    // 用“n=0”的预测作为基线阈值的 \hat{N}
    const hatN_base = predictNapCount(prior);
    
    // n=0: 纯先验
    scenarios.push({
      n: 0,
      description: '无个体数据（纯群体先验）',
      probabilities: prior,
      predicted: predictNapCount(prior) ?? 0
    });
    
    // n=3 和 n=7: 代表性案例
    [3, 7].forEach(n => {
      
      // 每个有效次数的纯情况
      validCounts.forEach(napCount => {
        // 短觉降权门槛：若当天实际次数 Nd >= \hat{N}+1，则视作 ρ_d ≥ 1/3
        // 这里用基线预测 hatN_base 近似今日 \hat{N}
        const reachThreshold = napCount >= (hatN_base + 1);
        const dayWeight = reachThreshold ? Math.max(W_MIN, 1 - BETA * (1 / 3)) : 1.0; // ρ_d 取下界 1/3
        const n_eff = n * dayWeight; // 代表“逐日加权”的有效样本量

        const groupWeight = S / (S + n_eff);
        const indWeight = n_eff / (S + n_eff);

        const indCounts: ProbMap = { [String(napCount)]: 1.0 };
        const probs: ProbMap = calculateEB(prior, indCounts, n_eff);
        const pred = predictNapCount(probs) ?? 0;
        
        scenarios.push({
          n,
          description: `${n}天全部${napCount}次`,
          probabilities: probs,
          predicted: pred,
          weights: `群体${(groupWeight*100).toFixed(0)}% | 个体${(indWeight*100).toFixed(0)}%` +
                   (reachThreshold ? ` ｜降权生效 w=${dayWeight.toFixed(2)} → 有效n=${n_eff.toFixed(2)}` : '')
        });
      });
    });
    
    return scenarios;
  };

  const scenarios = generateScenarios(selectedAge);
  const prior: ProbMap = priorDistributions[selectedAge] || {};
  const { minNap, maxNap, note } = getRetainByMode(selectedAge);
  const { expMean, rawMean, low, high } = getMeanAndWindow(selectedAge);

  // 导出各月龄“均值±2.5”与保留范围的 CSV
  const buildCSVForAllAges = () => {
    const header = ['月龄','平均小睡次数','下界(均值-2.5)','上界(均值+2.5)','保留范围'];
    const rows = [header.join('\t')];
    const sortedAges = [...ages].sort((a,b)=>a-b);
    for (const age of sortedAges) {
      const { rawMean } = getMeans(age);
      const low = rawMean - 2.5;
      const high = rawMean + 2.5;
      const minNap = Math.max(0, Math.ceil(low));
      const maxNap = Math.min(6, Math.floor(high));
      const range = `${minNap}-${maxNap}`;
      rows.push([
        age,
        rawMean.toFixed(2),
        low.toFixed(2),
        high.toFixed(2),
        range
      ].join('\t'));
    }
    return rows.join('\n');
  };

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          各月龄EB预测次数概率分布计算器
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          先验强度 S={S} | 滚动窗口 W=7天 | 基于实际群体数据
        </p>

        {/* 月龄与阈值模式选择 */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            选择月龄：
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {ages.map(age => (
              <button
                key={age}
                onClick={() => setSelectedAge(Number(age))}
                className={`px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
                  selectedAge === Number(age)
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {age}月
              </button>
            ))}
            <button
              onClick={() => downloadText('各月龄_均值±2.5_保留范围.tsv', buildCSVForAllAges())}
              className="ml-2 px-3 py-2 rounded-lg font-semibold transition-all text-sm bg-emerald-600 text-white hover:bg-emerald-700"
              title="导出表头: 月龄\t平均小睡次数\t下界(均值-2.5)\t上界(均值+2.5)\t保留范围"
            >
              导出保留范围 TSV
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">阈值模式：</span>
            <button onClick={() => setThresholdMode('fixed')} className={`px-3 py-1.5 rounded ${thresholdMode==='fixed'?'bg-gray-800 text-white':'bg-gray-200 text-gray-700'}`}>±2.5 固定</button>
            <button onClick={() => setThresholdMode('sigma')} className={`px-3 py-1.5 rounded ${thresholdMode==='sigma'?'bg-gray-800 text-white':'bg-gray-200 text-gray-700'}`}>μ±kσ</button>
            <button onClick={() => setThresholdMode('hdi')} className={`px-3 py-1.5 rounded ${thresholdMode==='hdi'?'bg-gray-800 text-white':'bg-gray-200 text-gray-700'}`}>95% HDI</button>
            {thresholdMode==='sigma' && (
              <label className="ml-2 text-sm text-gray-700">k=
                <input type="number" step="0.5" min={0.5} max={4} value={kSigma} onChange={e=>setKSigma(Number(e.target.value)||2)} className="ml-1 w-16 px-2 py-1 border rounded" />
              </label>
            )}
          </div>
        </div>

        {/* 当前月龄概况 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
            <h3 className="font-bold text-gray-800 mb-2">📊 群体先验分布</h3>
            <div className="space-y-1">
              {Object.entries(prior)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([count, prob]) => (
                  <div key={count} className="text-sm flex justify-between">
                    <span className="font-semibold">{count}次小睡:</span>
                    <span className="text-purple-600 font-bold">{(prob*100).toFixed(0)}%</span>
                  </div>
                ))}
              <div className="text-sm flex justify-between pt-1 mt-1 border-t border-purple-200">
                <span className="font-semibold">均值（期望）:</span>
                <span className="text-purple-700 font-bold">{expMean.toFixed(2)} 次</span>
              </div>
              <div className="text-xs flex justify-between text-purple-700/80">
                <span className="font-medium">原始群体均值（参考表）:</span>
                <span className="font-semibold">{rawMean.toFixed(2)} 次</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <h3 className="font-bold text-gray-800 mb-2">✅ 数据保留范围</h3>
            <div className="text-3xl font-bold text-green-600 mb-2">
              {minNap} - {maxNap} 次
            </div>
            <p className="text-xs text-gray-600">{note}</p>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <h3 className="font-bold text-gray-800 mb-2">🎯 n=0时预测</h3>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {predictNapCount(prior)} 次
            </div>
            <p className="text-xs text-gray-600">
              无个体数据时，完全依赖群体先验
            </p>
          </div>
        </div>

        {/* 场景分析 */}
        <div className="space-y-4">
          <h3 className="font-bold text-gray-800 text-lg">📋 代表性场景的预测结果：</h3>
          
          {[0, 3, 7].map(n => {
            const nScenarios = scenarios.filter(s => s.n === n);
            if (nScenarios.length === 0) return null;

            return (
              <div key={n} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-100 to-blue-100 px-4 py-3">
                  <span className="font-bold text-gray-800 text-lg">n = {n} 天有效数据</span>
                  {n > 0 && nScenarios[0].weights && (
                    <span className="text-sm text-gray-600 ml-3">
                      ({nScenarios[0].weights})
                    </span>
                  )}
                </div>
                
                <div className="divide-y divide-gray-200">
                  {nScenarios.map((scenario, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-semibold text-gray-700 text-base">
                          {scenario.description}
                        </span>
                        <div className="text-right ml-4">
                          <div className="text-xs text-gray-500 mb-1">预测结果</div>
                          <div className="text-2xl font-bold text-green-600">
                            {scenario.predicted} 次
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(scenario.probabilities)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([count, prob]) => {
                            const isPredicted = Number(count) === scenario.predicted;
                            return (
                              <div
                                key={count}
                                className={`px-3 py-2 rounded-lg ${
                                  isPredicted
                                    ? 'bg-green-500 text-white font-bold shadow-md'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                <span className="text-sm">{count}次: </span>
                                <span className="font-bold">{(prob*100).toFixed(1)}%</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 说明文档 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <h3 className="font-bold text-gray-800 mb-2">📐 计算公式</h3>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="bg-white p-2 rounded font-mono text-xs">
                θ̂ₖ = (S/(S+n)) × p_k + (n/(S+n)) × (c_k/n)
              </div>
              <p>• <strong>S</strong>: 先验强度 = 7</p>
              <p>• <strong>n</strong>: 有效个体数据天数</p>
              <p>• <strong>p_k</strong>: 群体中k次小睡的概率</p>
              <p>• <strong>c_k</strong>: 个体数据中k次的出现次数</p>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
            <h3 className="font-bold text-gray-800 mb-2">💡 关键洞察</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• <strong>n=0</strong>: 100%依赖群体先验</li>
              <li>• <strong>n=3</strong>: 群体70% vs 个体30%</li>
              <li>• <strong>n=7</strong>: 群体50% vs 个体50%（平衡点）</li>
              <li>• 个体数据越多，预测越贴近个体特征</li>
              <li>• 群体先验确保在数据不足时仍有合理预测</li>
            </ul>
          </div>
        </div>

        {/* 数据来源 */}
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
          <strong>数据来源：</strong> 群体概率分布来自CSV先验（3-35月龄逐月概率表），原始群体均值参考汇总表；阈值模式支持：固定±2.5、μ±kσ（σ由CSV先验计算）、95% HDI。
        </div>
      </div>
    </div>
  );
};

export default EBNapProbabilityCalculator;
