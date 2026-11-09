import '../css/styles.css';
import '../css/app.css';
import '../css/extra.css';
import type { Element, Finding, Job, Market, MarketResult, Report } from './types';
import { demoJob, demoReport } from './demo';
import { presetReport } from './presets';
import { loadJob, loadReport, saveJob, saveReport } from './store';
import { esc, LV_COLOR } from './shell';

export const LV = ['high', 'mid', 'low'] as const;
export const lvRank = (l: string) => LV.indexOf(l as any);

/** 结果页 / 对比页的数据源：?demo=tea 直接载入示例，否则读 IndexedDB，均无则载入示例 */
export async function loadContext(): Promise<{ job: Job; rep: Report; demo: boolean }> {
  const q = new URLSearchParams(location.search);
  if (q.get('demo') === 'jerky') {
    const job: Job = { ...demoJob(['IN', 'SA', 'US']), id: 'demo-jerky', demoId: 'jerky', category: '食品 · 肉类零食', image: { dataUrl: 'assets/demo-product-2.webp', w: 864, h: 1152, name: 'beef-jerky-party.jpg', size: 1048576 },
      copyText: 'Premium Beef Jerky Party Pack – 100% beef, smoky BBQ flavor. Made in USA quality!' };
    return { job, rep: presetReport(job), demo: true };
  }
  if (q.get('demo')) {
    const job = demoJob(['JP', 'BR', 'SA', 'US', 'DE', 'IN']);
    return { job, rep: demoReport(job), demo: true };
  }
  const [job, rep] = await Promise.all([loadJob(), loadReport()]);
  if (job && rep && rep.jobId === job.id) return { job, rep, demo: job.mode === 'demo' };
  const dj = demoJob(['JP', 'BR', 'SA', 'US', 'DE', 'IN']);
  return { job: dj, rep: demoReport(dj), demo: true };
}
export async function persist(job: Job, rep: Report) { await saveJob(job); await saveReport(rep); }

export const marketsOf = (job: Job, rep: Report): Market[] => job.markets.filter(m => rep.results.some(r => r.market === m));
export const resOf = (rep: Report, m: Market, fixed = false): MarketResult | undefined => (fixed ? rep.fixedResults : rep.results)?.find(r => r.market === m);

export function boxStyle(b: [number, number, number, number]) {
  const [x1, y1, x2, y2] = b.map(v => Math.max(0, Math.min(1000, v)) / 10);
  return `left:${x1}%;top:${y1}%;width:${Math.max(1.5, x2 - x1)}%;height:${Math.max(1.5, y2 - y1)}%`;
}
/** 一个元素只画一个框，取该市场最严重的结论；编号与列表一致 */
export function orderFindings(fs: Finding[]) {
  return [...fs].sort((a, b) => lvRank(a.level) - lvRank(b.level) || (b.decision?.keepProb ?? b.confidence) - (a.decision?.keepProb ?? a.confidence));
}
export function boxesHTML(els: Element[], fs: Finding[], selId?: string, show: (f: Finding) => boolean = () => true) {
  const seen = new Set<string>(); let out = '';
  orderFindings(fs).forEach((f, i) => {
    if (!show(f)) return;
    const el = els.find(e => e.id === f.elementId);
    if (!el?.bbox || seen.has(el.id)) return; seen.add(el.id);
    const lab = el.bbox[0] > 620 ? 'lb l' : 'lb';
    const showLb = (el.bbox[2] - el.bbox[0]) > 60;
    out += `<div class="box c-${f.level} ${f.id === selId ? 'sel' : ''}" data-f="${f.id}" style="${boxStyle(el.bbox)}"><span class="n">${i + 1}</span>${showLb ? `<span class="${lab}">${esc(shortLabel(f, el))}</span>` : ''}</div>`;
  });
  return out;
}
export const shortLabel = (f: Finding, el?: Element) => (el?.label && el.label.length <= 10 ? el.label : f.title.length > 10 ? f.title.slice(0, 9) + '…' : f.title);
export const lvColor = (l: Finding['level']) => LV_COLOR[l];
export const scoreClass = (s: number) => (s < 60 ? 'high' : s < 90 ? 'mid' : 'low');
export const scoreColor = (s: number) => (s < 60 ? 'var(--coral)' : s < 90 ? 'var(--amber)' : 'var(--mint)');
export const scoreTag = (s: number) => (s < 60 ? '需整改' : s < 90 ? '建议修改' : '可上架');
export const ICON = (n: string) => `assets/${n}.webp`;

/** 让图片容器按真实宽高比铺满父容器（设计稿默认 3:4） */
export function fitShot(el: HTMLElement, w: number, h: number, pad = 28) {
  const apply = () => {
    const p = el.parentElement!; if (!p) return;
    el.style.aspectRatio = `${w}/${h}`;
    if (window.innerWidth <= 760) { el.style.width = '100%'; el.style.height = 'auto'; return; }
    const pw = p.clientWidth - pad, ph = p.clientHeight - pad;
    if (pw <= 0 || ph <= 0) return;
    const s = Math.min(pw / w, ph / h);
    el.style.width = Math.floor(w * s) + 'px'; el.style.height = Math.floor(h * s) + 'px';
  };
  apply(); new ResizeObserver(apply).observe(el.parentElement!);
}
