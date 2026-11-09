import type { Job, Market, Report } from './types';
import { demoReport } from './demo';
import jerky from './demo-jerky.json';

/** 演示预设：tea 为人工校对的设计稿数据；jerky 为一次真实端到端运行（qwen3-vl-plus + qwen3.7-plus + wan2.7-image）录制下来的结果 */
export function presetMarkets(job: Job): Market[] {
  if (job.demoId !== 'jerky' || !jerky) return job.markets;
  const all = (jerky as unknown as Report).results.map(r => r.market);
  const hit = job.markets.filter(m => all.includes(m));
  return hit.length ? hit : all;
}
export function presetReport(job: Job): Report {
  if (job.demoId === 'jerky' && jerky) return { ...(jerky as unknown as Report), jobId: job.id };
  return demoReport(job);
}
export const hasJerky = () => !!jerky;
