import { readJson, useCoupleVersion, writeJson } from './store';

// « Pense à toi » (planche du même nom) : un geste sans texte. On garde les derniers, envoyés et reçus.
export type Thought = { mine: boolean; at: number; id?: string };

const KEY = 'couple.thoughts';
const KEEP = 200;

export function getThoughts(): Thought[] {
  return readJson<Thought[]>(KEY, []);
}

export function addThought(mine: boolean, at: number, id?: string): boolean {
  const all = getThoughts();
  // Un événement renvoyé après un accusé perdu ne compte qu'une fois.
  if (id && all.some((thought) => thought.id === id)) return false;
  writeJson(KEY, [...all, { mine, at, ...(id ? { id } : {}) }].slice(-KEEP));
  return true;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

// Ses pensées reçues aujourd'hui (le chiffre à côté du lys sur l'onglet Nous).
export function useThoughtsToday(): number {
  useCoupleVersion();
  const since = startOfToday();
  return getThoughts().filter((thought) => !thought.mine && thought.at >= since).length;
}

// Les deux sens, aujourd'hui, pour l'écran Pense à toi.
export function useThoughtStats(): { mineToday: number; theirsToday: number; lastTheirs: number | null } {
  useCoupleVersion();
  const since = startOfToday();
  const all = getThoughts();
  const theirs = all.filter((thought) => !thought.mine);
  return {
    mineToday: all.filter((thought) => thought.mine && thought.at >= since).length,
    theirsToday: theirs.filter((thought) => thought.at >= since).length,
    lastTheirs: theirs.length ? theirs[theirs.length - 1].at : null,
  };
}
