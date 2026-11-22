import { useSyncExternalStore } from 'react';

import { getSetting, setSetting } from '../chat/database';
import { log } from '../log';

// Les données de couple de Nébula (dates, « pense à toi ») : petites, gardées en JSON dans les réglages
// de la base chiffrée, et partagées avec l'autre téléphone par des événements chiffrés (voir sync.ts).
const listeners = new Set<() => void>();
let version = 0;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = getSetting(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    log.warn('couple', e);
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  setSetting(key, JSON.stringify(value));
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Redessine quand une donnée de couple change (ici ou reçue de l'autre téléphone).
export function useCoupleVersion() {
  return useSyncExternalStore(subscribe, () => version);
}
