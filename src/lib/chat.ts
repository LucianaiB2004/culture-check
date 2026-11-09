import type { Job, Report } from './types';
import { chatText } from './api';
import { loadSettings, hasLive } from './settings';
import { MK_SHORT, ruleById } from './rules';
import { orderFindings } from './common';
import { esc } from './shell';

export interface Msg { role: 'user' | 'assistant'; content: string }

const worstMarket = (rep: Report) => [...rep.results].sort((a, b) => a.score - b.score)[0]?.market;
/** 示例提示词：随报告变化，但对同一份报告是确定的（演示答案按序号对应） */
export function presetQuestions(job: Job, rep: Report): string[] {
  const w = worstMarket(rep); const wn = w ? MK_SHORT[w] : '目标';
  return [
    `上架前我最该先改哪一处？按优先级排个序。`,
    `把商品标题和卖点改写成适合${wn}市场的版本，给我 2 个选项。`,
    `给设计师写一份修图需求清单，可以直接转发。`,
    `${wn}市场的这些结论依据是什么？哪些需要人工再确认？`,
  ];
}

/** 把报告压缩成模型上下文：只保留结论要点与规则来源 */
export function reportContext(job: Job, rep: Report) {
  return JSON.stringify({
    product: { category: job.category, channel: job.channel, copy: job.copyText },
    elements: rep.elements.map(e => ({ id: e.id, label: e.label, text: e.text })),
    markets: rep.results.map(r => ({
      market: MK_SHORT[r.market], score: r.score, launch: r.launch?.choice, fixedScore: rep.fixedScores?.[r.market],
      findings: orderFindings(r.findings).map(f => ({ level: f.level, title: f.title, element: f.elementId, reason: f.reason, suggestion: f.suggestion, rule: ruleById(f.ruleId)?.title || f.ruleId, sources: f.sources.map(s => s.title), keep: f.decision?.keepProb })),
      passes: r.passes,
    })),
  });
}
const SYS = `你是「商品图文化体检」的主诊医生，负责回答跨境卖家对本次体检报告的追问。
要求：
1. 只依据下面的体检报告 JSON 回答；报告没有覆盖的内容要明确说明“报告未覆盖”，不要编造法规或数据。
2. 面向运营和设计，回答具体、可执行；引用结论时写出市场和风险等级，必要时注明依据来源名称。
3. 用简体中文，控制在 220 字以内；可以用短列表（以“- ”或“1. ”开头），不要使用表格和标题。`;

export async function askLive(job: Job, rep: Report, history: Msg[], q: string): Promise<string> {
  if (!hasLive()) throw new Error('需要配置 Key');
  const msgs = [{ role: 'system' as const, content: `${SYS}\n\n体检报告：${reportContext(job, rep)}` }, ...history.slice(-8), { role: 'user' as const, content: q }];
  return chatText(loadSettings(), msgs, 0.3);
}

/** 演示报告的示例回答：由真实模型基于同一份报告预先生成 */
export async function demoAnswers(demoId: string): Promise<string[]> {
  try { const r = await fetch(`i18n/demo-${demoId}-chat.json`); return r.ok ? (await r.json()).answers : []; } catch { return []; }
}

/** 极简 Markdown：粗体、列表、换行 */
export function md(t: string) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n+/).map(l => /^\s*([-*]|\d+[.、])\s+/.test(l) ? `<li>${l.replace(/^\s*([-*]|\d+[.、])\s+/, '')}</li>` : `<p>${l}</p>`).join('')
    .replace(/(<li>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);
}
