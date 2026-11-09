import { loadSettings, saveSettings, clearSettings, hasLive, mask, DEFAULTS, type Settings } from './settings';
import { testBailian, testQianfan, ApiError } from './api';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[];
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const STEPS = ['上传图片', '选择市场', 'AI 会诊', '体检报告'];
export function chipText(s = loadSettings()) {
  if (!hasLive(s)) return { live: false, t: '演示模式 · 百炼 Key 未填' };
  return { live: true, t: `${s.provider === 'qianfan' && s.qianfanKey ? '千帆 + 百炼' : '百炼'}已配置 · 真实分析` };
}
export function mountTopbar(active: number) {
  const h = document.createElement('header'); h.className = 'topbar';
  const c = chipText();
  h.innerHTML = `<a class="brand" href="index.html"><img src="assets/logo.webp" alt=""><div><b>商品图文化体检</b><small>CultureCheck</small></div></a>
  <div class="steps">${STEPS.map((n, i) => `<div class="step ${i < active ? 'done' : i === active ? 'on' : ''}"><i>${i < active ? '✓' : i + 1}</i>${n}</div>`).join('')}</div>
  <div class="top-actions">
    <button class="chip-key" id="keyChip" title="API Key 设置"><img src="assets/icon-key.webp" alt=""><span class="dot ${c.live ? '' : 'off'}"></span><span class="t">${esc(c.t)}</span></button>
    <div class="avatar"><img src="assets/avatar-user.webp" alt=""></div>
  </div>`;
  document.querySelector('.app')!.prepend(h);
  $('#keyChip', h).addEventListener('click', () => openSettings());
}
export function refreshChip() {
  const c = chipText(); const chip = document.getElementById('keyChip'); if (!chip) return;
  chip.querySelector('.t')!.textContent = c.t; chip.querySelector('.dot')!.classList.toggle('off', !c.live);
}

let toastT: number | undefined;
export function toast(msg: string, kind: 'ok' | 'err' | 'info' = 'info', ms = 3200) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = `toast ${kind} show`; t.textContent = msg;
  clearTimeout(toastT); toastT = window.setTimeout(() => t!.classList.remove('show'), ms);
}

const fld = (id: string, label: string, val: string, ph = '', type = 'password', help = '') => `
  <div class="mfld"><label for="${id}">${label}</label><div class="minput"><input id="${id}" type="${type}" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false">${type === 'password' ? `<button type="button" class="eye" data-eye="${id}" title="显示/隐藏">👁</button>` : ''}</div>${help ? `<small>${help}</small>` : ''}</div>`;

export function openSettings(onSaved?: () => void, tab: 'bailian' | 'qianfan' = 'bailian') {
  const s = loadSettings();
  const m = document.createElement('div'); m.className = 'modal-mask';
  m.innerHTML = `<div class="modal card" role="dialog" aria-label="API Key 设置">
    <div class="mh"><img src="assets/icon-shield.webp" alt=""><div><h3 class="display">API Key 设置</h3><small>所有 Key 仅保存在本浏览器的 localStorage，前端直连模型接口，不经过任何第三方服务器</small></div><button class="mx-close" aria-label="关闭">✕</button></div>
    <div class="mtabs seg"><button data-tab="bailian"><img src="assets/agent-vision.webp" alt="">阿里云百炼</button><button data-tab="qianfan"><img src="assets/agent-culture.webp" alt="">百度千帆</button></div>
    <div class="mbody">
      <section data-pane="bailian">
        <div class="mnote"><b>必填 · 真实模式的主通道</b>一把 DashScope Key 覆盖视觉定位、文化复核、决策官仲裁和万相修图。</div>
        ${fld('bk', 'DashScope API Key', s.bailianKey, 'sk-… / sk-ws-…')}
        <div class="mfld"><label>地域</label><div class="seg mseg" data-k="region"><button data-v="cn-beijing">华北2 北京</button><button data-v="ap-southeast-1">新加坡</button></div><small>Key 在哪个地域创建就选哪个地域：北京走 dashscope.aliyuncs.com，新加坡走 dashscope-intl.aliyuncs.com。</small></div>
        <details class="madv"><summary>模型名（高级）</summary><div class="mrow3">${fld('vm', '视觉', s.visionModel, '', 'text')}${fld('rm', '复核 / 决策', s.reviewModel, '', 'text')}${fld('im', '修图', s.imageModel, '', 'text')}</div></details>
        <div class="mtest"><button class="btn btn-ghost btn-sm" data-test="bailian"><img src="assets/icon-plug.webp" alt="">测试连接</button><span class="tres" id="tr-bailian"></span></div>
      </section>
      <section data-pane="qianfan">
        <div class="mnote"><b>可选 · 视觉、复核与决策改走千帆</b>OpenAI 兼容接口 qianfan.baidubce.com/v2；修图仍使用百炼万相。</div>
        <div class="mfld"><label>视觉与复核供应商</label><div class="seg mseg" data-k="provider"><button data-v="bailian">阿里云百炼（默认）</button><button data-v="qianfan">百度千帆</button></div></div>
        ${fld('qk', '千帆 API Key', s.qianfanKey, 'bce-v3/…')}
        <div class="mrow">${fld('qvm', '视觉模型', s.qianfanVisionModel, '', 'text')}${fld('qtm', '复核模型', s.qianfanTextModel, '', 'text')}</div>
        <div class="mtest"><button class="btn btn-ghost btn-sm" data-test="qianfan"><img src="assets/icon-plug.webp" alt="">测试连接</button><span class="tres" id="tr-qianfan"></span></div>
      </section>
    </div>
    <div class="mf"><button class="btn btn-ghost btn-sm" id="mClear">清除全部 Key</button><span class="muted" style="font-size:12px;margin-left:4px" id="mStat"></span><span style="flex:1"></span><button class="btn btn-ghost btn-sm" id="mCancel">取消</button><button class="btn btn-primary btn-sm" id="mSave">保存设置</button></div>
  </div>`;
  document.body.appendChild(m);
  const st = { region: s.region, provider: s.provider };
  const setSeg = () => $$('.mseg', m).forEach(g => $$('button', g).forEach(b => b.classList.toggle('on', (st as any)[g.dataset.k!] === b.dataset.v)));
  setSeg();
  $$('.mseg button', m).forEach(b => b.addEventListener('click', () => { (st as any)[(b.parentElement as HTMLElement).dataset.k!] = b.dataset.v; setSeg(); }));
  const show = (t: string) => { $$('.mtabs button', m).forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('[data-pane]', m).forEach(p => (p.style.display = p.dataset.pane === t ? '' : 'none')); };
  show(tab);
  $$('.mtabs button', m).forEach(b => b.addEventListener('click', () => show(b.dataset.tab!)));
  $$('[data-eye]', m).forEach(b => b.addEventListener('click', () => { const i = $<HTMLInputElement>('#' + b.dataset.eye, m); i.type = i.type === 'password' ? 'text' : 'password'; }));
  const read = (): Settings => ({ ...s, ...st,
    bailianKey: $<HTMLInputElement>('#bk', m).value.trim(),
    visionModel: $<HTMLInputElement>('#vm', m).value.trim() || DEFAULTS.visionModel, reviewModel: $<HTMLInputElement>('#rm', m).value.trim() || DEFAULTS.reviewModel, imageModel: $<HTMLInputElement>('#im', m).value.trim() || DEFAULTS.imageModel,
    qianfanKey: $<HTMLInputElement>('#qk', m).value.trim(), qianfanVisionModel: $<HTMLInputElement>('#qvm', m).value.trim() || DEFAULTS.qianfanVisionModel, qianfanTextModel: $<HTMLInputElement>('#qtm', m).value.trim() || DEFAULTS.qianfanTextModel } as Settings);
  const stat = () => { const r = read(); $('#mStat', m).textContent = [r.bailianKey && `百炼 ${mask(r.bailianKey)}`, r.qianfanKey && `千帆 ${mask(r.qianfanKey)}`].filter(Boolean).join(' · ') || '尚未填写任何 Key'; };
  stat(); $$('input', m).forEach(i => i.addEventListener('input', stat));
  const close = () => { m.classList.add('out'); setTimeout(() => m.remove(), 160); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  $('.mx-close', m).addEventListener('click', close); $('#mCancel', m).addEventListener('click', close);
  $('#mClear', m).addEventListener('click', () => { clearSettings(); refreshChip(); toast('已清除本地保存的全部 Key', 'ok'); close(); onSaved?.(); });
  $('#mSave', m).addEventListener('click', () => { saveSettings(read()); refreshChip(); toast(hasLive() ? '已保存 · 真实模式可用' : '已保存 · 当前为演示模式', 'ok'); close(); onSaved?.(); });
  $$('[data-test]', m).forEach(b => b.addEventListener('click', async () => {
    const which = b.dataset.test!; const r = read();
    const out = $('#tr-' + which, m);
    out.className = 'tres run'; out.textContent = '测试中…';
    try {
      let ms = 0;
      if (which === 'bailian') { if (!r.bailianKey) throw new ApiError('请先填写 DashScope Key'); ms = await testBailian(r); }
      if (which === 'qianfan') { if (!r.qianfanKey) throw new ApiError('请先填写千帆 Key'); ms = await testQianfan(r); }
      out.className = 'tres ok'; out.textContent = `✓ 连接正常 · ${ms}ms`;
    } catch (e) { const er = e as ApiError; out.className = 'tres err'; out.textContent = `✕ ${er.message}${er.hint ? ' — ' + er.hint : ''}`; }
  }));
}

/** 读取图片 → 压缩为长边 ≤1280 的 JPEG dataURL */
export function prepImage(file: Blob, name = 'image.jpg'): Promise<{ dataUrl: string; w: number; h: number; name: string; size: number }> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); res({ dataUrl: c.toDataURL('image/jpeg', 0.9), w, h, name, size: file.size });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('图片无法读取')); };
    img.src = url;
  });
}
export const fmtSize = (b: number) => (b > 1e6 ? (b / 1048576).toFixed(1) + 'MB' : Math.round(b / 1024) + 'KB');
export const LV_NAME = { high: '高风险', mid: '中风险', low: '提示' } as const;
export const LV_SHORT = { high: '高', mid: '中', low: '提示' } as const;
export const LV_COLOR = { high: 'var(--coral)', mid: 'var(--amber)', low: 'var(--mint)' } as const;
export const LAUNCH_NAME = { go: '可直接上架', fix_then_go: '修改后上架', no_go: '不建议上架' } as const;
