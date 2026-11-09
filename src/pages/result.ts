import { loadContext, persist, resOf, boxesHTML, orderFindings, scoreColor, scoreClass, fitShot, ICON } from '../lib/common';
import { $, $$, esc, mountTopbar, toast, openSettings, LV_NAME, LV_SHORT, LV_COLOR, LAUNCH_NAME } from '../lib/shell';
import { MK_SHORT, mkImg, ruleById, MARKETS } from '../lib/rules';
import { loadSettings, hasLive } from '../lib/settings';
import { runFix } from '../lib/pipeline';
import type { Finding, Job, Market, Report } from '../lib/types';

mountTopbar(3);
let job: Job, rep: Report, demo = false;
let cur: Market, view: 'mark' | 'fixed' | 'cmp' = 'mark', filter: 'all' | Finding['level'] = 'all', sel = '', expanded = false, zoom = 1;
const CAT_NAME: Record<string, string> = { number: '数字', flower: '花卉 / 颜色', color: '颜色', gesture: '手势', text: '文字', symbol: '符号 / 宗教', food: '饮食', compliance: '合规' };

const findings = () => orderFindings(resOf(rep, cur)?.findings || []);
function renderSeg() {
  $('#mkSeg').innerHTML = job.markets.filter(m => resOf(rep, m)).map(m => { const s = resOf(rep, m)!.score; return `<button class="${m === cur ? 'on' : ''}" data-m="${m}"><img src="${mkImg(m)}" alt="">${MK_SHORT[m]} <span class="tag ${scoreClass(s)}" style="height:18px">${s}</span></button>`; }).join('');
  $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
}
function renderImage() {
  const body = $('#imgBody'), shot = $('#shot'), img = $('#shotImg') as HTMLImageElement;
  const fs = findings();
  shot.querySelectorAll('.box,.big-cmp-x').forEach(b => b.remove());
  shot.style.transform = `scale(${zoom})`;
  const fixed = rep.fixedImage;
  if (view === 'mark' || !fixed) {
    img.src = job.image.dataUrl;
    shot.insertAdjacentHTML('beforeend', boxesHTML(rep.elements, fs, sel, f => filter === 'all' || f.level === filter));
    if (view !== 'mark' && !fixed) toast('还没有修正版，点右侧「一键应用全部替换建议」生成', 'info');
  } else if (view === 'fixed') {
    img.src = fixed;
  } else {
    img.src = job.image.dataUrl;
    shot.insertAdjacentHTML('beforeend', `<img class="big-cmp-x" src="${fixed}" alt="修正版" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;clip-path:inset(0 0 0 50%)"><span class="big-cmp-x" style="position:absolute;left:50%;top:0;bottom:0;width:3px;background:#fff;box-shadow:0 0 12px rgba(0,0,0,.25)"></span>`);
  }
  const c = { high: 0, mid: 0, low: 0 } as Record<string, number>; fs.forEach(f => c[f.level]++);
  const fr = resOf(rep, cur, true);
  $('#legend').innerHTML = view === 'mark' || !fixed
    ? `<span><i style="background:var(--coral)"></i>高风险 ${c.high}</span><span><i style="background:var(--amber)"></i>中风险 ${c.mid}</span><span><i style="background:var(--mint)"></i>提示 ${c.low}</span>`
    : `<span><i style="background:var(--mint)"></i>修正版${fr ? ` · 复检剩余 ${fr.findings.length} 处` : ''}</span>${view === 'cmp' ? '<span>左：原图 · 右：修正版</span>' : ''}`;
  void body;
}
function srcLinks(f: Finding) {
  const s = f.sources?.length ? f.sources : ruleById(f.ruleId)?.sources || [];
  return s.slice(0, 2).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(' · ');
}
function renderList() {
  const fs = findings(); const r = resOf(rep, cur)!;
  ($('#lhImg') as HTMLImageElement).src = mkImg(cur);
  $('#lhTitle').textContent = `${MARKETS.find(m => m.id === cur)!.name}市场 · ${fs.length} 处发现`;
  $('#expandAll').textContent = expanded ? '收起提示' : '全部展开';
  const c = { high: 0, mid: 0, low: 0 } as Record<string, number>; fs.forEach(f => c[f.level]++);
  $('#filters').innerHTML = [['all', `全部 ${fs.length}`], ['high', `高 ${c.high}`], ['mid', `中 ${c.mid}`], ['low', `提示 ${c.low}`]].map(([k, t]) => `<span class="${filter === k ? 'on' : ''}" data-f="${k}">${t}</span>`).join('');
  const shown = fs.map((f, i) => ({ f, i })).filter(x => filter === 'all' || x.f.level === filter);
  $('#rlist').innerHTML = shown.length ? shown.map(({ f, i }) => {
    const compact = f.level === 'low' && !expanded && f.id !== sel;
    const kp = f.decision ? Math.round(f.decision.keepProb * 100) : null;
    const el = rep.elements.find(e => e.id === f.elementId);
    return `<div class="rc ${f.id === sel ? 'sel' : ''} ${compact ? 'compact' : ''}" data-f="${f.id}">
      <div class="rc-h"><img src="${ICON(f.icon)}" alt=""><div><b><span class="rc-n" style="background:${LV_COLOR[f.level]}">${i + 1}</span>${esc(f.title)}</b><small>${esc(CAT_NAME[ruleById(f.ruleId)?.category || ''] || el?.category || '')} · ${esc(f.where)}</small></div><span class="tag ${f.review ? 'rv' : f.level}">${f.review ? '建议人工确认' : LV_NAME[f.level]}</span></div>
      <p>${esc(f.reason)}</p>
      <div class="fix"><b>替换建议</b><span>${esc(f.suggestion)}</span></div>
      <div class="src">来源：${srcLinks(f)} · 置信度 ${f.confidence.toFixed(2)}</div>
      ${kp != null ? `<div class="dm"><img src="${ICON('agent-decision')}" alt="">决策官 · 保留概率 <b>${kp}%</b><span class="pbar"><i style="width:${kp}%"></i></span></div>` : ''}
    </div>`;
  }).join('') : `<div class="rc"><div class="rc-h"><img src="${ICON('risk-compliance')}" alt=""><div><b>该市场没有发现需要处理的问题</b><small>${(r.passes || []).map(esc).join(' · ') || '规则库与模型复核均未命中'}</small></div><span class="tag low">通过</span></div></div>`;
}
function renderScore() {
  const r = resOf(rep, cur)!; const fs = r.findings; const s = r.score;
  const c = { high: 0, mid: 0, low: 0 } as Record<string, number>; fs.forEach(f => c[f.level]++);
  const verdict = s < 60 ? ['high', '需整改后再上架', '体检未通过'] : s < 90 ? ['mid', '建议修改后上架', '有风险需处理'] : ['low', '可以上架', '体检通过'];
  const L = r.launch;
  $('#score').innerHTML = `<div class="top"><div class="big" style="--p:${s};background:conic-gradient(${scoreColor(s)} calc(var(--p)*1%),var(--bg-2) 0)"><span><div><b class="num">${s}</b><small>/ 100</small></div></span></div>
    <div><span class="tag ${verdict[0]}">${verdict[1]}</span><h4 style="margin-top:6px">${MARKETS.find(m => m.id === cur)!.name}市场<br>${verdict[2]}</h4></div></div>
    <div class="cnt"><div style="background:var(--coral-50)"><b class="num" style="color:#E2362B">${c.high}</b><small style="color:#E2362B">高风险</small></div><div style="background:var(--amber-50)"><b class="num" style="color:#B97200">${c.mid}</b><small style="color:#B97200">中风险</small></div><div style="background:var(--mint-50)"><b class="num" style="color:#178A60">${c.low}</b><small style="color:#178A60">提示</small></div></div>
    ${L ? `<div class="launch"><img src="${ICON('agent-decision')}" alt="">上架决策：<b>${LAUNCH_NAME[L.choice]}</b>${L.prob ? `<span class="muted">· 置信度 ${Math.round(L.prob * 100)}%</span>` : ''}</div>` : ''}`;
}
function renderSplit() {
  const a = $('#baA') as HTMLImageElement, b = $('#baB') as HTMLImageElement, split = $('#split');
  a.src = job.image.dataUrl; split.querySelector('.ph')?.remove();
  const s = resOf(rep, cur)!.score;
  $('#lblA').textContent = `原图 ${s}`;
  if (rep.fixedImage) { b.style.display = ''; b.src = rep.fixedImage; $('#lblB').style.display = ''; $('#lblB').textContent = `修正版 ${rep.fixedScores?.[cur] ?? '—'}`; $('#handle').style.display = ''; }
  else { b.style.display = 'none'; $('#lblB').style.display = 'none'; $('#handle').style.display = 'none';
    split.insertAdjacentHTML('beforeend', `<div class="ph" style="clip-path:none;background:rgba(251,246,238,.55)"><span style="background:#fff;border-radius:12px;padding:8px 10px;box-shadow:var(--sh-1)">还没有修正版<br>点下方按钮，由修图艺术家按替换建议生成</span></div>`); }
  $('#fixBtn span').textContent = rep.fixedImage ? (demo ? '查看修正版（演示）' : '重新生成修正版') : '一键应用全部替换建议';
}
const renderAll = () => { renderSeg(); renderImage(); renderList(); renderScore(); renderSplit(); };

function select(id: string, scroll = true) {
  sel = sel === id ? '' : id; renderImage(); renderList();
  if (scroll && sel) $(`.rc[data-f="${sel}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

(async () => {
  ({ job, rep, demo } = await loadContext());
  const ms = job.markets.filter(m => resOf(rep, m));
  cur = (new URLSearchParams(location.search).get('m') as Market) || ms.slice().sort((a, b) => resOf(rep, a)!.score - resOf(rep, b)!.score)[0];
  if (!ms.includes(cur)) cur = ms[0];
  sel = findings()[0]?.id || '';
  fitShot($('#shot'), job.image.w, job.image.h);
  fitShot($('#split'), job.image.w, job.image.h, 0);
  renderAll();
  if (rep.warnings?.length) $('#rlist').insertAdjacentHTML('beforebegin', `<div class="warn-bar" style="margin:0 16px 8px">${esc(rep.warnings[0])}</div>`);
})();

$('#mkSeg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; cur = b.dataset.m as Market; filter = 'all'; sel = findings()[0]?.id || ''; renderAll(); });
$('#viewSeg').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; view = b.dataset.v as any; renderSeg(); renderImage(); });
$('#filters').addEventListener('click', e => { const s = (e.target as HTMLElement).closest<HTMLElement>('span'); if (!s) return; filter = s.dataset.f as any; renderImage(); renderList(); });
$('#rlist').addEventListener('click', e => { if ((e.target as HTMLElement).closest('a')) return; const c = (e.target as HTMLElement).closest<HTMLElement>('.rc'); if (c?.dataset.f) select(c.dataset.f, false); });
$('#shot').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('.box'); if (b?.dataset.f) { if (view !== 'mark') return; select(b.dataset.f); } });
$('#expandAll').addEventListener('click', () => { expanded = !expanded; renderList(); });
$('#zin').addEventListener('click', () => { zoom = Math.min(2.2, zoom + 0.2); renderImage(); });
$('#zout').addEventListener('click', () => { zoom = Math.max(0.6, zoom - 0.2); renderImage(); });

// 对比滑杆
const split = $('#split');
const setSplit = (x: number) => { const r = split.getBoundingClientRect(); const p = Math.max(0, Math.min(100, (x - r.left) / r.width * 100)); ($('#baB') as HTMLElement).style.clipPath = `inset(0 0 0 ${p}%)`; $('#handle').style.left = p + '%'; };
split.addEventListener('pointerdown', e => { if (!rep?.fixedImage) return; split.setPointerCapture(e.pointerId); setSplit(e.clientX); const mv = (ev: PointerEvent) => setSplit(ev.clientX); split.addEventListener('pointermove', mv); split.addEventListener('pointerup', () => split.removeEventListener('pointermove', mv), { once: true }); });

$('#fixBtn').addEventListener('click', async () => {
  if (demo || job.mode === 'demo') {
    if (rep.fixedImage) { view = 'cmp'; renderSeg(); renderImage(); return toast('演示数据：修正版为预置结果。配置 Key 后可对你自己的图片真实生成', 'info', 4500); }
    return toast('演示数据没有修正版，配置 Key 后可真实生成', 'info');
  }
  if (!hasLive()) return openSettings();
  const btn = $('#fixBtn') as HTMLButtonElement; const span = btn.querySelector('span')!;
  btn.disabled = true;
  try {
    rep = await runFix(loadSettings(), job, rep, msg => (span.textContent = msg));
    await persist(job, rep); view = 'cmp'; renderAll();
    toast(`修正版已生成，复检后 ${MK_SHORT[cur]} ${resOf(rep, cur)!.score} → ${rep.fixedScores?.[cur]}${rep.fixSkipped?.length ? `；另有 ${rep.fixSkipped.length} 条需线下处理（换品 / 补真实标签 / 改文案）` : ''}`, 'ok', 7000);
  } catch (e: any) { toast(`修图失败：${e.message}${e.hint ? '（' + e.hint + '）' : ''}`, 'err', 6000); renderSplit(); }
  finally { btn.disabled = false; }
});
