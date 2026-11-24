import { useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { makeMutable, type SharedValue } from 'react-native-reanimated';

// Nébula : le glisser de lecture d'un vocal garde la main jusqu'à ce qu'on lâche, même si le doigt sort
// de la bulle. Pendant ce temps, le glisser pour répondre est ignoré (useSwipeReply lit voiceSeeking sur
// le fil de l'interface) et la liste ne défile pas (onResponderGrant rend true : le geste natif est
// bloqué). L'affichage suit le doigt sur le fil natif ; le lecteur n'est déplacé qu'à intervalles
// réguliers pendant le glisser, puis exactement au lâcher : c'est fluide.
export const voiceSeeking = makeMutable(false);

const SEEK_EVERY_MS = 120;

type Options = {
  // Largeur utile et décalage du début de la piste dans la zone tactile.
  measure: () => { width: number; inset: number };
  shown: SharedValue<number>;
  drag: SharedValue<number>;
  onSeek: (ratio: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
};

export function useVoiceSeek({ measure, shown, drag, onSeek, onStart, onEnd }: Options) {
  const origin = useRef(0);
  const lastSeek = useRef(0);
  const latest = useRef({ measure, onSeek, onStart, onEnd });
  latest.current = { measure, onSeek, onStart, onEnd };

  const ratioAt = (pageX: number) => {
    const { width, inset } = latest.current.measure();
    if (width <= 0) return null;
    return Math.max(0, Math.min(1, (pageX - origin.current - inset) / width));
  };

  const move = (pageX: number, final: boolean) => {
    const ratio = ratioAt(pageX);
    if (ratio === null) return;
    drag.set(ratio);
    const now = Date.now();
    if (final || now - lastSeek.current >= SEEK_EVERY_MS) {
      lastSeek.current = now;
      latest.current.onSeek(ratio);
    }
  };

  const end = (event?: GestureResponderEvent) => {
    if (event) move(event.nativeEvent.pageX, true);
    // La position affichée reste là où on a lâché, le temps que le lecteur donne la sienne.
    if (drag.get() >= 0) shown.set(drag.get());
    drag.set(-1);
    voiceSeeking.set(false);
    latest.current.onEnd?.();
  };

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (event: GestureResponderEvent) => {
      const { pageX, locationX } = event.nativeEvent;
      origin.current = pageX - locationX;
      voiceSeeking.set(true);
      latest.current.onStart?.();
      move(pageX, true);
      // true : le geste natif (défilement de la liste) est bloqué jusqu'au lâcher.
      return true;
    },
    onResponderMove: (event: GestureResponderEvent) => move(event.nativeEvent.pageX, false),
    onResponderRelease: (event: GestureResponderEvent) => end(event),
    onResponderTerminate: () => end(),
  };
}
