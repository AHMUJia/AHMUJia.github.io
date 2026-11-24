// 跑法：node tools/test-pub-order.js
// 校验 assets/js/render.js 里的同年度排序权重（IF × 署名系数）。
// 署名系数：本人是「一作里的第一个」或「通讯里的最后一个」→ 1.0，其余代表性署名 → 0.6。
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// render.js 是浏览器 IIFE，加载时只往 window 上挂函数、不碰 DOM，所以给两个桩就能在 Node 里跑
global.window = {};
global.document = { documentElement: { lang: 'zh' } };
new Function(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'render.js'), 'utf8'))();

const { roleCoef, score, compare } = global.window.__pubOrder;
let n = 0;
function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, msg + '（得到 ' + actual + '，应为 ' + expected + '）');
  n++;
}

// --- 署名系数 ---
eq(roleCoef({ authors: 'Jialin Meng, Chaozhao Liang*', role: 'first' }), 1, '第一作者');
eq(roleCoef({ authors: 'Jialin Meng#, Qintao Ge#, X*', role: 'co-first' }), 1, '共同一作里的第一个');
eq(roleCoef({ authors: 'Qintao Ge#, Jialin Meng#, X*', role: 'co-first' }), 0.6, '共同一作里的第二个');
eq(roleCoef({ authors: 'A, B, Chaozhao Liang*, Jialin Meng*', role: 'co-corresponding' }), 1, '通讯里的最后一个');
eq(roleCoef({ authors: 'A, B, Jialin Meng*, Yiding Chen*', role: 'co-corresponding' }), 0.6, '通讯里的非最后一个');
eq(roleCoef({ authors: 'A, Yu Guan*, Jialin Meng*, Chaozhao Liang*', role: 'co-corresponding' }), 0.6, '三通讯里的中间一个');
eq(roleCoef({ authors: 'A, B, Meng Jialin*', role: 'corresponding' }), 1, '姓名反写也认');
// 作者串缺失 → 退回 role
eq(roleCoef({ authors: '', role: 'corresponding' }), 1, '无作者串时 corresponding 记满分');
eq(roleCoef({ authors: '', role: 'co-first' }), 0.6, '无作者串时 co-first 记 0.6');
// 本人不在串里（不该发生，但别崩）
eq(roleCoef({ authors: 'A, B, C', role: 'co-corresponding' }), 0.6, '本人不在作者串里时退回 role');

// --- 总分 ---
eq(score({ if: 14.9, authors: 'Jialin Meng#, A#', role: 'co-first' }), 14.9, 'IF×1.0');
eq(score({ if: 11.7, authors: 'A#, Jialin Meng#', role: 'co-first' }), 11.7 * 0.6, 'IF×0.6');
// 中文期刊/新刊没有 IF → 按 5 计，不能算 0 分沉到最后
eq(score({ if: '', authors: 'Jialin Meng', role: 'first' }), 5, 'IF 为空按 5 计（第一作者）');
eq(score({ if: null, authors: 'A#, Jialin Meng#', role: 'co-first' }), 5 * 0.6, 'IF 为 null 按 5 计 ×0.6');
eq(score({ if: 4.9, authors: 'Jialin Meng', role: 'first' }), 4.9, '有 IF 时不受缺省值影响');

// --- 整体排序：先年份降序，同年按总分降序 ---
const pubs = [
  { id: 'a', year: 2025, if: 8.0, authors: 'A, Jialin Meng*, B*', role: 'co-corresponding' },   // 4.8
  { id: 'b', year: 2026, if: 3.8, authors: 'A, B, Jialin Meng*', role: 'co-corresponding' },    // 3.8
  { id: 'c', year: 2025, if: 14.9, authors: 'A#, Jialin Meng#, B', role: 'co-first' },          // 8.94
  { id: 'd', year: 2025, if: 11.7, authors: 'A, B, Jialin Meng*', role: 'co-corresponding' },   // 11.7
];
const got = pubs.slice().sort(compare).map(function (p) { return p.id; }).join('');
eq(got, 'bdca', '排序结果');

console.log('test-pub-order: ' + n + ' 项断言全部通过');
