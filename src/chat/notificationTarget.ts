import { useSyncExternalStore } from 'react';

// La conversation visée par la dernière notification touchée. L'appui peut arriver avant que l'écran
// soit prêt (app fermée ou en arrière-plan) : il est mémorisé ici, puis App l'ouvre dès qu'elle peut.
let target: string | null = null;
// Cible particulière : la page des demandes d'ajout.
export const REQUESTS_TARGET = '#requests';
// Nébula : l'écran Pense à toi (suivi de la clé du contact), et le suivi du cycle.
export const PENSE_PREFIX = '#pense:';
export const CYCLE_TARGET = '#cycle';

// La cible d'une notification d'après ses données : une pensée ouvre Pense à toi, le cycle son écran,
// le reste la conversation.
export function targetOf(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  if (typeof data.thought === 'string') return PENSE_PREFIX + data.thought;
  if (data.cycle) return CYCLE_TARGET;
  return typeof data.contact === 'string' ? data.contact : undefined;
}
const listeners = new Set<() => void>();

export function setNotificationTarget(contact: unknown) {
  if (typeof contact !== 'string') return;
  target = contact;
  listeners.forEach((listener) => listener());
}

export function clearNotificationTarget() {
  target = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotificationTarget() {
  return useSyncExternalStore(subscribe, () => target);
}
