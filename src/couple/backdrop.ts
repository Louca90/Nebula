import type { BackdropKind } from '../components/nebula';
import { readJson, useCoupleVersion, writeJson } from './store';

// Le fond à grain des conversations, choisi dans le Profil (planche « Réglages » : Fond des
// conversations). Soie est réservé au mode éphémère (planche « Fonds »).
export const CHAT_BACKDROPS: BackdropKind[] = ['aube', 'spot', 'horizon', 'amethyste'];
const KEY = 'couple.chatBackdrop';

export function getChatBackdrop(): BackdropKind {
  const saved = readJson<string>(KEY, 'aube');
  return (CHAT_BACKDROPS as string[]).includes(saved) ? (saved as BackdropKind) : 'aube';
}

export function setChatBackdrop(kind: BackdropKind) {
  writeJson(KEY, kind);
}

export function useChatBackdrop(): BackdropKind {
  useCoupleVersion();
  return getChatBackdrop();
}
