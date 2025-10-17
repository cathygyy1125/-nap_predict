import React from 'react';

const NapSummaryTable = () => {
  // 从图表读取的精确数据
  const napData = [
    { age: 1, mean: 4.7, sd: 1.2 },
    { age: 2, mean: 4.3, sd: 1.0 },
    { age: 3, mean: 3.95, sd: 0.9 },
    { age: 4, mean: 3.55, sd: 0.85 },
    { age: 5, mean: 3.2, sd: 0.75 },
    { age: 6, mean: 3.2, sd: 0.75 },
    { age: 7, mean: 2.9, sd: 0.7 },
    { age: 8, mean: 2.55, sd: 0.65 },
    { age: 9, mean: 2.25, sd: 0.6 },
    { age: 10, mean: 2.15, sd: 0.55 },
    { age: 11, mean: 1.95, sd: 0.5 },
    { age: 12, mean: 1.85, sd: 0.5 },
    { age: 13, mean: 1.65, sd: 0.45 },
    { age: 14, mean: 1.5, sd: 0.4 },
    { age: 15, mean: 1.4, sd: 0.4 },
    { age: 16, mean: 1.25, sd: 0.35 },
    { age: 17, mean: 1.15, sd: 0.35 },
    { age: 18, mean: 1.15, sd: 0.35 },
    { age: 19, mean: 1.1, sd: 0.3 },
    { age: 20, mean: 1.1, sd: 0.3 },
    { age: 21, mean: 1.1, sd: 0.3 },
    { age: 22, mean: 1.05, sd: 0.3 },
    { age: 23, mean: 1.0, sd: 0.25 },
    { age: 24, mean: 0.95, sd: 0.25 },
  ];

  const threshold = 2.5;

  const calculateRange = (mean) => {
    const lowerBound = mean - threshold;
    const upperBound = mean + threshold;
    
    // 保留范围：向上取整下界，向下取整上界
    const retainMin = Math.max(0, Math.ceil(lowerBound));
    const retainMax = Math.floor(upperBound);
    
    return {
      lowerBound: lowerBound.toFixed(2),
      upperBound: upperBound.toFixed(2),
      retainMin,
      retainMax,
      retainRange: `${retainMin} - ${retainMax}次`
    };
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white rounded-lg shadow-xl p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-3 text-center">
          各月龄小睡次数统计与保留范围汇总表
        </h1>
        <p className="text-center text-sm text-gray-600 mb-6">
          阈值：<span className="font-bold text-blue-600">±2.5次</span> | 
          数据来源：Figure 4.3
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold">
                  月龄<br/>(months)
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold">
                  均值<br/>(μ)
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold">
                  标准差<br/>(σ)
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold">
                  阈值<br/>(threshold)
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold">
                  下界<br/>(μ - 2.5)
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold">
                  上界<br/>(μ + 2.5)
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold bg-green-600">
                  保留范围<br/>(有效数据)
                </th>
              </tr>
            </thead>
            <tbody>
              {napData.map((item, index) => {
                const range = calculateRange(item.mean);
                const isHighlight = item.age === 7;
                
                return (
                  <tr 
                    key={item.age} 
                    className={
                      isHighlight 
                        ? 'bg-yellow-100 border-2 border-yellow-400' 
                        : index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                    }
                  >
                    <td className="border border-gray-300 px-4 py-2.5 text-center font-bold text-gray-700">
                      {item.age}
                    </td>
                    <td className="border border-gray-300 px-4 py-2.5 text-center font-bold text-blue-600">
                      {item.mean.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-600">
                      {item.sd.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-700">
                      ±2.5
                    </td>
                    <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-600">
                      {range.lowerBound}
                    </td>
                    <td className="border border-gray-300 px-4 py-2.5 text-center text-gray-600">
                      {range.upperBound}
                    </td>
                    <td className="border border-gray-300 px-4 py-2.5 text-center bg-green-50">
                      <span className="font-bold text-green-700">
                        {range.retainRange}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
              📊 计算公式
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>• 下界 = 均值 - 2.5</p>
              <p>• 上界 = 均值 + 2.5</p>
              <p>• 保留范围 = [⌈下界⌉, ⌊上界⌋]</p>
              <p className="text-xs text-gray-500 mt-2">
                ⌈⌉向上取整，⌊⌋向下取整
              </p>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
              🎯 7月龄示例
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>• 均值：2.90次</p>
              <p>• 下界：2.90 - 2.5 = 0.40</p>
              <p>• 上界：2.90 + 2.5 = 5.40</p>
              <p className="font-bold text-yellow-700 mt-2">
                → 保留：1-5次
              </p>
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
              ⚠️ 剔除规则
            </h3>
            <div className="text-sm text-gray-700 space-y-1">
              <p>• 低于保留下界 → 剔除</p>
              <p>• 高于保留上界 → 剔除</p>
              <p className="text-xs text-gray-600 mt-2">
                例：7月龄剔除 ≤0次 和 ≥6次
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-3">📈 关键趋势观察：</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
            <div className="bg-white p-3 rounded shadow-sm">
              <strong className="text-purple-600">新生儿期（1-3月）：</strong>
              <p>保留范围较宽（3-7次），个体差异大</p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <strong className="text-blue-600">快速下降期（4-9月）：</strong>
              <p>从3-6次逐渐降至0-5次，过渡明显</p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <strong className="text-green-600">稳定期（10-18月）：</strong>
              <p>保留范围稳定在0-4次左右</p>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <strong className="text-orange-600">戒睡期（19-24月）：</strong>
              <p>逐渐过渡到0-3次，部分宝宝戒午睡</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600 text-center">
          注：黄色高亮行为7月龄数据 | 标准差(σ)从图表误差线估算 | 保留范围取整数次数
        </div>
      </div>
    </div>
  );
};

export default NapSummaryTable;