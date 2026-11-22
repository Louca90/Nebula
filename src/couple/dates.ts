import { readJson, useCoupleVersion, writeJson } from './store';

// Nos dates (planche « Nos dates ») : la prochaine fois qu'on se voit, et les dates à ne pas oublier.
// La même liste sur les deux téléphones : la plus récente modification gagne (`updatedAt`).
export type CoupleDate = { id: string; title: string; at: number; yearly: boolean };
export type CoupleDates = { next: number | null; dates: CoupleDate[]; updatedAt: number };

const KEY = 'couple.dates';
const EMPTY: CoupleDates = { next: null, dates: [], updatedAt: 0 };
const DAY = 24 * 3600 * 1000;
export const MAX_DATES = 30;
export const MAX_TITLE = 60;

export function getDates(): CoupleDates {
  return readJson(KEY, EMPTY);
}

export function saveDates(next: CoupleDates) {
  writeJson(KEY, next);
}

// Reçu de l'autre téléphone : gardé seulement s'il est plus récent que le nôtre.
export function mergeDates(incoming: CoupleDates): boolean {
  if (incoming.updatedAt <= getDates().updatedAt) return false;
  saveDates(incoming);
  return true;
}

// Vérifie un objet reçu : rien d'autre que des dates valables, tailles bornées.
export function parseDates(value: unknown): CoupleDates | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!Number.isSafeInteger(data.updatedAt)) return null;
  const next = data.next === null ? null : Number.isSafeInteger(data.next) ? (data.next as number) : undefined;
  if (next === undefined || !Array.isArray(data.dates)) return null;
  const dates: CoupleDate[] = [];
  for (const item of data.dates.slice(0, MAX_DATES)) {
    if (!item || typeof item !== 'object') return null;
    const date = item as Record<string, unknown>;
    if (typeof date.id !== 'string' || date.id.length > 64 || typeof date.title !== 'string' || !Number.isSafeInteger(date.at)) return null;
    dates.push({ id: date.id, title: date.title.slice(0, MAX_TITLE), at: date.at as number, yearly: date.yearly === true });
  }
  return { next, dates, updatedAt: data.updatedAt as number };
}

// Jours restants jusqu'à `at`, arrondis au jour du calendrier (demain = 1).
export function daysUntil(at: number, now: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(at);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY));
}

// La prochaine occurrence d'une date (les anniversaires reviennent chaque année).
export function nextOccurrence(date: CoupleDate, now: number): number {
  if (!date.yearly) return date.at;
  const at = new Date(date.at);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(at);
  candidate.setFullYear(today.getFullYear());
  if (candidate.getTime() < today.getTime()) candidate.setFullYear(today.getFullYear() + 1);
  return candidate.getTime();
}

// La prochaine fois qu'on se voit, si elle n'est pas passée.
export function useNextDate(): number | null {
  useCoupleVersion();
  const { next } = getDates();
  if (next === null) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return next >= today.getTime() ? next : null;
}

export function useDates(): CoupleDates {
  useCoupleVersion();
  return getDates();
}
