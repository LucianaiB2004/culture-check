import '../lib/common';
import { $, $$, esc, mountTopbar, LV_NAME } from '../lib/shell';
import { RULES, MARKETS, MK_SHORT, mkImg } from '../lib/rules';
import { ICON } from '../lib/common';

mountTopbar(-1);
let mk = '', kind = '';
const CAT: Record<string, string> = { number: '数字', flower: '花卉', color: '颜色', gesture: '手势', text: '文字与标签', symbol: '符号 / 宗教', food: '饮食' };
$('#rCount').textContent = `规则库 v1 · ${RULES.length} 条 · ${MARKETS.length} 个市场 · ${new Set(RULES.flatMap(r => r.sources.map(s => s.url))).size} 个来源`;
function render() {
  $('#rMk').innerHTML = `<button class="${mk === '' ? 'on' : ''}" data-m="">全部市场</button>` + MARKETS.map(m => `<button class="${mk === m.id ? 'on' : ''}" data-m="${m.id}"><img src="${mkImg(m.id)}" alt="">${m.name}<span class="muted" style="font-size:11px">${RULES.filter(r => r.market === m.id).length}</span></button>`).join('');
  const list = RULES.filter(r => (!mk || r.market === mk) && (!kind || r.kind === kind));
  $('#rGrid').innerHTML = list.map(r => `<article class="card rcard">
    <div class="rh"><img src="${ICON(r.icon)}" alt=""><div><b>${esc(r.title)}</b><small><img src="${mkImg(r.market)}" alt="">${MK_SHORT[r.market]} · ${r.kind === 'culture' ? '文化' : '合规'} · ${CAT[r.category] || r.category}</small></div><span class="tag ${r.level}">${LV_NAME[r.level]}</span></div>
    <p>${esc(r.reason)}</p>
    <div class="fix"><b>建议</b><span>${esc(r.suggestion)}</span></div>
    <div class="src"><code>${r.id}</code>${r.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join('')}</div>
  </article>`).join('') || '<p class="muted">没有匹配的规则</p>';
  $$('#rKind button').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
}
render();
$('#rMk').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; mk = b.dataset.m!; render(); });
$('#rKind').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; kind = b.dataset.k!; render(); });
