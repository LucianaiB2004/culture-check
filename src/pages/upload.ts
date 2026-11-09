import '../lib/common';
import { $, $$, esc, mountTopbar, openSettings, prepImage, fmtSize, toast, refreshChip } from '../lib/shell';
import { MARKETS, CATEGORIES, rulesFor, mkImg, MK_SHORT } from '../lib/rules';
import { loadSettings, saveSettings, hasLive } from '../lib/settings';
import { saveJob, clearReport } from '../lib/store';
import type { Job, Market } from '../lib/types';
import { DEMO_IMAGE } from '../lib/demo';

mountTopbar(1);
const S = { markets: new Set<Market>(['JP', 'BR', 'SA']), cats: new Set<string>(CATEGORIES.map(c => c.id)), sample: 'tea' as string | null,
  image: { dataUrl: DEMO_IMAGE, w: 864, h: 1152, name: 'tea-gift-set.jpg', size: 1258291 } };
const SAMPLES: Record<string, { src: string; name: string; size: number; cat: string; copy: string; markets: Market[] }> = {
  tea: { src: DEMO_IMAGE, name: 'tea-gift-set.jpg', size: 1258291, cat: '礼品 · 茶具套装', copy: 'Lucky 4 Set – Premium porcelain tea gift box, perfect for weddings & housewarming.', markets: ['JP', 'BR', 'SA'] },
  jerky: { src: 'assets/demo-product-2.webp', name: 'beef-jerky-party.jpg', size: 1048576, cat: '食品 · 肉类零食', copy: 'Premium Beef Jerky Party Pack – 100% beef, smoky BBQ flavor. Made in USA quality!', markets: ['IN', 'SA', 'US'] },
};
// 演示模式：没有 Key 时强制；有 Key 时由开关决定
let demo = !hasLive() || loadSettings().demoForced;

function renderMarkets() {
  $('#mkGrid').innerHTML = MARKETS.map(m => `<div class="mkc ${S.markets.has(m.id) ? 'on' : ''}" data-m="${m.id}" role="checkbox" aria-checked="${S.markets.has(m.id)}" tabindex="0"><span class="chk"></span><img src="${mkImg(m.id)}" alt=""><b>${m.name}</b><small>${m.hint}</small></div>`).join('');
  $('#mkCount').textContent = `已选 ${S.markets.size} / 6`;
  $('#parTagNone')?.remove();
}
function renderCats() {
  $('#catRow').innerHTML = CATEGORIES.map(c => `<span class="rkc ${S.cats.has(c.id) ? 'on' : ''}" data-c="${c.id}" role="checkbox" aria-checked="${S.cats.has(c.id)}" tabindex="0"><img src="assets/${c.icon}.webp" alt="">${c.name}</span>`).join('');
  $('#allCat').textContent = S.cats.size === CATEGORIES.length ? '清空' : '全选';
}
function renderRules() {
  const cats = CATEGORIES.filter(c => S.cats.has(c.id)).flatMap(c => c.match as readonly string[]);
  const rs = [...S.markets].flatMap(m => rulesFor(m)).filter(r => cats.includes(r.category) || (cats.includes('compliance') && r.kind === 'compliance'));
  const lvO = { high: 0, mid: 1, low: 2 } as const;
  const top = rs.sort((a, b) => lvO[a.level] - lvO[b.level]).slice(0, 4);
  $('#rules').innerHTML = `<div class="rh"><img src="assets/agent-culture.webp" alt="">文化顾问预告：本次将重点比对<span class="sp"></span><a class="tag ai" href="rules.html" title="查看完整规则库">规则库 v1 · 命中范围 ${rs.length} 条 →</a></div>` +
    (top.length ? top.map(r => `<div class="rule"><img src="${mkImg(r.market)}" alt=""><div><b>${MK_SHORT[r.market]} · ${esc(r.title)}</b><small>来源：${esc(r.sources[0]?.title || '')}</small></div><span class="tag ${r.level}">${{ high: '高', mid: '中', low: '低' }[r.level]}</span></div>`).join('')
      : `<div class="rule empty"><div><b>请至少选择 1 个市场和 1 类检查</b></div></div>`);
  const sec = Math.round(20 + S.markets.size * 6);
  $('#actHint').textContent = `1 张图 × ${S.markets.size} 个市场 × ${S.cats.size} 类检查 · ${demo ? '演示回放约 12 秒' : `预计 ${sec}–${sec + 25} 秒`}`;
}
function renderMode() {
  const live = hasLive();
  $('#modeTg').classList.toggle('off', !demo);
  $('#modeTxt').textContent = demo ? (live ? '演示模式（点此切换为真实分析）' : '演示模式（预置结果，无需 Key）') : '真实分析（使用你配置的 Key）';
  renderRules();
}
function setImage(img: typeof S.image, sample: string | null) {
  S.image = img; S.sample = sample;
  ($('#pvImg') as HTMLImageElement).src = img.dataUrl;
  $('#pvName').textContent = `${img.name} · ${fmtSize(img.size)}`;
  $$('.smp').forEach(e => e.classList.toggle('on', e.dataset.s === sample));
}
function useSample(k: string) {
  const s = SAMPLES[k];
  const im = new Image(); im.onload = () => setImage({ dataUrl: s.src, w: im.naturalWidth, h: im.naturalHeight, name: s.name, size: s.size }, k); im.src = s.src;
  ($('#cat') as HTMLSelectElement).value = s.cat; ($('#copy') as HTMLTextAreaElement).value = s.copy;
  S.markets = new Set(s.markets); renderMarkets(); renderRules();
}
async function useFile(f: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast('仅支持 JPG / PNG / WEBP', 'err');
  if (f.size > 10 * 1048576) return toast('图片超过 10MB', 'err');
  try { const img = await prepImage(f, f.name); setImage({ ...img, size: f.size }, null); if (demo && hasLive()) { demo = false; renderMode(); } toast(demo ? '已载入。当前为演示模式，将回放示例结果；配置 Key 后可真实分析' : '已载入，可以开始体检', 'ok'); }
  catch { toast('图片读取失败', 'err'); }
}

renderMarkets(); renderCats(); renderMode(); setImage(S.image, 'tea');

$('#mkGrid').addEventListener('click', e => { const c = (e.target as HTMLElement).closest<HTMLElement>('.mkc'); if (!c) return; const m = c.dataset.m as Market; S.markets.has(m) ? S.markets.delete(m) : S.markets.add(m); renderMarkets(); renderRules(); });
$('#catRow').addEventListener('click', e => { const c = (e.target as HTMLElement).closest<HTMLElement>('.rkc'); if (!c) return; const k = c.dataset.c!; S.cats.has(k) ? S.cats.delete(k) : S.cats.add(k); renderCats(); renderRules(); });
for (const id of ['#mkGrid', '#catRow']) $(id).addEventListener('keydown', e => { if ((e as KeyboardEvent).key === ' ' || (e as KeyboardEvent).key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).click(); } });
$('#allCat').addEventListener('click', () => { S.cats = S.cats.size === CATEGORIES.length ? new Set() : new Set(CATEGORIES.map(c => c.id)); renderCats(); renderRules(); });
$$('.smp').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); useSample(el.dataset.s!); }));

const file = $('#file') as HTMLInputElement, drop = $('#drop');
$('#pick').addEventListener('click', e => { e.stopPropagation(); file.click(); });
drop.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button,.smp')) return; file.click(); });
file.addEventListener('change', () => { if (file.files?.[0]) useFile(file.files[0]); file.value = ''; });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer?.files?.[0]; if (f) useFile(f); });
window.addEventListener('paste', e => { const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); const f = it?.getAsFile(); if (f) useFile(f); });
$('#pasteUrl').addEventListener('click', async e => {
  e.stopPropagation();
  const u = prompt('粘贴图片链接（需允许跨域访问的图片地址）'); if (!u) return;
  try { const r = await fetch(u); if (!r.ok) throw 0; const b = await r.blob(); await useFile(new File([b], u.split('/').pop()?.split('?')[0] || 'image.jpg', { type: b.type })); }
  catch { toast('该链接不允许跨域读取，请下载后上传', 'err', 4500); }
});
$('#modeBtn').addEventListener('click', () => {
  if (demo && !hasLive()) { openSettings(() => { refreshChip(); if (hasLive()) { demo = false; renderMode(); } }); return toast('真实分析需要先配置百炼 Key', 'info'); }
  demo = !demo; const s = loadSettings(); s.demoForced = demo; saveSettings(s); renderMode();
});
$('#start').addEventListener('click', async () => {
  if (!S.markets.size) return toast('请至少选择 1 个目标市场', 'err');
  if (!S.cats.size) return toast('请至少选择 1 类检查项目', 'err');
  if (demo && S.sample !== 'tea' && S.sample !== 'jerky') toast('演示模式将回放茶具礼盒的示例结果', 'info');
  const job: Job = { id: 'j' + Date.now().toString(36), image: S.image, markets: [...S.markets], categories: [...S.cats],
    category: ($('#cat') as HTMLSelectElement).value, channel: ($('#chan') as HTMLSelectElement).value, copyText: ($('#copy') as HTMLTextAreaElement).value.trim(),
    mode: demo ? 'demo' : 'live', demoId: demo ? (S.sample === 'jerky' ? 'jerky' : 'tea') : undefined, createdAt: new Date().toISOString() };
  if (!demo && !job.image.dataUrl.startsWith('data:')) {
    const b = await (await fetch(job.image.dataUrl)).blob(); job.image = { ...(await prepImage(b, job.image.name)), size: job.image.size };
  }
  if (demo && job.demoId === 'tea') job.image = { ...job.image, dataUrl: DEMO_IMAGE, name: 'tea-gift-set.jpg' };
  await saveJob(job); await clearReport();
  location.href = 'analyzing.html';
});
