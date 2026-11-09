import { boxStyle, persist, ICON } from '../lib/common';
import { $, esc, mountTopbar, openSettings, toast, LV_SHORT } from '../lib/shell';
import { loadJob } from '../lib/store';
import { loadSettings, hasLive } from '../lib/settings';
import { runLive } from '../lib/pipeline';
import { presetReport, presetMarkets } from '../lib/presets';
import { demoJob } from '../lib/demo';
import { MK_SHORT, mkImg } from '../lib/rules';
import type { AgentEvent, Element, Job, Market, Report } from '../lib/types';
import { ApiError } from '../lib/api';

mountTopbar(2);
const AG = [
  { k: 'chief', n: '主诊医生', img: 'agent-chief', wait: '准备拆解任务' },
  { k: 'vision', n: '视觉侦察员', img: 'agent-vision', wait: '等待图片' },
  { k: 'culture', n: '文化顾问', img: 'agent-culture', wait: '等待视觉结果' },
  { k: 'compliance', n: '合规守卫', img: 'agent-compliance', wait: '等待视觉结果' },
  { k: 'decision', n: '决策官', img: 'agent-decision', wait: '等待复核结论' },
  { k: 'fix', n: '修图艺术家', img: 'agent-fix', wait: '出报告后可一键修图' },
] as const;
type St = { cls: string; sub: string; st: string; pct?: number };
const state: Record<string, St> = {};
let job: Job, els: Element[] = [], hits = 0, t0 = 0, finished = false;
const mk: Record<string, { started: number; done: number; hits: number; worst: number }> = {};

function card(k: string) {
  const a = AG.find(x => x.k === k)!, s = state[k];
  return `<div class="agc ${s.cls}" data-k="${k}"><img src="${ICON(a.img)}" alt=""><div><b>${a.n}</b><small>${esc(s.sub)}</small></div><span class="st ${s.cls === 'wait' ? 'muted' : ''}">${esc(s.st)}</span>${s.cls === 'run' && s.pct != null ? `<div class="bar"><i style="width:${s.pct}%"></i></div>` : ''}</div>`;
}
const renderPipe = () => ($('#pipe').innerHTML = AG.map(a => card(a.k)).join(''));
function set(k: string, p: Partial<St>) { state[k] = { ...state[k], ...p }; renderPipe(); }
const secs = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
function log(e: AgentEvent) {
  const tag = e.market ? `${e.agent}.${e.market.toLowerCase()}` : e.agent;
  const l = $('#log'); l.insertAdjacentHTML('beforeend', `<div><b>[${tag}]</b> ${esc(e.msg || (e.status === 'start' ? '开始比对' : e.status === 'done' ? '完成' : ''))}${e.status === 'done' ? ' <i>✓</i>' : ''}</div>`); l.scrollTop = l.scrollHeight;
}
function feed(title: string, m: Market | undefined, level: string, icon: string, pass = false) {
  const f = $('#feed'); f.querySelector('.fi-empty')?.remove();
  f.querySelectorAll('.fi.new').forEach(x => x.classList.remove('new'));
  f.insertAdjacentHTML('afterbegin', `<div class="fi ${pass ? '' : 'new'}" ${pass ? 'style="opacity:.75"' : ''}><img src="${ICON(icon)}" alt=""><div><b>${esc(title)}</b><div class="row"><img src="${m ? mkImg(m) : ICON('risk-religion')}" style="width:20px;height:20px;padding:0;background:none" alt=""><small>${m ? MK_SHORT[m] : '全部市场'} · ${secs()}</small><span class="tag ${pass ? 'low' : level}">${pass ? '通过' : (LV_SHORT as any)[level]}</span></div></div></div>`);
}
function renderMprog() {
  $('#mprog').innerHTML = job.markets.map(m => {
    const s = mk[m]; const p = finished ? 100 : Math.min(95, Math.round(15 + (s.started ? 70 * s.done / Math.max(2, s.started) : 0) + s.hits * 3));
    const c = s.worst === 0 ? 'var(--coral)' : s.worst === 1 ? 'var(--amber)' : 'var(--mint)';
    return `<div><img src="${mkImg(m)}" alt=""><b>${MK_SHORT[m]}</b><span class="pbar"><i style="width:${p}%;background:${c}"></i></span><small>${p}%</small></div>`;
  }).join('');
}
let prog = 2;
function setProg(p: number) { prog = Math.max(prog, Math.min(100, Math.round(p))); $('#progBar').style.width = prog + '%'; $('#progNum').textContent = prog + '%'; }
function drawPending() {
  const shot = $('#shot'); shot.querySelectorAll('.box').forEach(b => b.remove());
  const veil = shot.querySelector('.scanveil')!;
  els.filter(e => e.bbox).forEach(e => veil.insertAdjacentHTML('beforebegin', `<div class="box pending enter" data-e="${e.id}" style="${boxStyle(e.bbox!)}"><span class="lb ${e.bbox![0] > 620 ? 'l' : ''}">${esc(e.label.slice(0, 12))}</span></div>`));
  requestAnimationFrame(() => shot.querySelectorAll('.box.enter').forEach(b => b.classList.remove('enter')));
}
let nBox = 0;
function markBox(elId: string, level: string, label: string) {
  const b = $(`#shot .box[data-e="${elId}"]`); if (!b) return;
  const order = ['high', 'mid', 'low']; const cur = order.find(l => b.classList.contains('c-' + l));
  if (cur && order.indexOf(cur) <= order.indexOf(level)) return;
  if (!b.querySelector('.n')) b.insertAdjacentHTML('afterbegin', `<span class="n">${++nBox}</span>`);
  b.classList.remove('pending', 'c-high', 'c-mid', 'c-low'); b.classList.add('c-' + level);
  const lb = b.querySelector('.lb'); if (lb) lb.textContent = label.length > 12 ? label.slice(0, 11) + '…' : label;
}

function onEvent(e: AgentEvent) {
  log(e);
  const k = e.agent;
  if (k === 'chief') {
    if (e.status === 'start') { set('chief', { cls: 'run', sub: e.msg, st: '…' }); $('#brief').textContent = `${e.msg}，视觉侦察员先上。`; setProg(5); }
    if (e.status === 'progress' && e.market) $('#brief').textContent = e.msg;
    if (e.status === 'done') { set('chief', { cls: 'done', sub: e.msg, st: '✓ ' + secs() }); }
  }
  if (k === 'vision') {
    if (e.status === 'start') { set('vision', { cls: 'run', sub: e.msg, st: '…', pct: 30 }); setProg(10); }
    if (e.status === 'done') { set('vision', { cls: 'done', sub: e.msg, st: '✓ ' + secs() }); els = e.data || []; drawPending(); setProg(30);
      $('#brief').textContent = `视觉侦察员${e.msg}，已分发给文化顾问与合规守卫并行比对。`; }
  }
  if ((k === 'culture' || k === 'compliance') && e.market) {
    const s = mk[e.market];
    if (e.status === 'start') s.started++;
    if (e.status === 'done') s.done++;
    if (e.status === 'hit') {
      s.hits++; hits++; const d = e.data || {}; s.worst = Math.min(s.worst, ['high', 'mid', 'low'].indexOf(d.level));
      feed(d.title || e.msg, e.market, d.level, d.icon || 'risk-text'); markBox(d.elementId, d.level, d.title || '');
      $('#feedTag').textContent = `${hits} 项待确认`;
      $('#brief').textContent = `${MK_SHORT[e.market]}市场发现：${d.title}，正在核对规则来源。`;
    }
    if (e.status === 'progress' && e.data?.pass) feed(e.msg, e.market, 'low', k === 'compliance' ? 'risk-food' : 'risk-religion', true);
    const all = job.markets.reduce((a, m) => a + mk[m].done, 0), tot = Math.max(1, job.markets.reduce((a, m) => a + mk[m].started, 0));
    const pct = Math.round(100 * all / tot);
    const running = job.markets.find(m => mk[m].done < mk[m].started);
    for (const kk of ['culture', 'compliance'] as const) {
      if (k !== kk) continue;
      const fin = job.markets.every(m => mk[m].done >= mk[m].started) && all >= tot;
      set(kk, fin ? { cls: 'done', sub: `${job.markets.length} 个市场比对完成`, st: '✓ ' + secs() } : { cls: 'run', sub: running ? `正在比对：${MK_SHORT[running]} · ${kk === 'culture' ? '文化规则' : '合规清单'}` : e.msg, st: pct + '%', pct });
    }
    setProg(30 + 45 * all / tot); renderMprog();
  }
  if (k === 'decision') {
    if (e.status === 'start') { set('decision', { cls: 'run', sub: e.msg, st: '…', pct: 40 }); $('#brief').textContent = `复核完成，交给决策官逐条仲裁：保留概率、风险等级、最佳替换方案。`; setProg(80); }
    if (e.status === 'done') { set('decision', { cls: 'done', sub: e.msg, st: '✓ ' + secs() }); setProg(92); }
  }
}

async function finish(rep: Report) {
  finished = true; renderMprog(); setProg(100);
  $('.scan-stage').classList.add('finished');
  if (state.decision.cls === 'wait') set('decision', { cls: 'done', sub: '没有需要仲裁的结论', st: '✓' });
  set('fix', { cls: 'wait', sub: '报告页可一键生成修正版', st: '待命' });
  $('#scanTitle').textContent = '体检完成，正在生成报告…';
  $('#brief').textContent = `全部完成：${rep.results.map(r => `${MK_SHORT[r.market]} ${r.score} 分`).join('，')}。`;
  await persist(job, rep);
  setTimeout(() => (location.href = 'result.html'), 1100);
}
function showError(err: unknown) {
  const e = err as ApiError;
  const running = Object.keys(state).find(k => state[k].cls === 'run');
  if (running) set(running, { cls: 'err', sub: '出错', st: '失败' });
  $('.scan-stage').classList.add('finished');
  $('#scanTitle').textContent = '体检中断';
  const host = $('#pipe').parentElement!;
  host.querySelector('.an-err')?.remove();
  host.insertAdjacentHTML('beforeend', `<div class="an-err"><b>${esc(e.message || String(err))}</b>${esc(e.hint || '')}<div><button class="btn btn-coral btn-sm" id="retry">重试</button><button class="btn btn-ghost btn-sm" id="cfg">检查 Key 设置</button><button class="btn btn-ghost btn-sm" id="demoRun">改用演示数据</button></div></div>`);
  $('#retry').onclick = () => location.reload();
  $('#cfg').onclick = () => openSettings();
  $('#demoRun').onclick = async () => { job = { ...demoJob(job.markets), image: demoJob().image }; const { saveJob } = await import('../lib/store'); await saveJob(job); location.reload(); };
}

(async () => {
  job = (await loadJob()) || demoJob();
  if (job.mode === 'demo') { const pm = presetMarkets(job); if (pm.join() !== job.markets.join()) { job = { ...job, markets: pm }; toast(`演示录制只覆盖 ${pm.map(m => MK_SHORT[m]).join(' / ')}，已按此回放`, 'info', 4500); } }
  AG.forEach(a => (state[a.k] = { cls: 'wait', sub: a.wait, st: '排队中' }));
  job.markets.forEach(m => (mk[m] = { started: 0, done: 0, hits: 0, worst: 9 }));
  renderPipe(); renderMprog();
  $('#feed').innerHTML = `<div class="fi fi-empty" style="opacity:.7"><img src="${ICON('agent-vision')}" alt=""><div><b>等待视觉侦察员的识别结果…</b><div class="row"><small>元素定位完成后，各市场的发现会实时出现在这里</small></div></div></div>`;
  ($('#shotImg') as HTMLImageElement).src = job.image.dataUrl;
  $('#parTag').textContent = `并行 ${job.markets.length} 个市场`;
  $('#scanSub').textContent = `${job.image.name} · ${job.markets.map(m => MK_SHORT[m]).join(' / ')} · ${job.mode === 'demo' ? '演示回放' : '真实分析'}`;
  t0 = performance.now();
  const live = job.mode === 'live' && hasLive();
  if (job.mode === 'live' && !live) toast('未检测到 Key，已切换为演示回放', 'info');
  if (live) {
    try { const rep = await runLive(loadSettings(), job, onEvent); if (rep.warnings?.length) toast(rep.warnings[0], 'info', 5000); await finish(rep); }
    catch (e) { console.error(e); showError(e); }
    return;
  }
  if (job.mode !== 'demo') { job = { ...job, mode: 'demo', demoId: 'tea', image: demoJob().image }; ($('#shotImg') as HTMLImageElement).src = job.image.dataUrl; }
  const rep = presetReport(job);
  const evs = rep.events.filter(e => !e.market || job.markets.includes(e.market));
  const speed = 1;
  evs.forEach(e => setTimeout(() => onEvent(e), e.t * speed));
  setTimeout(() => finish({ ...rep, results: rep.results.filter(r => job.markets.includes(r.market)) }), (evs.at(-1)?.t || 0) * speed + 300);
})();
