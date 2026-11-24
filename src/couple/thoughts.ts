import { readJson, useCoupleVersion, writeJson } from './store';

// « Pense à toi » (planche du même nom) : un geste sans texte. On garde les derniers, envoyés et reçus.
export type Thought = { mine: boolean; at: number; id?: string };

const KEY = 'couple.thoughts';
// Nébula : plus de plafond (il était de 200, et le compteur du jour s'arrêtait là). On garde toutes les
// pensées des deux derniers jours, sans limite de nombre : c'est tout ce que les écrans affichent.
const KEEP_MS = 2 * 24 * 3600 * 1000;

export function getThoughts(): Thought[] {
  return readJson<Thought[]>(KEY, []);
}

export function addThought(mine: boolean, at: number, id?: string): boolean {
  const all = getThoughts();
  // Un événement renvoyé après un accusé perdu ne compte qu'une fois.
  if (id && all.some((thought) => thought.id === id)) return false;
  const since = startOfToday() - KEEP_MS;
  writeJson(KEY, [...all.filter((thought) => thought.at >= since), { mine, at, ...(id ? { id } : {}) }]);
  return true;
}

// Ses pensées reçues aujourd'hui et l'heure de la dernière (pour la notification).
export function theirThoughtsToday(): { count: number; last: number | null } {
  const since = startOfToday();
  const theirs = getThoughts().filter((thought) => !thought.mine && thought.at >= since);
  return { count: theirs.length, last: theirs.length ? Math.max(...theirs.map((thought) => thought.at)) : null };
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
