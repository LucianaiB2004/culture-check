export type Market = 'JP' | 'BR' | 'SA' | 'US' | 'DE' | 'IN';
export type Level = 'high' | 'mid' | 'low';
export type RuleCat = 'number' | 'flower' | 'color' | 'gesture' | 'text' | 'symbol' | 'food';
export interface Source { title: string; url: string }
export interface Rule {
  id: string; market: Market; kind: 'culture' | 'compliance'; category: RuleCat; level: Level; icon: string;
  title: string; reason: string; suggestion: string; sources: Source[];
}
export interface Element {
  id: string; label: string; category: string; bbox: [number, number, number, number] | null; // 0-1000
  text?: string; count?: number; attributes?: Record<string, string>;
}
export interface Decision {
  keepProb: number; level?: Level; optionIdx?: number; by: 'llm';
}
export interface Finding {
  id: string; market: Market; elementId: string; ruleId: string; level: Level; title: string; where: string;
  reason: string; suggestion: string; suggestions?: string[]; editPrompt?: string; confidence: number;
  sources: Source[]; icon: string; review?: boolean; decision?: Decision;
}
export interface LaunchDecision { choice: 'go' | 'fix_then_go' | 'no_go'; prob: number; by: Decision['by'] }
export interface MarketResult { market: Market; score: number; findings: Finding[]; passes?: string[]; launch?: LaunchDecision; dropped?: number }
export interface AgentEvent { t: number; agent: 'chief' | 'vision' | 'culture' | 'compliance' | 'fix' | 'decision'; market?: Market; status: 'start' | 'progress' | 'hit' | 'done' | 'error'; msg: string; pct?: number; data?: any }
export interface Job {
  id: string; image: { dataUrl: string; w: number; h: number; name: string; size: number };
  markets: Market[]; categories: string[]; category: string; channel: string; copyText: string;
  mode: 'demo' | 'live'; demoId?: string; createdAt: string;
}
export interface Report {
  jobId: string; elements: Element[]; results: MarketResult[]; events: AgentEvent[]; elapsedMs: number;
  fixedImage?: string; fixedScores?: Partial<Record<Market, number>>; fixedResults?: MarketResult[];
  models: Record<string, string>; warnings?: string[]; fixSkipped?: string[];
}
