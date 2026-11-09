import { loadContext, resOf, orderFindings, scoreClass, scoreColor, scoreTag, boxesHTML, ICON, lvRank } from '../lib/common';
import { $, $$, esc, mountTopbar, toast, LV_SHORT, LV_NAME, LAUNCH_NAME } from '../lib/shell';
import { MK_SHORT, mkImg, ruleById, MARKETS, RULES } from '../lib/rules';
import type { Finding, Job, Market, Report, Translation } from '../lib/types';
import { T, getTranslation, mkName, type Lang } from '../lib/i18n';
import { persist } from '../lib/common';

mountTopbar(3);
let job: Job, rep: Report, demo = false, mxMode: 'el' | 'type' = 'el', fmt = 'pdf', lang: Lang = 'zh';
const CAT: Record<string, { n: string; icon: string }> = { number: { n: '数字', icon: 'risk-number' }, flower: { n: '花卉 / 颜色', icon: 'risk-color' }, color: { n: '颜色', icon: 'risk-color' }, gesture: { n: '手势', icon: 'risk-gesture' }, text: { n: '文字用语', icon: 'risk-text' }, symbol: { n: '符号 / 宗教', icon: 'risk-religion' }, food: { n: '饮食与合规', icon: 'risk-food' } };
const ms = () => job.markets.filter(m => resOf(rep, m));
const cell = (f?: Finding) => (f ? `<span class="cell ${f.level === 'high' ? 'h' : f.level === 'mid' ? 'm' : 'l'}" title="${esc(f.title)}">${LV_SHORT[f.level]}</span>` : `<span class="cell n">—</span>`);
const worst = (fs: Finding[]) => fs.sort((a, b) => lvRank(a.level) - lvRank(b.level))[0];
const productName = () => (job.demoId === 'tea' ? '茶具礼盒' : job.demoId === 'jerky' ? '牛肉干派对装' : job.category.split('·').pop()!.trim());

function renderCards() {
  const list = ms(); if (innerWidth > 760) $('#mcards').style.gridTemplateColumns = `repeat(${Math.max(list.length, 3)},minmax(0,1fr))`;
  const minS = Math.min(...list.map(m => resOf(rep, m)!.score));
  $('#mcards').innerHTML = list.map(m => {
    const r = resOf(rep, m)!; const c = { high: 0, mid: 0, low: 0 } as Record<string, number>; r.findings.forEach(f => c[f.level]++);
    const sub = r.findings.length ? `${r.findings.length} 处 · ${c.high ? '高 ' + c.high : c.mid ? '中 ' + c.mid : '提示'}` : '未发现问题';
    return `<a class="mcard ${r.score === minS && minS < 90 ? 'worst' : ''}" href="result.html?m=${m}${new URLSearchParams(location.search).get('demo') ? '&demo=' + (job.demoId || 'tea') : ''}" style="color:inherit"><div class="hd"><img src="${mkImg(m)}" alt=""><div><b>${MK_SHORT[m]}</b><small>${sub}</small></div></div><div class="sc"><b class="num">${r.score}<small>/100</small></b><span class="tag ${scoreClass(r.score)}">${scoreTag(r.score)}</span></div><div class="meter"><i style="width:${r.score}%;background:${scoreColor(r.score)}"></i></div>${r.launch ? `<div class="ld"><img src="${ICON('agent-decision')}" style="width:18px;height:18px" alt="">上架决策 <b>${LAUNCH_NAME[r.launch.choice]}</b></div>` : ''}</a>`;
  }).join('');
}
function renderMatrix() {
  const list = ms();
  $('#mxSub').textContent = `同一张图 × ${list.length} 个市场`;
  const head = `<thead><tr><th style="width:30%">${mxMode === 'el' ? '图中元素' : '风险类型'}</th>${list.map(m => `<th><img src="${mkImg(m)}" alt="">${MK_SHORT[m]}</th>`).join('')}<th style="width:19%">统一替换建议</th></tr></thead>`;
  let rows = '';
  if (mxMode === 'el') {
    const ids = [...new Set(list.flatMap(m => resOf(rep, m)!.findings.map(f => f.elementId)))];
    ids.sort((a, b) => Math.min(...list.flatMap(m => resOf(rep, m)!.findings.filter(f => f.elementId === a).map(f => lvRank(f.level))), 9) - Math.min(...list.flatMap(m => resOf(rep, m)!.findings.filter(f => f.elementId === b).map(f => lvRank(f.level))), 9));
    rows = ids.map(id => {
      const el = rep.elements.find(e => e.id === id); const all = list.flatMap(m => resOf(rep, m)!.findings.filter(f => f.elementId === id));
      const w = worst([...all]); const cat = ruleById(w.ruleId)?.category || 'text';
      return `<tr><td><img src="${ICON(w.icon)}" alt=""><div>${esc(el?.label || (id === 'copy' ? '标题与卖点文案' : w.title))}<small>${CAT[cat]?.n || ''}</small></div></td>${list.map(m => cell(worst(resOf(rep, m)!.findings.filter(f => f.elementId === id)))).map(c => `<td>${c}</td>`).join('')}<td style="text-align:left;font-size:12.5px">${esc(w.suggestion.length > 34 ? w.suggestion.slice(0, 33) + '…' : w.suggestion)}</td></tr>`;
    }).join('');
    const passM = list.filter(m => resOf(rep, m)!.passes?.length);
    if (passM.length) rows += `<tr><td><img src="${ICON('risk-food')}" alt=""><div>禁运 / 宗教排查<small>饮食与合规</small></div></td>${list.map(m => `<td>${passM.includes(m) ? '<span class="cell l">通过</span>' : '<span class="cell n">—</span>'}</td>`).join('')}<td style="text-align:left;font-size:12.5px">无需修改</td></tr>`;
  } else {
    const cats = [...new Set(list.flatMap(m => resOf(rep, m)!.findings.map(f => ruleById(f.ruleId)?.category || 'text')))];
    rows = cats.map(c => {
      const all = list.flatMap(m => resOf(rep, m)!.findings.filter(f => (ruleById(f.ruleId)?.category || 'text') === c)); const w = worst([...all]);
      return `<tr><td><img src="${ICON(CAT[c]?.icon || 'risk-text')}" alt=""><div>${CAT[c]?.n || c}<small>${all.length} 条结论</small></div></td>${list.map(m => `<td>${cell(worst(resOf(rep, m)!.findings.filter(f => (ruleById(f.ruleId)?.category || 'text') === c)))}</td>`).join('')}<td style="text-align:left;font-size:12.5px">${esc(w.suggestion.length > 34 ? w.suggestion.slice(0, 33) + '…' : w.suggestion)}</td></tr>`;
    }).join('');
  }
  $('#mx').innerHTML = head + `<tbody>${rows || `<tr><td colspan="${list.length + 2}" style="text-align:center;color:var(--muted)">所有市场均未发现问题</td></tr>`}</tbody>`;
}
function renderAfter() {
  const list = ms();
  $('#afterRow').innerHTML = rep.fixedImage
    ? `<div class="thumbs"><img src="${job.image.dataUrl}" alt=""><span>→</span><img src="${rep.fixedImage}" alt=""></div><div class="ar-t"><b>应用全部替换建议后 · ${rep.fixedResults ? '复检得分' : '预估得分'}</b><small>${rep.fixSkipped?.length ? `修正版重新跑完整体检；另有 ${rep.fixSkipped.length} 条无法靠改图解决（换品 / 补真实标签 / 改文案）` : '由修图艺术家生成修正版，再次复检得出'}</small></div><div class="deltas">${list.map(m => `<span><img src="${mkImg(m)}" alt="">${resOf(rep, m)!.score} → <b>${rep.fixedScores?.[m] ?? '—'}</b></span>`).join('')}</div>`
    : `<div class="thumbs"><img src="${job.image.dataUrl}" alt=""><span>→</span><img src="${ICON('agent-fix')}" style="object-fit:contain;background:#fff" alt=""></div><div class="ar-t"><b>还没有修正版</b><small>在报告页点「一键应用全部替换建议」，修图艺术家会生成修正版并复检</small></div><div class="deltas"><a class="btn btn-ghost btn-sm" href="result.html">去生成 →</a></div>`;
}
function renderExport() {
  $('#repTitle').textContent = `${productName()} · ${ms().length} 国文化体检报告`;
  $('#inclN').textContent = `${ms().length} 国评分`;
  const base = location.href.replace(/compare\.html.*$/, '');
  const share = demo ? `${base}compare.html?demo=${job.demoId || 'tea'}` : '';
  $('#shareUrl').textContent = share ? share.replace(/^https?:\/\//, '') : '本地结果仅存于本浏览器 · 可导出 JSON 分享';
  $('#copyLink').dataset.url = share;
  const ln = { zh: '', en: '（英文）', ja: '（日文）' }[lang];
  $('#dlBtn').textContent = { pdf: `下载 PDF 报告${ln}`, png: `下载圈注长图 PNG${ln}`, json: `下载 Markdown + JSON${ln}` }[fmt]!;
}

/** 取当前语言的文本（中文直接用原文） */
async function texts(): Promise<Translation | null> {
  if (lang === 'zh') return null;
  const had = !!rep.i18n?.[lang];
  const tr = await getTranslation(job, rep, lang, demo, productName());
  if (!demo && !had) await persist(job, rep).catch(() => {});
  return tr;
}
const ft = (f: Finding, tr: Translation | null) => (tr?.findings[f.id] ? { ...f, ...tr.findings[f.id] } : f);
const absUrl = (u: string) => (u.startsWith('data:') ? u : new URL(u, location.href).href);

function markdown(tr: Translation | null) {
  const t = T[lang]; const pn = tr?.product || productName();
  const L: string[] = [`# ${pn} · ${t.title}`, '', `- ${t.generated}: ${new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US')}`, `- ${t.mode}: ${demo ? t.demo : t.live}`, `- ${t.models}: ${Object.entries(rep.models).map(([k, v]) => `${k}=${v}`).join(', ')}`, ''];
  L.push(`| ${t.market} | ${t.score} | ${t.decision} | ${t.count} |`, '|---|---|---|---|');
  ms().forEach(m => { const r = resOf(rep, m)!; L.push(`| ${mkName(lang, m)} | ${r.score}${rep.fixedScores?.[m] != null ? ` → ${rep.fixedScores[m]}` : ''} | ${r.launch ? t.launch[r.launch.choice] : '—'} | ${r.findings.length} |`); });
  ms().forEach(m => {
    const r = resOf(rep, m)!; L.push('', `## ${mkName(lang, m)} (${r.score} ${t.points})`);
    orderFindings(r.findings).forEach((f0, i) => { const f = ft(f0, tr); L.push('', `### ${i + 1}. [${t.lv[f.level]}] ${f.title}`, '', `- ${t.where}: ${f.where}`, `- ${t.reason}: ${f.reason}`, `- ${t.fix}: ${f.suggestion}`, `- ${t.conf}: ${f.confidence.toFixed(2)}${f.decision ? ` (${t.keep} ${Math.round(f.decision.keepProb * 100)}%)` : ''}`, `- ${t.rule}: ${f.ruleId}`, `- ${t.src}: ${f.sources.map(s => `[${s.title}](${s.url})`).join('; ')}`); });
    (tr?.passes[m] || r.passes || []).forEach(p => L.push(`- ✅ ${p}`));
  });
  L.push('', '---', t.disclaimer);
  return L.join('\n');
}
function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const LVC = { high: '#FF5A4E', mid: '#F5A524', low: '#22B07D' } as const;
/** 报告文档（PDF 打印与 PNG 长图共用），只用内联样式，脱离页面也能渲染 */
function docHTML(tr: Translation | null) {
  const t = T[lang]; const pn = tr?.product || productName(); const img = absUrl(job.image.dataUrl); const ar = `${job.image.w}/${job.image.h}`;
  const box = (fs: Finding[]) => { const seen = new Set<string>(); return orderFindings(fs).map((f, i) => { const el = rep.elements.find(e => e.id === f.elementId); if (!el?.bbox || seen.has(el.id)) return ''; seen.add(el.id);
    const [x1, y1, x2, y2] = el.bbox.map(v => Math.max(0, Math.min(1000, v)) / 10);
    return `<div style="position:absolute;left:${x1}%;top:${y1}%;width:${Math.max(2, x2 - x1)}%;height:${Math.max(2, y2 - y1)}%;border:2.5px solid ${LVC[f.level]};border-radius:8px"><span style="position:absolute;left:-10px;top:-10px;width:20px;height:20px;border-radius:50%;background:${LVC[f.level]};color:#fff;font:800 11px/20px sans-serif;text-align:center">${i + 1}</span></div>`; }).join(''); };
  const sec = (m: Market) => { const r = resOf(rep, m)!; const fs = orderFindings(r.findings);
    return `<section style="break-inside:avoid;display:grid;grid-template-columns:260px 1fr;gap:20px;padding:18px;margin:0 0 14px;background:#fff;border:1.5px solid #ECE3D4;border-radius:18px">
      <div style="position:relative;width:260px;aspect-ratio:${ar};border-radius:12px;overflow:hidden;align-self:start"><img src="${img}" style="width:100%;height:100%;object-fit:cover;display:block">${box(fs)}</div>
      <div><h2 style="margin:0 0 4px;font-size:20px;display:flex;align-items:center;gap:10px"><img src="${absUrl(mkImg(m))}" style="width:34px;height:34px;object-fit:contain">${esc(mkName(lang, m))} · <span style="color:${r.score < 60 ? '#E2362B' : r.score < 90 ? '#B97200' : '#178A60'}">${r.score}</span><small style="font-size:12px;color:#8A8DA3">/100</small>${r.launch ? `<span style="margin-left:auto;font-size:12px;padding:4px 10px;border-radius:99px;background:#F1EFFF;color:#5B4BD6">${t.decision}: ${t.launch[r.launch.choice]}</span>` : ''}</h2>
      ${fs.map((f0, i) => { const f = ft(f0, tr); return `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #ECE3D4"><b style="font-size:13.5px"><span style="display:inline-block;min-width:18px;height:18px;border-radius:50%;background:${LVC[f.level]};color:#fff;text-align:center;font-size:11px;line-height:18px;margin-right:6px">${i + 1}</span>${esc(f.title)} <span style="color:${LVC[f.level]};font-size:11.5px">· ${t.lv[f.level]}</span></b>
        <p style="margin:4px 0 0;font-size:12.5px;color:#4A5070">${esc(f.reason)}</p><p style="margin:4px 0 0;font-size:12.5px"><b style="color:#178A60">${t.fix}:</b> ${esc(f.suggestion)}</p><p style="margin:3px 0 0;font-size:11px;color:#8A8DA3">${t.src}: ${f.sources.map(s => esc(s.title)).join(' · ')} · ${t.conf} ${f.confidence.toFixed(2)}</p></div>`; }).join('') || `<p style="color:#8A8DA3;font-size:13px">${t.none}</p>`}
      ${(tr?.passes[m] || r.passes || []).length ? `<p style="margin-top:8px;font-size:12px;color:#178A60">✓ ${(tr?.passes[m] || r.passes || []).map(esc).join(' · ')}</p>` : ''}</div></section>`; };
  const fixed = rep.fixedImage ? `<section style="break-inside:avoid;padding:18px;margin:0 0 14px;background:#fff;border:1.5px solid #ECE3D4;border-radius:18px"><h2 style="margin:0 0 12px;font-size:18px">${t.after}</h2><div style="display:flex;gap:16px;align-items:center"><figure style="margin:0;width:200px"><img src="${img}" style="width:100%;border-radius:10px"><figcaption style="font-size:12px;color:#8A8DA3">${t.original}</figcaption></figure><span style="font-size:24px">→</span><figure style="margin:0;width:200px"><img src="${absUrl(rep.fixedImage)}" style="width:100%;border-radius:10px"><figcaption style="font-size:12px;color:#8A8DA3">${t.fixed}</figcaption></figure><div style="display:grid;gap:6px;font-size:13px;margin-left:12px">${ms().map(m => `<span>${esc(mkName(lang, m))}: ${resOf(rep, m)!.score} → <b>${rep.fixedScores?.[m] ?? '—'}</b></span>`).join('')}</div></div></section>` : '';
  return `<div style="font-family:${lang === 'ja' ? "'Hiragino Sans','Yu Gothic','Noto Sans CJK JP','Noto Sans JP'," : "'PingFang SC','Microsoft YaHei','Noto Sans CJK SC','Noto Sans SC',"}'Jakarta',sans-serif;color:#1B2140;background:#FBF6EE;padding:28px;width:900px;box-sizing:border-box">
    <header style="display:flex;align-items:center;gap:14px;margin-bottom:16px"><img src="${absUrl('assets/logo.webp')}" style="width:52px;height:52px;object-fit:contain"><div><div style="font-size:12px;color:#8A8DA3;font-weight:700;letter-spacing:.06em">CULTURECHECK</div><h1 style="margin:2px 0 0;font-size:24px">${esc(pn)} · ${t.title}</h1></div></header>
    <p style="font-size:12px;color:#8A8DA3;margin:0 0 12px">${t.generated}: ${new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US')} · ${t.mode}: ${demo ? t.demo : t.live} · ${t.models}: ${[...new Set(Object.values(rep.models).filter(Boolean))].join(' / ')}</p>
    <section style="display:grid;grid-template-columns:repeat(${Math.min(ms().length, 6)},1fr);gap:10px;margin-bottom:14px">${ms().map(m => { const r = resOf(rep, m)!; return `<div style="background:#fff;border:1.5px solid #ECE3D4;border-radius:14px;padding:10px;text-align:center"><img src="${absUrl(mkImg(m))}" style="width:36px;height:36px;object-fit:contain"><div style="font-size:12.5px;font-weight:700">${esc(mkName(lang, m))}</div><div style="font-size:22px;font-weight:800;color:${r.score < 60 ? '#E2362B' : r.score < 90 ? '#B97200' : '#178A60'}">${r.score}</div><div style="font-size:11px;color:#8A8DA3">${r.launch ? t.launch[r.launch.choice] : ''}</div></div>`; }).join('')}</section>
    ${ms().map(sec).join('')}${fixed}
    <p style="font-size:11px;color:#8A8DA3;margin-top:10px">${t.disclaimer}</p></div>`;
}
const waitImgs = (root: ParentNode) => Promise.all([...root.querySelectorAll('img')].map(i => (i as HTMLImageElement).decode().catch(() => {})));
async function pngExport(tr: Translation | null) {
  const { toPng } = await import('html-to-image');
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0';
  host.innerHTML = docHTML(tr); document.body.appendChild(host);
  try { await waitImgs(host); download(`culture-check-${job.id}-${lang}.png`, await (await fetch(await toPng(host.firstElementChild as HTMLElement, { pixelRatio: 2, cacheBust: true }))).blob(), 'image/png'); }
  finally { host.remove(); }
}
async function pdfExport(tr: Translation | null) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(`<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : lang}"><head><meta charset="utf-8"><title>CultureCheck · ${esc(tr?.product || productName())}</title><style>@page{size:A4;margin:8mm}body{margin:0;background:#FBF6EE;-webkit-print-color-adjust:exact;print-color-adjust:exact}body>div{width:auto!important}</style></head><body>${docHTML(tr)}</body></html>`); d.close();
  await waitImgs(d); await new Promise(r => setTimeout(r, 200));
  f.contentWindow!.focus(); f.contentWindow!.print();
  setTimeout(() => f.remove(), 60000);
}
(window as any).__ccDoc = async (l: Lang) => { lang = l; return docHTML(await texts()); };
if (import.meta.env.DEV) (window as any).__ccTranslate = (l: 'en' | 'ja') => getTranslation(job, { ...rep, i18n: undefined }, l, false, productName());

(async () => {
  ({ job, rep, demo } = await loadContext());
  renderCards(); renderMatrix(); renderAfter(); renderExport();
})();
$('#mxSeg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; mxMode = b.dataset.v as any; $$('#mxSeg button').forEach(x => x.classList.toggle('on', x === b)); renderMatrix(); });
$('#opts').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('.op'); if (!b) return; fmt = b.dataset.v!; $$('#opts .op').forEach(x => x.classList.toggle('on', x === b)); renderExport(); });
$('#langSeg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; lang = b.dataset.v as Lang; $$('#langSeg button').forEach(x => x.classList.toggle('on', x === b)); renderExport(); });
$('#copyLink').addEventListener('click', async () => { const u = $('#copyLink').dataset.url; if (!u) return toast('真实分析结果只保存在本浏览器，请导出 JSON 分享', 'info'); try { await navigator.clipboard.writeText(u); toast('链接已复制', 'ok'); } catch { prompt('复制链接', u); } });
$('#dlBtn').addEventListener('click', async () => {
  const btn = $('#dlBtn') as HTMLButtonElement; const label = btn.textContent;
  let tr: Translation | null = null;
  try {
    if (lang !== 'zh' && !rep.i18n?.[lang] && !demo) { btn.disabled = true; btn.textContent = lang === 'en' ? '正在翻译为英文…' : '正在翻译为日文…'; }
    tr = await texts();
  } catch (e: any) { btn.disabled = false; btn.textContent = label; return toast(`报告翻译失败：${e.message}${e.hint ? '（' + e.hint + '）' : ''}`, 'err', 6000); }
  btn.disabled = false; btn.textContent = label;
  if (fmt === 'pdf') { try { await pdfExport(tr); } catch (e) { console.error(e); toast('PDF 生成失败，请重试', 'err'); } return; }
  if (fmt === 'png') { toast('正在生成长图…'); try { await pngExport(tr); toast('已下载 PNG', 'ok'); } catch (e) { console.error(e); toast('长图生成失败', 'err'); } return; }
  download(`culture-check-${job.id}-${lang}.md`, markdown(tr), 'text/markdown');
  const { elements, results, fixedScores, models } = rep;
  download(`culture-check-${job.id}-${lang}.json`, JSON.stringify({ lang, ...(tr ? { translation: tr } : {}), product: { category: job.category, channel: job.channel, copy: job.copyText }, markets: job.markets, elements, results, fixedScores, models, rulesVersion: `v1 (${RULES.length})` }, null, 2), 'application/json');
  toast(`已下载 Markdown 与 JSON${lang === 'zh' ? '' : lang === 'en' ? '（英文）' : '（日文）'}`, 'ok');
});
