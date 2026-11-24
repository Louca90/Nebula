import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { timing } from '../../../motion';
import { radius } from '../../../theme';

import { SEEK_THUMB_SIZE } from '../constants';
import { useSmoothProgress } from '../hooks/useSmoothProgress';
import { useVoiceSeek } from '../voiceSeek';

type SeekBarProps = {
  position: number;
  // Part de la durée parcourue par seconde pendant la lecture (0 en pause) : la barre avance en continu.
  speed?: number;
  color: string;
  trackColor: string;
  label: string;
  onSeek: (ratio: number) => void;
};

// Une fois la barre attrapée, le doigt peut aller n'importe où : la position suit seulement sa place à l'horizontale.
// Bloquer le geste natif empêche aussi la liste de défiler, jusqu'à ce qu'on lâche.
// Le remplissage et le curseur bougent sur le fil natif.
export function SeekBar({ position, speed = 0, color, trackColor, label, onSeek }: SeekBarProps) {
  const [width, setWidth] = useState(0);
  const thumb = useSharedValue(1);
  const drag = useSharedValue(-1);
  const trackWidth = Math.max(0, width - SEEK_THUMB_SIZE);
  const shown = useSmoothProgress(position, speed, null);
  const at = () => {
    'worklet';
    return drag.get() >= 0 ? drag.get() : shown.get();
  };
  const fillStyle = useAnimatedStyle(() => ({ width: at() * trackWidth }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: at() * trackWidth }, { scale: thumb.get() }] }));
  const handlers = useVoiceSeek({
    measure: () => ({ width: trackWidth, inset: SEEK_THUMB_SIZE / 2 }),
    shown,
    drag,
    onSeek,
    onStart: () => thumb.set(timing(1.4, 160)),
    onEnd: () => thumb.set(timing(1, 160)),
  });

  return (
    <View collapsable={false} style={styles.seekArea} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...handlers} accessibilityLabel={label}>
      <View pointerEvents="none" style={[styles.seekTrack, { backgroundColor: trackColor }]}>
        <Reanimated.View style={[styles.seekBar, { backgroundColor: color }, fillStyle]} />
      </View>
      <Reanimated.View pointerEvents="none" style={[styles.seekThumb, { backgroundColor: color }, thumbStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  seekArea: {
    height: 44,
    justifyContent: 'center',
  },
  seekTrack: {
    marginHorizontal: SEEK_THUMB_SIZE / 2,
    height: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  seekBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 4,
  },
  seekThumb: {
    position: 'absolute',
    left: 0,
    top: (44 - SEEK_THUMB_SIZE) / 2,
    width: SEEK_THUMB_SIZE,
    height: SEEK_THUMB_SIZE,
    borderRadius: radius.full,
  },
});
