import type { AgentEvent, Decision, Element, Finding, Job, LaunchDecision, Level, Market, MarketResult, Report, Rule } from './types';
import { chatJSON, wanEdit, fetchAsDataUrl, ApiError } from './api';
import type { Settings } from './settings';
import { RULES, MK_SHORT, CATEGORIES, ruleById } from './rules';

const MK_EN: Record<Market, string> = { JP: 'Japan', BR: 'Brazil', SA: 'Saudi Arabia', US: 'United States', DE: 'Germany', IN: 'India' };
const LV: Level[] = ['high', 'mid', 'low'];
const PENALTY: Record<Level, number> = { high: 20, mid: 10, low: 2 };
export const scoreOf = (fs: Finding[]) => Math.max(0, 100 - fs.filter(f => !f.review).reduce((a, f) => a + PENALTY[f.level], 0));

type Emit = (e: Omit<AgentEvent, 't'>) => void;

const VISION_SYS = `你是电商商品图的视觉审查员。只描述你在图中真实看到的内容，不做文化判断。
输出严格 JSON：{"elements":[{"id":"e1","label":"中文名称(≤10字)","category":"flower|color|gesture|number|text|symbol|food|drink|person|product|other","bbox_2d":[x1,y1,x2,y2],"text":"图中文字原文(若有)","count":数量,"attributes":{}}]}
规则：坐标为 0-1000 相对坐标（左上角为原点）。文字逐字 OCR（每段文字单独一个元素，category=text）；同类可数物体合并为一个框并给出 count；手部单独一个元素，category=gesture，attributes.gesture 写标准英文名（如 OK sign / thumbs up / open palm），attributes.hand 写 left/right；食物饮料写明种类（如 beef jerky / beer）；花卉写明颜色与品种。最多 14 个元素。`;

function reviewSys(m: Market, kind: 'culture' | 'compliance') {
  return `你是${MK_SHORT[m]}（${MK_EN[m]}）市场的${kind === 'culture' ? '本地文化与消费者洞察专家' : '进口与广告合规专家'}。
你会拿到商品图、图中元素清单（含 id、坐标）和一份候选规则（含来源）。逐条判断每条规则是否真的被图中某个元素触发：
- 只能引用候选规则里的 rule_id，不得编造规则；规则不成立就不要输出。
- 一个元素可触发多条规则；同一规则只对最相关的元素输出一次（数字类规则若同时出现在标题文字和成套数量上，可分别输出）。
- element_id 必须是清单里的 id；若问题来自卖点文案，element_id 填 "copy"。
输出严格 JSON：{"findings":[{"element_id":"e1","rule_id":"...","level":"high|mid|low","title":"具体指向图中内容的标题(≤22字)","where":"位置描述(≤10字，如 位于主标题)","reason":"结合本图的解释(≤80字，中文)","suggestions":["可执行的替换方案1","方案2"],"edit_prompt":"给图像编辑模型的英文指令，只描述框内如何修改，保持其余不变","confidence":0.0}],"clear":["已核查且未发现问题的检查项(≤16字)，最多2条"]}`;
}

function allowedRules(m: Market, kind: 'culture' | 'compliance', cats: string[]): Rule[] {
  const set = new Set<string>();
  CATEGORIES.filter(c => cats.includes(c.id)).forEach(c => c.match.forEach(x => set.add(x)));
  return RULES.filter(r => r.market === m && r.kind === kind && (set.has(r.category) || (r.kind === 'compliance' && cats.includes('compliance'))));
}

async function vision(s: Settings, img: string, emit: Emit): Promise<Element[]> {
  emit({ agent: 'vision', status: 'start', msg: '识别元素、OCR、定位坐标' });
  const { json } = await chatJSON(s, { role: 'vision', system: VISION_SYS, user: [{ type: 'image_url', image_url: { url: img } }, { type: 'text', text: '列出图中所有元素。' }] });
  const els: Element[] = (json?.elements || []).slice(0, 14).map((e: any, i: number) => {
    const b = Array.isArray(e.bbox_2d) && e.bbox_2d.length === 4 ? e.bbox_2d.map((v: number) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0)))) : null;
    return { id: String(e.id || `e${i + 1}`), label: String(e.label || '元素').slice(0, 16), category: String(e.category || 'other'), bbox: b && b[2] > b[0] && b[3] > b[1] ? b : null,
      text: e.text ? String(e.text) : undefined, count: Number(e.count) || undefined, attributes: e.attributes && typeof e.attributes === 'object' ? e.attributes : undefined } as Element;
  });
  if (!els.length) throw new ApiError('视觉模型没有识别出任何元素');
  emit({ agent: 'vision', status: 'done', msg: `识别 ${els.length} 个元素 · OCR ${els.filter(e => e.category === 'text').length} 段文字`, data: els });
  return els;
}

async function review(s: Settings, job: Job, img: string, els: Element[], m: Market, kind: 'culture' | 'compliance', emit: Emit) {
  const rules = allowedRules(m, kind, job.categories);
  if (!rules.length) return { findings: [] as Finding[], clear: [] as string[] };
  emit({ agent: kind, market: m, status: 'start', msg: `${MK_SHORT[m]} · 比对 ${rules.length} 条规则` });
  const user = [
    { type: 'image_url' as const, image_url: { url: img } },
    { type: 'text' as const, text: JSON.stringify({ 商品类目: job.category, 投放渠道: job.channel, 卖点文案: job.copyText || '（无）',
      元素清单: els.map(e => ({ id: e.id, label: e.label, category: e.category, text: e.text, count: e.count, attributes: e.attributes })),
      候选规则: rules.map(r => ({ rule_id: r.id, category: r.category, 默认等级: r.level, title: r.title, reason: r.reason, 建议: r.suggestion })) }) },
  ];
  const { json } = await chatJSON(s, { role: 'review', system: reviewSys(m, kind), user });
  const out: Finding[] = [];
  for (const f of json?.findings || []) {
    const r = ruleById(String(f.rule_id));
    if (!r || !rules.includes(r)) continue;
    const el = els.find(e => e.id === String(f.element_id));
    if (!el && f.element_id !== 'copy') continue;
    const lvl: Level = clampLv(LV.includes(f.level) ? f.level : r.level, r.level);
    const sugg = (Array.isArray(f.suggestions) ? f.suggestions : [r.suggestion]).map(String).filter(Boolean).slice(0, 3);
    out.push({ id: `${m}-${out.length}-${kind[0]}`, market: m, elementId: el ? el.id : 'copy', ruleId: r.id, level: lvl,
      title: String(f.title || r.title).slice(0, 30), where: String(f.where || (el ? '位于图中' : '位于卖点文案')).slice(0, 14),
      reason: String(f.reason || r.reason).slice(0, 140), suggestion: sugg[0] || r.suggestion, suggestions: sugg,
      editPrompt: f.edit_prompt ? String(f.edit_prompt) : undefined, confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.7)),
      sources: r.sources, icon: r.icon });
    emit({ agent: kind, market: m, status: 'hit', msg: `命中 rule ${r.id}`, data: { title: out[out.length - 1].title, level: lvl, elementId: out[out.length - 1].elementId, icon: r.icon } });
  }
  emit({ agent: kind, market: m, status: 'done', msg: `${MK_SHORT[m]} · ${out.length} 处发现` });
  const clear = (json?.clear || []).map(String).slice(0, 2);
  clear.forEach((c: string) => emit({ agent: kind, market: m, status: 'progress', msg: c, data: { pass: true } }));
  return { findings: out, clear };
}

const DECIDE_SYS = `你是跨境电商的上架决策官。文化顾问与合规守卫已经针对某个目标市场给出了一组风险结论，你要逐条仲裁，并给出这个市场的上架决策。
对每条结论（按 id）输出：
- keep：0~1 的概率，表示「这条结论确实成立、卖家应在上架前处理」。要校准：证据清楚接近 0.9，牵强或只在极少数语境成立给 0.2~0.5。
- level：high（可能导致下架、违法或强烈冒犯）/ mid（可能引起不适或误解）/ low（影响轻微，仅需提示）。规则的「基准等级」是依据来源定的，除非本图证据明显更弱或更强，否则沿用基准等级。
- option：从该条的 suggestions 中选出最能消除风险且改动成本最低的一个，填下标（从 0 开始）。
再给出市场整体：launch.choice 为 go（没有需要处理的问题，可直接上架）/ fix_then_go（问题出在图片道具、文字或文案上，修改后即可上架）/ no_go（问题出在商品本身，例如商品就是当地禁售或强烈禁忌的品类，改图改文案都无法解决），launch.confidence 为 0~1。
只输出严格 JSON：{"decisions":[{"id":"...","keep":0.0,"level":"high|mid|low","option":0}],"launch":{"choice":"go|fix_then_go|no_go","confidence":0.0}}`;

/** 决策官：每个市场一次调用，逐条给保留概率 / 定级 / 方案，并给出上架决策 */
async function decideMarket(s: Settings, job: Job, els: Element[], mr: MarketResult): Promise<{ ds: Record<string, Decision>; launch?: LaunchDecision }> {
  const items = mr.findings.map(f => {
    const el = els.find(e => e.id === f.elementId); const r = ruleById(f.ruleId)!;
    return { id: f.id, 图中元素: el ? { 名称: el.label, 文字: el.text, 数量: el.count, 属性: el.attributes } : { 名称: '卖点文案', 文字: job.copyText },
      规则: { 标题: r.title, 基准等级: r.level, 来源: r.sources.map(x => x.title).join('；') }, 复核: { 标题: f.title, 等级: f.level, 理由: f.reason, 置信度: f.confidence }, suggestions: f.suggestions || [f.suggestion] };
  });
  const user = JSON.stringify({ 目标市场: `${MK_SHORT[mr.market]}（${MK_EN[mr.market]}）`, 商品: { 类目: job.category, 渠道: job.channel, 文案: job.copyText || '' }, 结论: items }, null, 1);
  const { json } = await chatJSON(s, { role: 'review', system: DECIDE_SYS, user, temperature: 0 });
  const ds: Record<string, Decision> = {};
  for (const d of json?.decisions || []) {
    const keep = Number(d.keep); if (!isFinite(keep)) continue;
    ds[String(d.id)] = { keepProb: Math.max(0, Math.min(1, keep)), level: LV.includes(d.level) ? d.level : undefined, optionIdx: Number.isInteger(d.option) ? d.option : undefined, by: 'llm' };
  }
  const c = json?.launch?.choice;
  const launch = ['go', 'fix_then_go', 'no_go'].includes(c) ? { choice: c, prob: Math.max(0, Math.min(1, Number(json.launch.confidence) || 0)), by: 'llm' as const } : undefined;
  return { ds, launch };
}
/** 上架决策与体检结果保持一致：没有待处理问题就是 go；有中高风险不能是 go */
function consistentLaunch(l: LaunchDecision | undefined, r: MarketResult): LaunchDecision {
  const base = l || inferLaunch(r);
  const open = r.findings.filter(f => !f.review);
  if (!open.some(f => f.level !== 'low')) return { ...base, choice: 'go' };
  if (base.choice === 'go') return { ...base, choice: 'fix_then_go' };
  return base;
}
/** 决策官没给出上架决策时，按体检结果推断 */
export function inferLaunch(mr: MarketResult): LaunchDecision {
  const hasNoGo = mr.findings.some(f => !f.review && f.level === 'high' && /import|halal|beef|86a/.test(f.ruleId));
  const c = hasNoGo ? 'no_go' : mr.score >= 90 ? 'go' : 'fix_then_go';
  return { choice: c, prob: 0, by: 'llm' };
}

/** 模型与决策官只能在规则基准等级上下浮动一级，防止「缺日文标签」被抬成高风险 */
function clampLv(l: Level, base: Level): Level { const i = LV.indexOf(l), b = LV.indexOf(base); return LV[Math.max(b - 1, Math.min(b + 1, i))]; }

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export async function analyze(s: Settings, job: Job, img: string, emit: Emit, warnings: string[] = []): Promise<{ elements: Element[]; results: MarketResult[] }> {
  emit({ agent: 'chief', status: 'start', msg: `任务拆解为 ${job.markets.length} 市场 × ${job.categories.length} 项` });
  const els = await vision(s, img, emit);
  emit({ agent: 'chief', status: 'progress', msg: '视觉结果已分发给文化顾问与合规守卫', pct: 30 });
  const per = await Promise.all(job.markets.map(async m => {
    const [c, p] = await Promise.all([review(s, job, img, els, m, 'culture', emit), review(s, job, img, els, m, 'compliance', emit)]);
    // 去重：同一元素同一规则只保留一次
    const seen = new Set<string>(); const fs = [...c.findings, ...p.findings].filter(f => { const k = f.elementId + f.ruleId; if (seen.has(k)) return false; seen.add(k); return true; });
    return { market: m, findings: fs, passes: [...c.clear, ...p.clear], score: 100 } as MarketResult;
  }));
  // 决策官
  const total = per.reduce((a, r) => a + r.findings.length, 0);
  if (total) emit({ agent: 'decision', status: 'start', msg: `决策官仲裁 ${total} 条结论` });
  const decided = await Promise.all(per.map(r => (r.findings.length ? decideMarket(s, job, els, r).catch(() => ({ ds: {} as Record<string, Decision>, launch: undefined })) : Promise.resolve({ ds: {} as Record<string, Decision>, launch: undefined as LaunchDecision | undefined }))));
  per.forEach((r, i) => {
    const { ds } = decided[i];
    const kept: Finding[] = []; let dropped = 0;
    for (const f of r.findings) {
      const d = ds[f.id];
      if (d) {
        f.decision = d;
        f.confidence = Math.round(d.keepProb * 100) / 100;
        if (d.level) f.level = clampLv(d.level, ruleById(f.ruleId)?.level || d.level);
        if (d.optionIdx != null && f.suggestions?.[d.optionIdx]) f.suggestion = f.suggestions[d.optionIdx];
        if (d.keepProb < 0.3) { dropped++; continue; }
      }
      f.review = f.confidence < 0.6;
      kept.push(f);
    }
    kept.sort((a, b) => LV.indexOf(a.level) - LV.indexOf(b.level) || b.confidence - a.confidence);
    r.findings = kept; r.dropped = dropped; r.score = scoreOf(kept);
    r.launch = consistentLaunch(decided[i].launch, r);
    emit({ agent: 'chief', market: r.market, status: 'progress', msg: `${MK_SHORT[r.market]} 体检分 ${r.score}`, pct: 80 });
  });
  const drop = per.reduce((a, r) => a + (r.dropped || 0), 0);
  emit({ agent: 'decision', status: 'done', msg: `决策官仲裁完成：保留 ${per.reduce((a, r) => a + r.findings.filter(f => !f.review).length, 0)} · 待确认 ${per.reduce((a, r) => a + r.findings.filter(f => f.review).length, 0)} · 剔除 ${drop}` });
  emit({ agent: 'chief', status: 'done', msg: '汇总、去重、打分完成', pct: 100 });
  return { elements: els, results: per };
}

export async function runLive(s: Settings, job: Job, onEvent: (e: AgentEvent) => void): Promise<Report> {
  const t0 = Date.now(); const events: AgentEvent[] = []; const warnings: string[] = [];
  const emit: Emit = e => { const ev = { ...e, t: Date.now() - t0 }; events.push(ev); onEvent(ev); };
  const { elements, results } = await analyze(s, job, job.image.dataUrl, emit, warnings);
  return { jobId: job.id, elements, results, events, elapsedMs: Date.now() - t0, warnings,
    models: { vision: s.provider === 'qianfan' && s.qianfanKey ? s.qianfanVisionModel : s.visionModel, review: s.provider === 'qianfan' && s.qianfanKey ? s.qianfanTextModel : s.reviewModel, image: s.imageModel,
      decision: s.provider === 'qianfan' && s.qianfanKey ? s.qianfanTextModel : s.reviewModel } };
}

function imgSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej; i.src = src; });
}

/** 不能靠改图解决的规则：商品本身属性 / 需要真实认证或标签，AI 改图只会制造虚假声明 */
export const OFFLINE_RULES = new Set(['in-beef', 'sa-halal-meat', 'jp-label-lang', 'br-label-pt', 'sa-label-ar', 'in-label-lm', 'us-origin-marking']);

/** 修图艺术家：同规则且相邻的框合并，逐个元素串行编辑（单次 ≤2 框的接口限制下，1 框成功率最高），然后复检 */
export async function runFix(s: Settings, job: Job, rep: Report, onProgress: (msg: string) => void): Promise<Report> {
  if (!s.bailianKey) throw new ApiError('修图需要阿里云百炼 Key', 0, '修正版由百炼万相生成；千帆只负责视觉与复核，请在设置里补充 DashScope Key。');
  const byEl = new Map<string, Finding>(); const skipped = new Map<string, Finding>();
  for (const r of rep.results) for (const f of r.findings) {
    if (f.review) continue;
    if (f.elementId === 'copy' || OFFLINE_RULES.has(f.ruleId)) { skipped.set(f.ruleId + f.elementId, f); continue; }
    const el = rep.elements.find(e => e.id === f.elementId); if (!el?.bbox) continue;
    const cur = byEl.get(f.elementId);
    if (!cur || LV.indexOf(f.level) < LV.indexOf(cur.level)) byEl.set(f.elementId, f);
  }
  // 合并：同一规则、框相交或相邻（间距 < 4%）的元素合成一个框
  type Job1 = { f: Finding; box: number[] };
  const jobs: Job1[] = [];
  const near = (a: number[], b: number[]) => a[0] - 40 < b[2] && b[0] - 40 < a[2] && a[1] - 40 < b[3] && b[1] - 40 < a[3];
  for (const f of [...byEl.values()].sort((a, b) => LV.indexOf(a.level) - LV.indexOf(b.level))) {
    const bb = rep.elements.find(e => e.id === f.elementId)!.bbox!.slice();
    const m = jobs.find(j => j.f.ruleId === f.ruleId && near(j.box, bb));
    if (m) m.box = [Math.min(m.box[0], bb[0]), Math.min(m.box[1], bb[1]), Math.max(m.box[2], bb[2]), Math.max(m.box[3], bb[3])];
    else jobs.push({ f, box: bb });
  }
  const items = jobs.slice(0, 5);
  if (!items.length) throw new ApiError('没有可通过改图解决的问题', 0, '剩余问题需要更换商品、补充真实标签或修改文案');
  let img = job.image.dataUrl;
  for (let i = 0; i < items.length; i++) {
    const { f, box } = items[i];
    onProgress(`修图艺术家 · ${i + 1}/${items.length} · ${f.title.slice(0, 10)}`);
    const { w, h } = await imgSize(img);
    const px = [Math.round(box[0] / 1000 * w), Math.round(box[1] / 1000 * h), Math.round(box[2] / 1000 * w), Math.round(box[3] / 1000 * h)];
    const prompt = `${f.editPrompt || f.suggestion} Only edit inside the box; keep everything outside unchanged, photorealistic, same lighting and style. Do not add any certification logos or claims. Any text must be spelled exactly as instructed.`;
    const url = await wanEdit(s, img, prompt, [px]);
    img = await fetchAsDataUrl(url);
  }
  onProgress('复检中 · 再跑一遍视觉 + 规则 + 决策');
  const { results } = await analyze(s, job, img, () => {});
  const fixedScores: Partial<Record<Market, number>> = {};
  results.forEach(r => (fixedScores[r.market] = r.score));
  return { ...rep, fixedImage: img, fixedScores, fixedResults: results, fixSkipped: [...skipped.values()].map(f => `${MK_SHORT[f.market]}：${f.title}`) };
}
