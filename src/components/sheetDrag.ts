import { useRef } from 'react';
import { PanResponder } from 'react-native';
import { Easing, ReduceMotion, useSharedValue, withTiming } from 'react-native-reanimated';

// Nébula (à reprendre aussi dans Pear) : la poignée des feuilles du bas fait ce qu'elle montre. On tire la
// barre du haut (poignée et titre) vers le bas : la feuille suit le doigt ; au-delà d'un seuil, ou d'un
// geste rapide, elle finit de se fermer, sinon elle remonte. Un simple appui sur la poignée ferme aussi.
// Toucher le voile autour ferme (chaque feuille garde son voile qui appelle close).
const TAP_SLOP = 6;
const CLOSE_DISTANCE = 110;
const CLOSE_SPEED = 0.9;
const BACK = { duration: 220, easing: Easing.bezier(0.32, 0.72, 0, 1), reduceMotion: ReduceMotion.System };

export function useSheetDrag(close: () => void, enabled = true) {
  // Déplacement vers le bas sous le doigt (s'ajoute à la position de la feuille).
  const drag = useSharedValue(0);
  const latest = useRef({ close, enabled });
  latest.current = { close, enabled };
  const handlers = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.enabled,
      onMoveShouldSetPanResponder: (_event, gesture) => latest.current.enabled && Math.abs(gesture.dy) > TAP_SLOP,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture) => drag.set(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dy) < TAP_SLOP || gesture.dy > CLOSE_DISTANCE || gesture.vy > CLOSE_SPEED) latest.current.close();
        else drag.set(withTiming(0, BACK));
      },
      onPanResponderTerminate: () => drag.set(withTiming(0, BACK)),
    }),
  ).current.panHandlers;
  return { drag, handlers };
}
