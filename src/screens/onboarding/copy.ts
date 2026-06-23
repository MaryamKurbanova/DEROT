export const COLD_OPEN_LINES = [
  'Your attention can leave quietly — without you noticing it is gone.',
  'The apps you open are engineered to hold your focus longer than you meant to give it.',
  'This is not a willpower problem. It is friction against a system built to win that fight.',
] as const;

export const PROTECT_TARGET_OPTIONS = [
  'Career',
  'Relationships',
  'Creativity',
  'Sleep',
  'Presence with people I care about',
] as const;

export type ProtectTarget = (typeof PROTECT_TARGET_OPTIONS)[number];

export const COMMITMENT_OPTIONS = [
  'Extremely committed',
  'Very committed',
  'Somewhat committed',
  'A little committed',
  'Just trying it out',
] as const;

export function inferProtectTargetFromGoals(
  mindGoals: readonly string[],
  lifeGoals: readonly string[],
): ProtectTarget {
  const combined = [...mindGoals, ...lifeGoals].join(' ').toLowerCase();
  if (combined.includes('career')) return 'Career';
  if (combined.includes('relationship') || combined.includes('people')) return 'Relationships';
  if (combined.includes('creat') || combined.includes('hobb')) return 'Creativity';
  if (combined.includes('sleep') || combined.includes('health')) return 'Sleep';
  return 'Presence with people I care about';
}

export function lockInTagline(commitment: string | null): string {
  if (commitment?.toLowerCase().includes('extremely')) return 'all in. no looking back.';
  if (commitment?.toLowerCase().includes('very')) return 'you mean it. keep that energy.';
  if (commitment?.toLowerCase().includes('somewhat')) return 'a start counts. stay with it.';
  if (commitment?.toLowerCase().includes('little')) return 'show up again tomorrow.';
  return 'see where this takes you.';
}

export function commitmentLevelPercent(commitment: string | null): number {
  if (!commitment) return 0;
  const c = commitment.toLowerCase();
  if (c.includes('extremely')) return 100;
  if (c.includes('very')) return 80;
  if (c.includes('somewhat')) return 60;
  if (c.includes('little')) return 40;
  return 25;
}

export function phoneRelationshipLevelPercent(relationship: string | null): number {
  if (!relationship) return 0;
  const text = stripOptionEmoji(relationship).toLowerCase();
  if (text.includes('when i need it')) return 88;
  if (text.includes('healthy balance')) return 92;
  if (text.includes('more time on it')) return 28;
  if (text.includes('taking back control')) return 52;
  return 50;
}

export const COST_MEMORY_PRESETS = [
  'A deadline I missed',
  'Someone I was not present with',
  'A night of sleep I lost',
  'An hour I cannot get back',
] as const;

const AGE_BENCHMARK_HOURS: Record<string, string> = {
  '13-17': '4–6',
  '18-24': '5–7',
  '25-34': '4–6',
  '35-44': '3–5',
  '45-54': '2–4',
  '55+': '2–3',
};

export function ageBenchmarkLine(ageStore: string): string {
  const range = AGE_BENCHMARK_HOURS[ageStore] ?? '3–5';
  return `People in your age bracket often report ${range} hours a day on social and entertainment platforms — before they decide to change anything.`;
}

export function protectTargetShort(target: ProtectTarget | null): string {
  switch (target) {
    case 'Career':
      return 'your career';
    case 'Relationships':
      return 'your relationships';
    case 'Creativity':
      return 'your creative work';
    case 'Sleep':
      return 'your sleep';
    case 'Presence with people I care about':
      return 'the people you care about';
    default:
      return 'what matters to you';
  }
}

export function protectTargetStreakLine(target: ProtectTarget | null): string {
  switch (target) {
    case 'Career':
      return 'Your first day protecting your focus at work.';
    case 'Relationships':
      return 'Your first day protecting your relationships.';
    case 'Creativity':
      return 'Your first day protecting your creative time.';
    case 'Sleep':
      return 'Your first day protecting your evenings.';
    case 'Presence with people I care about':
      return 'Your first day protecting presence with people you care about.';
    default:
      return 'Your first flame is lit.';
  }
}

export function pledgeCaption(target: ProtectTarget | null): string {
  const short = protectTargetShort(target);
  return `I commit to protecting ${short} — one conscious pause at a time.`;
}

export function visualizationCopy(target: ProtectTarget | null): string {
  const short = protectTargetShort(target);
  return `Picture one ordinary moment this week — made different because you had that attention back for ${short}.`;
}

function stripGoalEmoji(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]\s*/u, '').trim();
}

export function primaryOnboardingGoal(mindGoals: readonly string[], lifeGoals: readonly string[]): string {
  const raw = mindGoals[0] ?? lifeGoals[0];
  if (!raw) return 'more intentional focus';
  return stripGoalEmoji(raw).toLowerCase();
}

export function transformationTargetDate(daysAhead = 90): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d
    .toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    .toLowerCase();
}

export function transformationFeatureCards(
  mindGoals: readonly string[],
  lifeGoals: readonly string[],
): ReadonlyArray<{ emoji: string; label: string }> {
  const defaults = [
    { emoji: '📝', label: 'daily log consistency' },
    { emoji: '☀️', label: 'mindful mornings' },
    { emoji: '🎯', label: 'deeper focus' },
  ] as const;
  const pool = [...mindGoals, ...lifeGoals].slice(0, 3);
  if (pool.length === 0) return defaults;
  return pool.map((goal, index) => {
    const emojiMatch = goal.match(/^[^\p{L}\p{N}]/u);
    return {
      emoji: emojiMatch?.[0]?.trim() || defaults[index]?.emoji || '✨',
      label: stripGoalEmoji(goal).toLowerCase(),
    };
  });
}

export function transformationHoursSummary(reclaimGoalHours: number, goal: string): string {
  const yearly = Math.max(30, Math.round(reclaimGoalHours * 12));
  return `${yearly}+ hours a year reclaimed for ${goal}`;
}

type Mood = 'Calm' | 'Bored' | 'Tired' | 'Lost' | 'Good';
type Intent = 'Send message' | 'Create content' | 'Seek comfort' | 'Doomscroll';

const REFRAME_MATRIX: Record<Mood, Record<Intent, readonly string[]>> = {
  Calm: {
    'Send message': [
      'You are reaching out with intention — not on autopilot.',
      'You chose connection while you still feel clear.',
      'You named why you are opening this before habit took over.',
    ],
    'Create content': [
      'You showed up to create while you still feel clear.',
      'You paused to choose making over scrolling.',
      'You kept the calm long enough to act on purpose.',
    ],
    'Seek comfort': [
      'You named the comfort you need before opening the feed.',
      'You asked for ease consciously — not as a reflex.',
      'You chose comfort with awareness instead of disappearing.',
    ],
    Doomscroll: [
      'You caught the drift before it became another hour.',
      'You noticed the pull while you could still redirect it.',
      'You stopped the scroll before calm turned into numbness.',
    ],
  },
  Bored: {
    'Send message': [
      'Boredom pushed you toward connection — you chose it consciously.',
      'You turned restlessness into a deliberate reach-out.',
      'You answered boredom with intention, not autopilot.',
    ],
    'Create content': [
      'You turned restlessness into something you can stand behind.',
      'You channeled boredom into a choice to make something.',
      'You paused the feed long enough to create on purpose.',
    ],
    'Seek comfort': [
      'You admitted you needed ease before the scroll took over.',
      'You named boredom and chose comfort with eyes open.',
      'You did not let empty time decide for you.',
    ],
    Doomscroll: [
      'You noticed the boredom trap before it swallowed the block.',
      'You caught yourself reaching for noise and chose differently.',
      'You interrupted bored autopilot before it cost you.',
    ],
  },
  Tired: {
    'Send message': [
      'You checked in with someone while you still had the energy to mean it.',
      'You chose connection before exhaustion made it hollow.',
      'You reached out on purpose, not because the phone was already in your hand.',
    ],
    'Create content': [
      'You paused instead of pushing through on empty.',
      'You chose not to let tiredness become mindless scrolling.',
      'You protected what little focus you had left.',
    ],
    'Seek comfort': [
      'You asked for comfort without letting exhaustion decide for you.',
      'You named how tired you are before the feed took over.',
      'You chose rest with awareness instead of draining more energy.',
    ],
    Doomscroll: [
      'You stopped tired autopilot before it cost you another night.',
      'You noticed exhaustion pulling you under and paused.',
      'You kept fatigue from turning into another lost hour.',
    ],
  },
  Lost: {
    'Send message': [
      'You reached for a thread when you felt scattered — on purpose.',
      'You chose one connection instead of losing yourself in the feed.',
      'You anchored yourself with a deliberate reach-out.',
    ],
    'Create content': [
      'You named the fog before letting an algorithm fill it.',
      'You chose to make something instead of dissolving into scroll.',
      'You gave the scattered feeling a direction.',
    ],
    'Seek comfort': [
      'You chose comfort with awareness instead of disappearing into the feed.',
      'You admitted you feel lost before habit answered for you.',
      'You asked for ease without surrendering the rest of your evening.',
    ],
    Doomscroll: [
      'You interrupted the trance while you could still choose.',
      'You caught the lost feeling before it became another hour gone.',
      'You stopped drifting before the algorithm decided for you.',
    ],
  },
  Good: {
    'Send message': [
      'You reached out while you still feel like yourself.',
      'You chose connection from a good place — not on autopilot.',
      'You kept the good mood and still opened this on purpose.',
    ],
    'Create content': [
      'You showed up to create while you still feel clear and steady.',
      'You turned a good moment into something intentional.',
      'You chose to make something instead of letting the feed take the mood.',
    ],
    'Seek comfort': [
      'You asked for a little ease without letting habit decide.',
      'You named what you wanted while you still feel good.',
      'You chose comfort with awareness — not as a reflex.',
    ],
    Doomscroll: [
      'You caught the pull before a good moment turned into mindless scroll.',
      'You noticed the drift while you could still redirect it.',
      'You kept feeling good by pausing before autopilot took over.',
    ],
  },
};

function pickVariant(variants: readonly string[], mood: string, intent: string): string {
  const key = `${mood}:${intent}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash + key.charCodeAt(i) * (i + 7)) % variants.length;
  }
  return variants[hash] ?? variants[0];
}

export function reframeForLog(mood: string, intent: string): string {
  const m = mood as Mood;
  const i = intent as Intent;
  const variants = REFRAME_MATRIX[m]?.[i];
  if (!variants?.length) return 'You paused before habit took over.';
  return pickVariant(variants, mood, intent);
}

export function personalizedReflection(args: {
  hours: string;
  topTrigger: string;
  protectTarget: ProtectTarget | null;
}): string {
  const protect = protectTargetShort(args.protectTarget);
  return `You scroll for ${args.hours} hours a day, often when ${args.topTrigger.toLowerCase()}, and what you most want to protect is ${protect}.`;
}

export function stripOptionEmoji(label: string): string {
  return label.replace(/^[^\w\s'\u2019]+?\s*/u, '').trim();
}

function reflectionEscapePhrase(appIntent: string[], focusVulnerability: string | null): string {
  const escapeByIntent: Record<string, string> = {
    'Stay connected': 'feeling disconnected',
    'Learn something': 'not knowing enough',
    'Be entertained': 'boredom',
    'Pass the time': 'empty moments',
    Unwind: 'stress and tension',
    'Keep up with what\u2019s happening': 'falling behind',
  };

  for (const raw of appIntent) {
    const key = stripOptionEmoji(raw);
    const phrase = escapeByIntent[key];
    if (phrase) return phrase;
  }

  if (focusVulnerability) {
    const focus = stripOptionEmoji(focusVulnerability);
    if (focus.includes('deep work')) return 'when focus gets hard';
    if (focus.includes('Between')) return 'transitions between tasks';
    if (focus.includes('night')) return 'restlessness at night';
  }

  return 'the pull of the feed';
}

function reflectionFeelingPhrase(
  selfRelationship: string | null,
  phoneRelationship: string | null,
): string {
  const feelingBySelf: Record<string, string> = {
    'I\u2019m growing and learning': 'curious but stretched thin',
    'I feel mostly at peace with myself': 'calm, but a little numb',
    'I feel distracted or disconnected': 'disconnected from yourself',
    'I can be hard on myself sometimes': 'guilty or behind',
    'I\u2019m working on improving it': 'motivated but unfinished',
  };

  if (selfRelationship) {
    const key = stripOptionEmoji(selfRelationship);
    const phrase = feelingBySelf[key];
    if (phrase) return phrase;
  }

  if (phoneRelationship) {
    const phone = stripOptionEmoji(phoneRelationship);
    if (phone.includes('more time')) return 'like you\u2019re losing time';
    if (phone.includes('working on')) return 'ready for change, but stuck';
  }

  return 'a little off-balance';
}

export function digitalReflectionLines(args: {
  hours: string;
  appIntent: string[];
  focusVulnerability: string | null;
  selfRelationship: string | null;
  phoneRelationship: string | null;
}): { scrollHours: string; escape: string; feeling: string } {
  return {
    scrollHours: `${args.hours} hours/day`,
    escape: reflectionEscapePhrase(args.appIntent, args.focusVulnerability),
    feeling: reflectionFeelingPhrase(args.selfRelationship, args.phoneRelationship),
  };
}

export function primaryTrigger(triggers: string[]): string {
  if (triggers.length === 0) return 'boredom sets in';
  const t = triggers[0];
  if (t.includes('waking')) return 'you wake up';
  if (t.includes('working')) return 'work gets hard';
  if (t.includes('stress')) return 'stress or boredom hits';
  return t.toLowerCase();
}

export function hoursSliderTier(hours: number): 0 | 1 | 2 {
  if (hours <= 3) return 0;
  if (hours <= 6) return 1;
  return 2;
}
