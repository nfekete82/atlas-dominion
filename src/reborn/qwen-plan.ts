/** Shared, deterministic contract. Model output is never executable code. */
export interface SectorChoice {
  sectorId: number;
  owner: 'neutral' | 'enemy';
  score: number;
  travel: number;
  routeRisk: number;
  defenders: number;
  turrets: number;
  income: number;
}
export interface StrategicBrief {
  time: number;
  credits: number;
  fighters: number;
  artillery: number;
  medics: number;
  phase: 'gather' | 'attack' | 'regroup' | 'defend';
  options: SectorChoice[];
}
export interface StrategicDecision { sectorId: number }

/** Accept one exact sector from the options sent to the model. */
export function parseStrategicDecision(reply: unknown, brief: StrategicBrief): StrategicDecision | null {
  if (typeof reply !== 'string' || reply.length > 4096 || !Array.isArray(brief.options)) return null;
  const withoutThinking = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const match = /\{[^{}]{1,160}\}/.exec(withoutThinking);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const sectorId = (parsed as Record<string, unknown>).sectorId;
    if (!Number.isSafeInteger(sectorId) || !brief.options.some(option => option.sectorId === sectorId)) return null;
    return { sectorId: sectorId as number };
  } catch { return null; }
}

export function strategicMessages(brief: StrategicBrief): {role: 'system' | 'user'; content: string}[] {
  const compact = {
    credits: Math.floor(brief.credits),
    fighters: brief.fighters,
    artillery: brief.artillery,
    medics: brief.medics,
    phase: brief.phase,
    options: brief.options.map(o => ({
      sectorId: o.sectorId,
      owner: o.owner,
      distance: Math.round(o.travel),
      danger: Math.round(o.routeRisk),
      defenders: Math.round(o.defenders),
      towers: o.turrets,
      income: o.income,
      baselineCost: Math.round(o.score),
    })),
  };
  return [
    { role: 'system', content: 'You are the red RTS faction strategic adviser. Select only one target from the listed options. Smaller baselineCost is generally safer, but a high-value enemy sector may be worth risk. Do not invent locations, resources, enemies or units. Answer only compact JSON like {"sectorId":2}. No prose or reasoning.' },
    { role: 'user', content: '/no_think\nChoose one sector from the options. Known enemy intelligence only:\n' + JSON.stringify(compact) },
  ];
}
