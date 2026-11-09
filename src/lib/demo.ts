import type { AgentEvent, Element, Finding, Job, Market, MarketResult, Report } from './types';
import { ruleById } from './rules';

export const DEMO_IMAGE = 'assets/demo-product.webp';
export const DEMO_FIXED = 'assets/demo-product-fixed.webp';

export const DEMO_ELEMENTS: Element[] = [
  { id: 'e1', label: '数字「4」', category: 'text', bbox: [520, 30, 640, 190], text: 'LUCKY 4 SET' },
  { id: 'e2', label: '四只茶杯成套', category: 'product', bbox: [210, 510, 770, 750], count: 4 },
  { id: 'e3', label: '白色菊花', category: 'flower', bbox: [15, 210, 295, 450], count: 7, attributes: { color: 'white' } },
  { id: 'e4', label: '手势含义不同', category: 'gesture', bbox: [750, 620, 990, 970], attributes: { gesture: 'OK sign', hand: 'right' } },
  { id: 'e5', label: '封签小字', category: 'text', bbox: [565, 790, 660, 870], text: '(illegible)' },
];

let n = 0;
function f(market: Market, elementId: string, ruleId: string, level: Finding['level'], title: string, where: string, reason: string, suggestion: string, confidence: number, keepProb: number): Finding {
  const r = ruleById(ruleId)!;
  return { id: `d${n++}`, market, elementId, ruleId, level, title, where, reason, suggestion, confidence: keepProb, sources: r.sources, icon: r.icon,
    review: false, decision: { keepProb, by: 'llm' } };
}
const SEAL = (m: Market, rule: string, lv: Finding['level'], title: string, where: string, reason: string, sug: string) =>
  f(m, 'e5', rule, lv, title, where, reason, sug, 0.7, 0.72);

export function demoResults(): MarketResult[] {
  n = 0;
  const R: MarketResult[] = [
    { market: 'JP', score: 46, launch: { choice: 'fix_then_go', prob: 0.82, by: 'llm' }, findings: [
      f('JP', 'e1', 'jp-num-4', 'high', '标题「LUCKY 4 SET」含数字 4', '位于主标题', '日语中「4」可读作「し(shi)」，与「死」同音，日本医院、公寓等常回避 4 号；作为礼品卖点的“幸运 4 件套”会产生明显反效果。', '改为「HARMONY 5 SET」或去掉数字，用「Premium Tea Set」；套装数量调整为 5 件。', 0.93, 0.93),
      f('JP', 'e2', 'jp-num-4', 'high', '四只茶杯成套作为礼品', '位于礼盒内', '与 ① 同源：以 4 为单位的成套礼品在日本属常见避讳，详情图直接展示 4 只杯会强化联想。', '改为 5 只杯（或 2 只对杯），同步修改 SKU 与文案。', 0.81, 0.81),
      f('JP', 'e3', 'jp-flower-chrys', 'mid', '白色菊花作为装饰', '位于左侧', '白菊在日本是葬礼与扫墓的传统用花，出现在喜庆礼品图中容易引发不吉联想。', '换成粉色樱花枝或彩色洋桔梗。', 0.77, 0.77),
      f('JP', 'e4', 'jp-gesture-ok', 'low', 'OK 手势在日本可表示「钱」', '在巴西为高风险', '拇指与食指成圈的手势在日本常表示“钱”，在礼品语境中可能被误读。', '换成张开手掌托举商品的手势。', 0.66, 0.66),
      SEAL('JP', 'jp-label-lang', 'low', '封签文字过小无法辨识', '建议补充日文品名', '封签上的外文小字无法辨识，日本零售环节通常需要日文标签。', '详情图补充日文品名 / 材质说明。'),
    ] },
    { market: 'BR', score: 78, launch: { choice: 'fix_then_go', prob: 0.77, by: 'llm' }, findings: [
      f('BR', 'e4', 'br-gesture-ok', 'high', 'OK 手势在巴西被视为冒犯', '位于右下角', '拇指与食指成圈的手势在巴西被视为粗俗侮辱，出现在商品主图中会直接冒犯消费者。', '换成张开手掌托举商品的手势。', 0.95, 0.95),
      SEAL('BR', 'br-label-pt', 'low', '封签小字建议补充葡语', '位于礼盒正面', '巴西要求进口商品信息提供葡萄牙语，图中封签小字无法承担该功能。', '详情图补充葡语品名与关键参数。'),
    ] },
    { market: 'SA', score: 80, launch: { choice: 'fix_then_go', prob: 0.71, by: 'llm' }, passes: ['未发现猪肉 / 酒精相关元素', '未发现宗教符号'], findings: [
      f('SA', 'e4', 'sa-gesture-ok', 'mid', 'OK 手势在部分中东地区含冒犯意味', '位于右下角', '在部分中东国家，该手势可表示“邪眼”诅咒或威胁，存在被误读风险。', '换成张开手掌托举商品的手势。', 0.74, 0.74),
      SEAL('SA', 'sa-label-ar', 'mid', '封签缺少阿拉伯语信息', '位于礼盒正面', '沙特要求警示与安全信息使用阿拉伯语，图中仅有无法辨识的外文小字。', '补充阿拉伯语品名与警示信息。'),
    ] },
    { market: 'US', score: 98, launch: { choice: 'go', prob: 0.9, by: 'llm' }, findings: [
      SEAL('US', 'us-origin-marking', 'low', '封签小字建议补充原产国', '位于礼盒正面', '美国要求进口商品以英文显著标注原产国，图中小字无法辨识。', '在包装显著位置补充英文原产国标注。'),
    ] },
    { market: 'DE', score: 98, launch: { choice: 'go', prob: 0.88, by: 'llm' }, findings: [
      f('DE', 'e4', 'de-gesture-ok', 'low', 'OK 手势存在小概率误读', '位于右下角', '该手势在绝大多数语境无害，但在极少数网络语境中被曲解，欧洲广告审核偶有质疑。', '可保留；如追求零争议可换成张开手掌托举。', 0.62, 0.62),
    ] },
    { market: 'IN', score: 98, launch: { choice: 'go', prob: 0.89, by: 'llm' }, findings: [
      SEAL('IN', 'in-label-lm', 'low', '封签小字建议补充进口商与 MRP', '位于礼盒正面', '印度要求预包装商品标注进口商、净含量与含税最高零售价（MRP）。', '详情图与包装补充进口商信息和 MRP 标签。'),
    ] },
  ];
  return R;
}

export function demoEvents(markets: Market[]): AgentEvent[] {
  const ev: AgentEvent[] = []; let t = 0;
  const add = (dt: number, e: Omit<AgentEvent, 't'>) => { t += dt; ev.push({ ...e, t }); };
  add(200, { agent: 'chief', status: 'start', msg: `任务拆解为 ${markets.length} 市场 × 7 项` });
  add(500, { agent: 'vision', status: 'start', msg: '识别元素、OCR、定位坐标' });
  add(2600, { agent: 'vision', status: 'done', msg: '识别 9 个元素 · OCR 2 段文字', data: DEMO_ELEMENTS });
  for (const m of markets) { add(250, { agent: 'culture', market: m, status: 'start', msg: '' }); add(150, { agent: 'compliance', market: m, status: 'start', msg: '' }); }
  const res = demoResults().filter(r => markets.includes(r.market));
  const hits = res.flatMap(r => r.findings.map(fd => ({ r, fd }))).sort((a, b) => ['high', 'mid', 'low'].indexOf(a.fd.level) - ['high', 'mid', 'low'].indexOf(b.fd.level));
  for (const { r, fd } of hits) add(650, { agent: ruleById(fd.ruleId)!.kind, market: r.market, status: 'hit', msg: `命中 rule ${fd.ruleId}`, data: { title: fd.title, level: fd.level, elementId: fd.elementId, icon: fd.icon } });
  for (const r of res) for (const p of r.passes || []) add(300, { agent: 'compliance', market: r.market, status: 'progress', msg: p, data: { pass: true } });
  for (const m of markets) { add(300, { agent: 'culture', market: m, status: 'done', msg: '' }); add(200, { agent: 'compliance', market: m, status: 'done', msg: '' }); }
  const total = res.reduce((a, r) => a + r.findings.length, 0);
  add(400, { agent: 'decision', status: 'start', msg: `决策官仲裁 ${total} 条结论` });
  add(1300, { agent: 'decision', status: 'done', msg: `决策官仲裁完成：保留 ${total} · 待确认 0 · 剔除 0` });
  add(500, { agent: 'chief', status: 'done', msg: '汇总、去重、打分完成', pct: 100 });
  return ev;
}

export function demoReport(job: Job): Report {
  const all = demoResults();
  return { jobId: job.id, elements: DEMO_ELEMENTS, results: all, events: demoEvents(job.markets), elapsedMs: 12400,
    fixedImage: DEMO_FIXED, fixedScores: { JP: 92, BR: 96, SA: 96, US: 98, DE: 98, IN: 98 },
    models: { vision: 'qwen3-vl-plus', review: 'qwen3.7-plus', image: 'wan2.7-image', decision: 'qwen3.7-plus' } };
}

export function demoJob(markets: Market[] = ['JP', 'BR', 'SA']): Job {
  return { id: 'demo-tea', image: { dataUrl: DEMO_IMAGE, w: 864, h: 1152, name: 'tea-gift-set.jpg', size: 1258291 }, markets,
    categories: ['color', 'gesture', 'number', 'religion', 'text', 'food', 'compliance'], category: '礼品 · 茶具套装', channel: 'Amazon / Shopee 详情页',
    copyText: 'Lucky 4 Set – Premium porcelain tea gift box, perfect for weddings & housewarming.', mode: 'demo', demoId: 'tea', createdAt: new Date().toISOString() };
}
