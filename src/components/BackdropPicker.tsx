import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { CHAT_BACKDROPS, setChatBackdrop, useChatBackdrop } from '../couple/backdrop';
import { haptics } from '../haptics';
import { t } from '../i18n';
import { DURATION, timing } from '../motion';
import { createStyles, fixed } from '../theme';
import { Backdrop, type BackdropKind } from './nebula';

// Planche « Réglages » : quatre aperçus des fonds à grain ; celui choisi grandit et prend un anneau lilas.
function Swatch({ kind, selected, onPress }: { kind: BackdropKind; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(timing(selected ? 1 : 0, DURATION.mascot));
  }, [selected, on]);
  const frame = useAnimatedStyle(() => ({ transform: [{ scale: 0.94 + 0.06 * on.get() }] }));
  const ring = useAnimatedStyle(() => ({ opacity: on.get() }));
  const label = t(`fonds.${kind}`);
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={label} style={styles.item}>
      <Reanimated.View style={[styles.frame, frame]}>
        <Reanimated.View pointerEvents="none" style={[styles.ring, ring]} />
        <View style={styles.tile}>
          <Backdrop kind={kind} />
        </View>
      </Reanimated.View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function BackdropPicker() {
  const styles = useStyles();
  const current = useChatBackdrop();
  return (
    <View style={styles.grid}>
      {CHAT_BACKDROPS.map((kind) => (
        <Swatch
          key={kind}
          kind={kind}
          selected={kind === current}
          onPress={() => {
            if (kind === current) return;
            haptics.select();
            setChatBackdrop(kind);
          }}
        />
      ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  frame: {
    alignSelf: 'stretch',
    height: 84,
  },
  ring: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: fixed.lilac,
  },
  tile: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  label: {
    fontSize: 12,
    color: fixed.mutedLight,
  },
}));
