import type { PersonalityProfile } from '../avatar-step.js';
import type { BigFiveDimension, BigFivePole } from './compatibility-matrix.js';

export type CanonicalAxis = 'socialOrientation' | 'ruleFollowing' | 'riskAppetite' | 'autonomy' | 'conflictMode';

export interface AxisScore {
  axis: CanonicalAxis;
  label: string;
  lowLabel: string;
  highLabel: string;
  score: number;
  contributors: string[];
}

const AXIS_META: Record<CanonicalAxis, { label: string; low: string; high: string }> = {
  socialOrientation: { label: 'Social', low: 'Autonomous', high: 'Collaborative' },
  ruleFollowing:     { label: 'Rules', low: 'Flexible', high: 'Strict' },
  riskAppetite:      { label: 'Risk', low: 'Cautious', high: 'Bold' },
  autonomy:          { label: 'Autonomy', low: 'Dependent', high: 'Independent' },
  conflictMode:      { label: 'Conflict', low: 'Accommodating', high: 'Competing' },
};

type Signal = [CanonicalAxis, number];

function mbtiSignals(type: string): Signal[] {
  if (type.length !== 4) return [];
  const signals: Signal[] = [];
  const ei = type[0], sn = type[1], tf = type[2], jp = type[3];
  signals.push(['socialOrientation', ei === 'E' ? 0.7 : -0.7]);
  signals.push(['riskAppetite', sn === 'N' ? 0.5 : -0.5]);
  signals.push(['conflictMode', tf === 'T' ? 0.6 : -0.6]);
  signals.push(['ruleFollowing', jp === 'J' ? 0.6 : -0.6]);
  signals.push(['autonomy', ei === 'I' ? 0.4 : -0.3]);
  return signals;
}

const ENNEAGRAM_SIGNALS: Record<string, Signal[]> = {
  'Type 1': [['ruleFollowing', 0.8], ['conflictMode', 0.3]],
  'Type 2': [['socialOrientation', 0.7], ['conflictMode', -0.6]],
  'Type 3': [['riskAppetite', 0.5], ['conflictMode', 0.4]],
  'Type 4': [['autonomy', 0.5], ['riskAppetite', 0.2]],
  'Type 5': [['autonomy', 0.8], ['riskAppetite', -0.4]],
  'Type 6': [['ruleFollowing', 0.5], ['riskAppetite', -0.6]],
  'Type 7': [['riskAppetite', 0.8], ['ruleFollowing', -0.7]],
  'Type 8': [['conflictMode', 0.8], ['riskAppetite', 0.6]],
  'Type 9': [['conflictMode', -0.7], ['socialOrientation', 0.3]],
};

const DISC_SIGNALS: Record<string, Signal[]> = {
  'D': [['conflictMode', 0.8], ['riskAppetite', 0.7], ['autonomy', 0.5]],
  'I': [['socialOrientation', 0.8], ['ruleFollowing', -0.5], ['riskAppetite', 0.3]],
  'S': [['conflictMode', -0.7], ['riskAppetite', -0.6], ['ruleFollowing', 0.3]],
  'C': [['ruleFollowing', 0.8], ['riskAppetite', -0.5], ['autonomy', 0.3]],
};

const SDI_SIGNALS: Record<string, Signal[]> = {
  'Blue': [['conflictMode', -0.7], ['socialOrientation', 0.6]],
  'Red': [['conflictMode', 0.7], ['riskAppetite', 0.6], ['autonomy', 0.3]],
  'Green': [['autonomy', 0.7], ['riskAppetite', -0.3], ['ruleFollowing', 0.4]],
  'Hub': [['ruleFollowing', -0.3], ['socialOrientation', 0.3]],
};

const BELBIN_SIGNALS: Record<string, Signal[]> = {
  'Plant': [['autonomy', 0.6], ['riskAppetite', 0.4]],
  'Shaper': [['conflictMode', 0.6], ['riskAppetite', 0.5]],
  'Monitor Evaluator': [['ruleFollowing', 0.5], ['riskAppetite', -0.3]],
  'Co-ordinator': [['socialOrientation', 0.6], ['ruleFollowing', 0.3]],
  'Teamworker': [['conflictMode', -0.5], ['socialOrientation', 0.5]],
  'Implementer': [['ruleFollowing', 0.6], ['riskAppetite', -0.3]],
  'Completer-Finisher': [['ruleFollowing', 0.7], ['riskAppetite', -0.5]],
  'Specialist': [['autonomy', 0.6], ['ruleFollowing', 0.3]],
  'Resource Investigator': [['socialOrientation', 0.7], ['riskAppetite', 0.4]],
};

function bigFiveSignals(bigFive: Partial<Record<BigFiveDimension, BigFivePole>>): Signal[] {
  const signals: Signal[] = [];
  if (bigFive.O) signals.push(['riskAppetite', bigFive.O === 'high' ? 0.6 : -0.5]);
  if (bigFive.C) signals.push(['ruleFollowing', bigFive.C === 'high' ? 0.7 : -0.6]);
  if (bigFive.E) signals.push(['socialOrientation', bigFive.E === 'high' ? 0.7 : -0.6]);
  if (bigFive.A) signals.push(['conflictMode', bigFive.A === 'high' ? -0.7 : 0.6]);
  if (bigFive.N) signals.push(['autonomy', bigFive.N === 'high' ? -0.4 : 0.3]);
  return signals;
}

export function deriveDispositions(profile: PersonalityProfile): AxisScore[] {
  const axes: CanonicalAxis[] = ['socialOrientation', 'ruleFollowing', 'riskAppetite', 'autonomy', 'conflictMode'];
  const totals: Record<CanonicalAxis, { sum: number; count: number; contributors: string[] }> = {} as any;
  for (const a of axes) totals[a] = { sum: 0, count: 0, contributors: [] };

  function add(signals: Signal[], source: string) {
    for (const [axis, value] of signals) {
      totals[axis].sum += value;
      totals[axis].count++;
      totals[axis].contributors.push(source);
    }
  }

  if (profile.mbti) add(mbtiSignals(profile.mbti), `MBTI ${profile.mbti}`);
  if (profile.enneagram) add(ENNEAGRAM_SIGNALS[profile.enneagram] ?? [], `${profile.enneagram}`);
  if (profile.disc) add(DISC_SIGNALS[profile.disc] ?? [], `DISC ${profile.disc}`);
  if (profile.sdi) add(SDI_SIGNALS[profile.sdi] ?? [], `SDI ${profile.sdi}`);
  if (profile.belbin?.primary) add(BELBIN_SIGNALS[profile.belbin.primary] ?? [], `Belbin ${profile.belbin.primary}`);
  if (profile.bigFive) add(bigFiveSignals(profile.bigFive), 'Big Five');

  return axes.map(axis => {
    const t = totals[axis];
    const score = t.count > 0 ? Math.max(-1, Math.min(1, t.sum / t.count)) : 0;
    const meta = AXIS_META[axis];
    return { axis, label: meta.label, lowLabel: meta.low, highLabel: meta.high, score, contributors: t.contributors };
  });
}
