import catalog from '../../../shared/topics.json';

export type Difficulty = 'basic' | 'intermediate' | 'advanced';
export type Frequency = 'daily' | 'weekdays' | 'weekly';

export type Topic = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  bg: string;
  fg: string;
};

export type TopicPref = {
  topic_id: string;
  enabled: boolean;
  difficulty: Difficulty;
  frequency: Frequency;
  weekly_day: number; // 0 = Monday ... 6 = Sunday
  custom_notes: string;
};

export const CATEGORIES: { id: string; name: string }[] = catalog.categories;
export const TOPICS: Topic[] = catalog.topics.map(({ id, name, category, emoji, bg, fg }) => ({ id, name, category, emoji, bg, fg }));
export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

export const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'basic', label: 'Basic', hint: 'Every term explained, big picture first' },
  { id: 'intermediate', label: 'Intermediate', hint: 'You know the lingo, want the why' },
  { id: 'advanced', label: 'Advanced', hint: 'Full detail, cross-market angles' },
];

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Weekly' },
];

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function scheduleLabel(p: TopicPref): string {
  if (p.frequency === 'weekly') return `Weekly · ${WEEKDAYS[p.weekly_day]}`;
  return p.frequency === 'daily' ? 'Every day' : 'Weekdays';
}

export function defaultPref(topic_id: string): TopicPref {
  return { topic_id, enabled: true, difficulty: 'basic', frequency: 'weekdays', weekly_day: 6, custom_notes: '' };
}

/** Same rules as the pipeline (pipeline/easymarket/schedule.py). */
export function isDue(p: TopicPref, date: Date): boolean {
  if (!p.enabled) return false;
  const weekday = (date.getDay() + 6) % 7; // JS Sunday=0 -> Monday=0
  if (p.frequency === 'daily') return true;
  if (p.frequency === 'weekdays') return weekday < 5;
  return weekday === p.weekly_day;
}
