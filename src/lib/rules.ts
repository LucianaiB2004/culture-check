import type { Rule, Market } from './types';

const W = (t: string, u: string) => ({ title: t, url: u });
const TETRA = W('Wikipedia · Tetraphobia', 'https://en.wikipedia.org/wiki/Tetraphobia');
const OKG = W('Wikipedia · OK gesture', 'https://en.wikipedia.org/wiki/OK_gesture');

/** 文化与合规规则库 v1：每条必须带来源，模型只能引用这里的条目（规则先行防幻觉）。 */
export const RULES: Rule[] = [
  // ---------- 日本 ----------
  { id: 'jp-num-4', market: 'JP', kind: 'culture', category: 'number', level: 'high', icon: 'risk-number',
    title: '数字 4 读音近「死」', reason: '日语「四」可读作 shi，与「死」同音，医院、公寓等常回避 4；以 4 为卖点或成套数量的礼品易引发不吉联想。',
    suggestion: '避免以 4 为卖点或成套数量，改为 5 件套 / 对杯，或去掉数字。', sources: [TETRA] },
  { id: 'jp-num-9', market: 'JP', kind: 'culture', category: 'number', level: 'low', icon: 'risk-number',
    title: '数字 9 读音近「苦」', reason: '日语「九」可读作 ku，与「苦」同音，部分场合（如礼品、病房号）会回避。',
    suggestion: '礼品场景避免强调 9；改用 5、8 等中性数字。', sources: [W('Wikipedia · Japanese numerals', 'https://en.wikipedia.org/wiki/Japanese_numerals'), TETRA] },
  { id: 'jp-flower-chrys', market: 'JP', kind: 'culture', category: 'flower', level: 'mid', icon: 'risk-color',
    title: '白菊多用于葬礼与扫墓', reason: '白色菊花是日本葬礼与扫墓的传统用花，出现在喜庆礼品或探病场景中容易引发不吉联想。',
    suggestion: '换成粉色樱花枝、彩色洋桔梗或郁金香。', sources: [W('Hanamikke · 日本赠花礼仪', 'https://hanamikke.com/en/544.html/')] },
  { id: 'jp-gesture-ok', market: 'JP', kind: 'culture', category: 'gesture', level: 'low', icon: 'risk-gesture',
    title: 'OK 手势在日本可表示「钱」', reason: '拇指与食指成圈的手势在日本常表示“钱”，在礼品语境中可能被误读。',
    suggestion: '换成张开手掌托举商品的手势。', sources: [OKG] },
  { id: 'jp-label-lang', market: 'JP', kind: 'compliance', category: 'text', level: 'low', icon: 'risk-text',
    title: '商品标签需在销售环节提供日文标示', reason: '日本多类商品在零售环节要求日文标签，通常由进口商在清关后加贴；图中外文小字无法替代日文品名。',
    suggestion: '详情图补充日文品名 / 材质说明，并与进口商确认标签。', sources: [W('trade.gov · Japan Labeling/Marking', 'https://www.trade.gov/country-commercial-guides/japan-labelingmarking-requirements')] },

  // ---------- 巴西 ----------
  { id: 'br-gesture-ok', market: 'BR', kind: 'culture', category: 'gesture', level: 'high', icon: 'risk-gesture',
    title: 'OK 手势在巴西被视为粗鄙冒犯', reason: '拇指与食指成圈的手势在巴西被视为粗俗侮辱（1950 年代尼克松访巴事件广为人知）。',
    suggestion: '换成张开手掌托举商品，或竖起拇指以外的中性手势。', sources: [OKG, W('Wikipedia · List of gestures', 'https://en.wikipedia.org/wiki/List_of_gestures')] },
  { id: 'br-label-pt', market: 'BR', kind: 'compliance', category: 'text', level: 'low', icon: 'risk-text',
    title: '进口商品信息需提供葡萄牙语', reason: '巴西要求进口商品的品质、成分、产地、保质期及安全风险等信息提供葡萄牙语译文，并使用公制单位。',
    suggestion: '详情图补充葡语品名与关键参数（公制）。', sources: [W('trade.gov · Brazil Labeling/Marking', 'https://www.trade.gov/country-commercial-guides/brazil-labelingmarking-requirements')] },

  // ---------- 沙特 ----------
  { id: 'sa-import-pork-alcohol', market: 'SA', kind: 'compliance', category: 'food', level: 'high', icon: 'risk-food',
    title: '禁止进口猪肉制品与酒精饮品', reason: '沙特禁止进口猪肉及其制品与酒精；含酒精产品需特别审批。图中出现酒类或猪肉元素会直接触及禁运红线。',
    suggestion: '移除酒精饮品 / 猪肉元素，换成无酒精饮料或清真食品。', sources: [W('trade.gov · Saudi Arabia Prohibited & Restricted Imports', 'https://www.trade.gov/country-commercial-guides/saudi-arabia-prohibited-and-restricted-imports')] },
  { id: 'sa-halal-meat', market: 'SA', kind: 'compliance', category: 'food', level: 'mid', icon: 'risk-food',
    title: '肉类及禽类需清真认证', reason: '沙特执行海湾统一清真标准，肉类与禽类进口需清真认证；详情图未体现清真标识会影响上架与信任。',
    suggestion: '确认清真认证并在包装 / 详情图展示认证标识。', sources: [W('trade.gov · Saudi Arabia Labeling/Marking', 'https://www.trade.gov/country-commercial-guides/saudi-arabia-labelingmarking-requirements')] },
  { id: 'sa-gesture-ok', market: 'SA', kind: 'culture', category: 'gesture', level: 'mid', icon: 'risk-gesture',
    title: 'OK 手势在部分中东地区含冒犯意味', reason: '在部分中东国家，该手势（尤其晃动时）可表示“邪眼”诅咒或威胁，存在被误读的风险。',
    suggestion: '换成张开手掌托举商品的手势。', sources: [OKG] },
  { id: 'sa-left-hand', market: 'SA', kind: 'culture', category: 'gesture', level: 'mid', icon: 'risk-gesture',
    title: '左手递物 / 进食被视为不礼貌', reason: '中东礼仪中左手被视为不洁，递物、进食、握手宜用右手；展示左手递送商品可能显得失礼。',
    suggestion: '改为右手持物或双手托举。', sources: [W('Wikipedia · Etiquette in the Middle East', 'https://en.wikipedia.org/wiki/Etiquette_in_the_Middle_East')] },
  { id: 'sa-label-ar', market: 'SA', kind: 'compliance', category: 'text', level: 'mid', icon: 'risk-text',
    title: '警示与安全信息需使用阿拉伯语', reason: '沙特要求警示与安全说明使用阿拉伯语（或阿英双语），说明书亦需阿拉伯语；图中仅有外文小字时存在合规缺口。',
    suggestion: '补充阿拉伯语品名与警示信息。', sources: [W('trade.gov · Saudi Arabia Labeling/Marking', 'https://www.trade.gov/country-commercial-guides/saudi-arabia-labelingmarking-requirements')] },

  // ---------- 美国 ----------
  { id: 'us-made-in-usa', market: 'US', kind: 'compliance', category: 'text', level: 'high', icon: 'risk-compliance',
    title: '「Made in USA」声明须符合 FTC 标准', reason: '无限定的 “Made in USA” 须满足最终组装在美、重要加工在美且“全部或几乎全部”部件产自美国（16 CFR Part 323），否则构成虚假产地声明。',
    suggestion: '若非美国生产，删除该标识并按实际产地标注（如 Made in China）。', sources: [W('eCFR · 16 CFR Part 323', 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-323')] },
  { id: 'us-origin-marking', market: 'US', kind: 'compliance', category: 'text', level: 'low', icon: 'risk-text',
    title: '进口商品需以英文标注原产国', reason: '美国海关要求进口商品以清晰、显著、永久的英文标注原产国（19 CFR Part 134）。图中小字无法辨识时建议补充。',
    suggestion: '在包装显著位置补充英文原产国标注。', sources: [W('eCFR · 19 CFR Part 134', 'https://www.ecfr.gov/current/title-19/chapter-I/part-134')] },

  // ---------- 德国 ----------
  { id: 'de-86a', market: 'DE', kind: 'compliance', category: 'symbol', level: 'high', icon: 'risk-religion',
    title: '违宪组织标志受刑法 §86a 禁止', reason: '德国刑法 §86a 禁止传播或公开使用违宪组织标志（旗帜、徽章、口号、问候方式及易混淆相似物），可处 3 年以下监禁或罚金。',
    suggestion: '彻底移除相关符号及易混淆的相似图形。', sources: [W('StGB §86a', 'https://www.gesetze-im-internet.de/stgb/__86a.html')] },
  { id: 'de-gesture-ok', market: 'DE', kind: 'culture', category: 'gesture', level: 'low', icon: 'risk-gesture',
    title: 'OK 手势存在被误读的小概率风险', reason: 'ADL 指出该手势在绝大多数语境无害，但 2017 年后在极少数网络语境中被曲解为仇恨符号；欧洲广告审核中偶有被质疑。',
    suggestion: '可保留；如追求零争议可换成张开手掌托举。', sources: [W('ADL · Okay Hand Gesture', 'https://www.adl.org/resources/hate-symbol/okay-hand-gesture')] },

  // ---------- 印度 ----------
  { id: 'in-beef', market: 'IN', kind: 'culture', category: 'food', level: 'high', icon: 'risk-food',
    title: '牛肉相关图像 / 文案高度敏感', reason: '印度屠牛属邦级立法，约 20 个邦限制或禁止屠牛；牛肉制品图像与文案在宗教层面高度敏感，且多地禁售。',
    suggestion: '印度站点下架牛肉品类，或替换为鸡肉 / 植物蛋白等品类图。', sources: [W('Wikipedia · Cattle slaughter in India', 'https://en.wikipedia.org/wiki/Cattle_slaughter_in_India')] },
  { id: 'in-label-lm', market: 'IN', kind: 'compliance', category: 'text', level: 'low', icon: 'risk-text',
    title: '预包装商品需标注进口商、净含量与 MRP', reason: '印度要求进口预包装零售商品标注进口商名称地址、通用名、公制净含量、生产 / 进口年月及含税最高零售价（MRP）。',
    suggestion: '详情图与包装补充进口商信息和 MRP 标签。', sources: [W('trade.gov · India Labeling/Marking', 'https://www.trade.gov/country-commercial-guides/india-labelingmarking-requirements')] },
];

export const MARKETS: { id: Market; name: string; hint: string }[] = [
  { id: 'JP', name: '日本', hint: '数字 · 花卉 · 礼仪' },
  { id: 'BR', name: '巴西', hint: '手势 · 色彩' },
  { id: 'SA', name: '沙特阿拉伯', hint: '禁运品 · 礼仪' },
  { id: 'US', name: '美国', hint: '产地与广告声明' },
  { id: 'DE', name: '德国', hint: '违禁标志' },
  { id: 'IN', name: '印度', hint: '宗教 · 饮食' },
];
export const MK_SHORT: Record<Market, string> = { JP: '日本', BR: '巴西', SA: '沙特', US: '美国', DE: '德国', IN: '印度' };
export const mkImg = (m: Market) => `assets/market-${m.toLowerCase()}.webp`;
export const ruleById = (id: string) => RULES.find(r => r.id === id);
export const rulesFor = (m: Market, kind?: 'culture' | 'compliance') => RULES.filter(r => r.market === m && (!kind || r.kind === kind));

export const CATEGORIES = [
  { id: 'color', name: '颜色', icon: 'risk-color', match: ['flower', 'color'] },
  { id: 'gesture', name: '手势', icon: 'risk-gesture', match: ['gesture'] },
  { id: 'number', name: '数字', icon: 'risk-number', match: ['number'] },
  { id: 'religion', name: '宗教', icon: 'risk-religion', match: ['symbol'] },
  { id: 'text', name: '文案', icon: 'risk-text', match: ['text'] },
  { id: 'food', name: '饮食', icon: 'risk-food', match: ['food'] },
  { id: 'compliance', name: '合规', icon: 'risk-compliance', match: ['compliance'] },
] as const;
