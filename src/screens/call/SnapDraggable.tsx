import { ReactNode, useEffect, useRef } from 'react';
import { PanResponder, StyleProp, ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { timing } from '../../motion';

// Un élément qu'on déplace au doigt et qui, lâché, glisse vers la place la plus proche parmi `slots`
// (coins de l'écran pour la vignette vidéo, haut ou bas pour la pastille d'appel). L'élan du geste
// compte : un lancer vers un coin l'y envoie. Courbe douce, sans rebond. Un simple appui appelle onTap.
//
// Nébula : gestes du système de toucher de React Native (PanResponder), et plus de gesture-handler.
// Posée par-dessus toute l'app, la pastille ne recevait ni l'appui ni le glissé.

export type Slot = { x: number; y: number };

const SNAP_MS = 260;
// Combien de temps d'élan on projette pour choisir la place (secondes).
const THROW = 0.18;
// En dessous de ce déplacement, c'est un appui, pas un glissé.
const TAP_SLOP = 6;

export function SnapDraggable({
  slots,
  initial = 0,
  onTap,
  style,
  children,
}: {
  slots: Slot[];
  initial?: number;
  onTap?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const start = slots[Math.min(initial, slots.length - 1)] ?? { x: 0, y: 0 };
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const lifted = useSharedValue(0);
  const latest = useRef({ slots, onTap, current: initial, fromX: start.x, fromY: start.y, moved: false });
  latest.current.slots = slots;
  latest.current.onTap = onTap;

  // L'écran change de taille (fenêtre flottante, rotation) : on reste à la même place relative.
  useEffect(() => {
    const slot = slots[Math.min(latest.current.current, slots.length - 1)];
    if (slot) {
      x.set(timing(slot.x, SNAP_MS));
      y.set(timing(slot.y, SNAP_MS));
    }
  }, [slots, x, y]);

  const snap = (vx: number, vy: number) => {
    const state = latest.current;
    const aimX = x.get() + vx * THROW;
    const aimY = y.get() + vy * THROW;
    let best = 0;
    let bestDistance = Infinity;
    state.slots.forEach((slot, index) => {
      const distance = (slot.x - aimX) ** 2 + (slot.y - aimY) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    state.current = best;
    const target = state.slots[best];
    if (target) {
      x.set(timing(target.x, SNAP_MS));
      y.set(timing(target.y, SNAP_MS));
    }
    lifted.set(timing(0, 160));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const state = latest.current;
        state.fromX = x.get();
        state.fromY = y.get();
        state.moved = false;
      },
      onPanResponderMove: (_event, gesture) => {
        const state = latest.current;
        if (!state.moved && Math.abs(gesture.dx) + Math.abs(gesture.dy) < TAP_SLOP) return;
        if (!state.moved) {
          state.moved = true;
          lifted.set(timing(1, 120));
        }
        x.set(state.fromX + gesture.dx);
        y.set(state.fromY + gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (!latest.current.moved) {
          latest.current.onTap?.();
          return;
        }
        // PanResponder donne l'élan en points par milliseconde.
        snap(gesture.vx * 1000, gesture.vy * 1000);
      },
      onPanResponderTerminate: () => snap(0, 0),
    }),
  ).current;

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: 1 + 0.04 * lifted.get() }],
    shadowOpacity: 0.25 * lifted.get(),
  }));

  return (
    <Reanimated.View collapsable={false} {...responder.panHandlers} style={[{ position: 'absolute', left: 0, top: 0 }, style, animated]}>
      {children}
    </Reanimated.View>
  );
}
