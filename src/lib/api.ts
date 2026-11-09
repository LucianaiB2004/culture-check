import { bailianBase, type Settings } from './settings';

export class ApiError extends Error { constructor(msg: string, public status = 0, public hint = '') { super(msg); } }

function explain(e: unknown, what: string): never {
  if (e instanceof ApiError) throw e;
  const m = String((e as Error)?.message || e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m))
    throw new ApiError(`${what}：网络请求失败`, 0, '请检查网络连接，或确认 Key 所属地域与设置一致。');
  throw new ApiError(`${what}：${m}`);
}
async function req(url: string, init: RequestInit, what: string, timeoutMs = 120000) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), timeoutMs);
  let r: Response;
  try { r = await fetch(url, { ...init, signal: ac.signal }); }
  catch (e) { clearTimeout(tm); if ((e as Error).name === 'AbortError') throw new ApiError(`${what}：请求超时`); explain(e, what); }
  clearTimeout(tm);
  const text = await r.text();
  let data: any = null; try { data = JSON.parse(text); } catch { /* not json */ }
  if (!r.ok) {
    const msg = data?.error?.message || data?.message || data?.detail?.[0]?.msg || (typeof data?.detail === 'string' ? data.detail : '') || text.slice(0, 160);
    const hint = r.status === 401 || r.status === 403 ? 'Key 无效、无权限或与所选地域不匹配。' : r.status === 404 ? '接口或模型不存在（检查模型名）。' : r.status === 429 ? '触发限流，请稍后重试。' : '';
    throw new ApiError(`${what}失败（HTTP ${r.status}）：${msg}`, r.status, hint);
  }
  return data ?? text;
}

export type Content = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
export async function chatJSON(s: Settings, o: { role: 'vision' | 'review'; system: string; user: Content; temperature?: number }): Promise<any> {
  const qf = s.provider === 'qianfan' && !!s.qianfanKey;
  const url = qf ? 'https://qianfan.baidubce.com/v2/chat/completions' : `${bailianBase(s)}/compatible-mode/v1/chat/completions`;
  const model = qf ? (o.role === 'vision' ? s.qianfanVisionModel : s.qianfanTextModel) : (o.role === 'vision' ? s.visionModel : s.reviewModel);
  const body: any = { model, messages: [{ role: 'system', content: o.system }, { role: 'user', content: o.user }], temperature: o.temperature ?? 0.2, response_format: { type: 'json_object' } };
  if (!qf) body.enable_thinking = false;
  const data = await req(url, { method: 'POST', headers: { Authorization: `Bearer ${qf ? s.qianfanKey : s.bailianKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, `${model} 调用`);
  const txt: string = data?.choices?.[0]?.message?.content ?? '';
  return { json: parseJSON(txt), model, usage: data?.usage };
}
export function parseJSON(t: string) {
  const s = t.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new ApiError('模型返回的不是合法 JSON'); }
}

/** 万相 2.7 交互式编辑：boxes 为原图绝对像素，单图 ≤2 个框 */
export async function wanEdit(s: Settings, image: string, prompt: string, boxes: number[][]): Promise<string> {
  const body = { model: s.imageModel, input: { messages: [{ role: 'user', content: [{ image }, { text: prompt }] }] },
    parameters: { bbox_list: [boxes], n: 1, watermark: false, size: '1K' } };
  const call = () => req(`${bailianBase(s)}/api/v1/services/aigc/multimodal-generation/generation`,
    { method: 'POST', headers: { Authorization: `Bearer ${s.bailianKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, `${s.imageModel} 修图`, 180000);
  let data: any;
  try { data = await call(); }
  catch (e) { const st = (e as ApiError).status; if (st && st < 500 && st !== 429) throw e; data = await call(); } // 超时 / 5xx / 限流重试一次
  const url = data?.output?.choices?.[0]?.message?.content?.find?.((c: any) => c.image)?.image;
  if (!url) throw new ApiError('修图接口未返回图片');
  return url;
}

export async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url); const b = await r.blob();
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); });
}

/** 设置页“测试连接” */
export async function testBailian(s: Settings) {
  const t = performance.now();
  await req(`${bailianBase(s)}/compatible-mode/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${s.bailianKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: s.visionModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4 }) }, '百炼');
  return Math.round(performance.now() - t);
}
export async function testQianfan(s: Settings) {
  const t = performance.now();
  await req('https://qianfan.baidubce.com/v2/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${s.qianfanKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: s.qianfanTextModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4 }) }, '千帆');
  return Math.round(performance.now() - t);
}
