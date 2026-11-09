import { loadContext, resOf, orderFindings, scoreClass, scoreColor, scoreTag, boxesHTML, ICON, lvRank } from '../lib/common';
import { $, $$, esc, mountTopbar, toast, LV_SHORT, LV_NAME, LAUNCH_NAME } from '../lib/shell';
import { MK_SHORT, mkImg, ruleById, MARKETS, RULES } from '../lib/rules';
import type { Finding, Job, Market, Report } from '../lib/types';

mountTopbar(3);
let job: Job, rep: Report, demo = false, mxMode: 'el' | 'type' = 'el', fmt = 'pdf';
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
  $('#dlBtn').textContent = { pdf: '下载 PDF 报告', png: '下载圈注长图 PNG', json: '下载 Markdown + JSON' }[fmt]!;
}

function markdown() {
  const L: string[] = [`# ${productName()} · 跨境商品图文化体检报告`, '', `- 生成时间：${new Date().toLocaleString('zh-CN')}`, `- 模式：${demo ? '演示数据' : '真实分析'}`, `- 模型：${Object.entries(rep.models).map(([k, v]) => `${k}=${v}`).join('，')}`, ''];
  L.push('| 市场 | 得分 | 上架决策 | 发现 |', '|---|---|---|---|');
  ms().forEach(m => { const r = resOf(rep, m)!; L.push(`| ${MK_SHORT[m]} | ${r.score}${rep.fixedScores?.[m] != null ? ` → ${rep.fixedScores[m]}` : ''} | ${r.launch ? LAUNCH_NAME[r.launch.choice] : '—'} | ${r.findings.length} |`); });
  ms().forEach(m => {
    const r = resOf(rep, m)!; L.push('', `## ${MARKETS.find(x => x.id === m)!.name}（${r.score} 分）`);
    orderFindings(r.findings).forEach((f, i) => { L.push('', `### ${i + 1}. [${LV_NAME[f.level]}] ${f.title}`, '', `- 位置：${f.where}`, `- 原因：${f.reason}`, `- 替换建议：${f.suggestion}`, `- 置信度：${f.confidence.toFixed(2)}${f.decision ? `（决策官保留概率 ${Math.round(f.decision.keepProb * 100)}%）` : ''}`, `- 规则：${f.ruleId}`, `- 来源：${f.sources.map(s => `[${s.title}](${s.url})`).join('；')}`); });
    (r.passes || []).forEach(p => L.push(`- ✅ ${p}`));
  });
  L.push('', '---', '本报告由 AI 生成，仅供参考；高风险结论建议结合当地团队人工复核。');
  return L.join('\n');
}
function download(name: string, data: BlobPart, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function pngExport() {
  const { toPng } = await import('html-to-image');
  // 生成一张竖版圈注长图：每个市场一张带框原图 + 要点
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;background:#FBF6EE;padding:28px;font-family:inherit';
  host.innerHTML = `<h2 class="display" style="font-size:28px;margin-bottom:6px">${esc(productName())} · 文化体检</h2><p class="muted" style="margin-bottom:18px;font-weight:600">${ms().map(m => `${MK_SHORT[m]} ${resOf(rep, m)!.score}`).join(' · ')}</p>` +
    ms().map(m => { const r = resOf(rep, m)!; const fs = orderFindings(r.findings);
      return `<div class="card" style="display:grid;grid-template-columns:330px 1fr;gap:18px;padding:16px;margin-bottom:16px;border-radius:20px"><div class="shot" style="width:330px;aspect-ratio:${job.image.w}/${job.image.h}"><img src="${job.image.dataUrl}" alt="">${boxesHTML(rep.elements, fs)}</div><div><h3 style="display:flex;align-items:center;gap:8px;font-size:20px"><img src="${mkImg(m)}" style="width:32px">${MK_SHORT[m]} · ${r.score} 分</h3>${fs.map((f, i) => `<p style="margin-top:10px;font-size:13px"><b>${i + 1}. [${LV_SHORT[f.level]}] ${esc(f.title)}</b><br><span style="color:var(--ink-2)">建议：${esc(f.suggestion)}</span></p>`).join('') || '<p class="muted" style="margin-top:10px">未发现问题</p>'}</div></div>`; }).join('');
  document.body.appendChild(host);
  try { await Promise.all([...host.querySelectorAll('img')].map(i => (i as HTMLImageElement).decode().catch(() => {}))); download(`culture-check-${job.id}.png`, await (await fetch(await toPng(host, { pixelRatio: 2, cacheBust: true }))).blob(), 'image/png'); }
  finally { host.remove(); }
}

(async () => {
  ({ job, rep, demo } = await loadContext());
  renderCards(); renderMatrix(); renderAfter(); renderExport();
})();
$('#mxSeg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; mxMode = b.dataset.v as any; $$('#mxSeg button').forEach(x => x.classList.toggle('on', x === b)); renderMatrix(); });
$('#opts').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('.op'); if (!b) return; fmt = b.dataset.v!; $$('#opts .op').forEach(x => x.classList.toggle('on', x === b)); renderExport(); });
$('#langSeg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b || b.dataset.v === 'zh') return; toast('v1 报告先支持中文，英文 / 日文版在路线图中', 'info'); });
$('#copyLink').addEventListener('click', async () => { const u = $('#copyLink').dataset.url; if (!u) return toast('真实分析结果只保存在本浏览器，请导出 JSON 分享', 'info'); try { await navigator.clipboard.writeText(u); toast('链接已复制', 'ok'); } catch { prompt('复制链接', u); } });
$('#dlBtn').addEventListener('click', async () => {
  if (fmt === 'pdf') return window.print();
  if (fmt === 'png') { toast('正在生成长图…'); try { await pngExport(); toast('已下载 PNG', 'ok'); } catch (e) { console.error(e); toast('长图生成失败', 'err'); } return; }
  download(`culture-check-${job.id}.md`, markdown(), 'text/markdown');
  const { elements, results, fixedScores, models } = rep;
  download(`culture-check-${job.id}.json`, JSON.stringify({ product: { category: job.category, channel: job.channel, copy: job.copyText }, markets: job.markets, elements, results, fixedScores, models, rulesVersion: `v1 (${RULES.length})` }, null, 2), 'application/json');
  toast('已下载 Markdown 与 JSON', 'ok');
});
