import { readJson, useCoupleVersion, writeJson } from './store';

// Nébula, carte « Humeur » de l'onglet Nous : chacun choisit comment il se sent, l'autre le voit.
// Mon humeur est envoyée chiffrée à l'autre téléphone ; la sienne arrive de la même façon.

export const MOODS = ['radieuse', 'bien', 'calme', 'fatiguee', 'triste', 'stressee', 'enervee', 'malade', 'amoureuse'] as const;
export type MoodId = (typeof MOODS)[number];
export const MOOD_EMOJI: Record<MoodId, string> = {
  radieuse: '🥰',
  bien: '😊',
  calme: '😌',
  fatiguee: '😴',
  triste: '😢',
  stressee: '😰',
  enervee: '😤',
  malade: '🤒',
  amoureuse: '😍',
};

export type Mood = { mood: MoodId; at: number };
export type Moods = { mine: Mood | null; theirs: Mood | null };

const KEY = 'couple.moods';
// Une humeur de plus d'un jour n'est plus montrée comme actuelle.
export const MOOD_FRESH_MS = 24 * 3600 * 1000;

export function getMoods(): Moods {
  return readJson<Moods>(KEY, { mine: null, theirs: null });
}

export function setMyMood(mood: MoodId): Mood {
  const value = { mood, at: Date.now() };
  writeJson(KEY, { ...getMoods(), mine: value });
  return value;
}

export function isMood(value: unknown): value is MoodId {
  return typeof value === 'string' && (MOODS as readonly string[]).includes(value);
}

// Son humeur, reçue de l'autre téléphone (la plus récente gagne). Rend true si elle a changé.
export function receiveMood(mood: MoodId, at: number): boolean {
  const moods = getMoods();
  if (moods.theirs && moods.theirs.at >= at) return false;
  writeJson(KEY, { ...moods, theirs: { mood, at } });
  return true;
}

export function useMoods(): Moods {
  useCoupleVersion();
  return getMoods();
}
