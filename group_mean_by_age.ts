// 原始群体均值（参考 nap_summary_table.tsx 的 napData）
// 仅包含表中提供的月龄；缺失的月龄请在使用方做回退
export const groupMeanByAge: Record<number, number> = {
  1: 4.7,
  2: 4.3,
  3: 3.95,
  4: 3.55,
  5: 3.2,
  6: 3.2,
  7: 2.9,
  8: 2.55,
  9: 2.25,
  10: 2.15,
  11: 1.95,
  12: 1.85,
  13: 1.65,
  14: 1.5,
  15: 1.4,
  16: 1.25,
  17: 1.15,
  18: 1.15,
  19: 1.1,
  20: 1.1,
  21: 1.1,
  22: 1.05,
  23: 1.0,
  24: 0.95,
};

export const getGroupMean = (age: number): number | undefined => groupMeanByAge[age];

