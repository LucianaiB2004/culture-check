export interface Settings {
  bailianKey: string; region: 'cn-beijing' | 'ap-southeast-1';
  visionModel: string; reviewModel: string; imageModel: string;
  provider: 'bailian' | 'qianfan'; qianfanKey: string; qianfanVisionModel: string; qianfanTextModel: string;
  demoForced: boolean;
}
const KEY = 'cc.settings.v1';
export const DEFAULTS: Settings = {
  bailianKey: '', region: 'cn-beijing',
  visionModel: 'qwen3-vl-plus', reviewModel: 'qwen3.7-plus', imageModel: 'wan2.7-image',
  provider: 'bailian', qianfanKey: '', qianfanVisionModel: 'ernie-4.5-turbo-vl', qianfanTextModel: 'ernie-4.5-turbo-128k',
  demoForced: false,
};
export function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...DEFAULTS } as Record<string, unknown>;
    for (const k of Object.keys(DEFAULTS)) if (k in v) out[k] = v[k]; // 只保留当前版本认识的字段
    return out as unknown as Settings;
  } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s: Settings) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function clearSettings() { localStorage.removeItem(KEY); }
export function hasLive(s = loadSettings()) {
  return s.provider === 'qianfan' ? !!(s.qianfanKey && s.bailianKey) || !!s.qianfanKey : !!s.bailianKey;
}
export function bailianBase(s: Settings) {
  return s.region === 'ap-southeast-1' ? 'https://dashscope-intl.aliyuncs.com' : 'https://dashscope.aliyuncs.com';
}
export const mask = (k: string) => (k ? k.slice(0, 6) + '••••' + k.slice(-4) : '');
