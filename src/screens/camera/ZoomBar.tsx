import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Reanimated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { haptics } from '../../haptics';

import type { WideLens } from '../../../modules/pear-native/camera';
import { t } from '../../i18n';
import { DURATION, timing } from '../../motion';
import { createMediaStyles, fixed, radius } from '../../theme';

const PILL_HEIGHT = 32;
const PILL_MIN_WIDTH = 40;

export type ZoomLevel = { id: 'wide' | '1' | '2'; value: number; zoom: number; lens: string | null };

// 0,6 → « 0,6 » ; 1 → « 1 » ; 1,43 → « 1,4 ».
function format(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace('.', ',');
}

export function zoomLevels(wide: WideLens | null, maxZoom: number): ZoomLevel[] {
  const levels: ZoomLevel[] = [];
  if (wide) levels.push({ id: 'wide', value: wide.label, zoom: wide.zoom, lens: wide.cameraId });
  levels.push({ id: '1', value: 1, zoom: 1, lens: null });
  if (maxZoom >= 2) levels.push({ id: '2', value: 2, zoom: 2, lens: null });
  return levels;
}

// La pastille du niveau en cours : l'ultra grand-angle, ×1 jusqu'à ×2, puis ×2 et au-delà.
export function activeLevel(levels: ZoomLevel[], wide: WideLens | null, zoom: number, lens: string | null): ZoomLevel['id'] {
  if (wide && ((wide.cameraId && lens === wide.cameraId) || (!wide.cameraId && zoom <= wide.zoom + 0.05))) return 'wide';
  return zoom >= 1.95 && levels.some((level) => level.id === '2') ? '2' : '1';
}

// Active : la pastille se remplit du lilas clair des boutons à grain ; les autres restent en fumée.
function Pill({ level, active, zoom, lens, onPress }: { level: ZoomLevel; active: boolean; zoom: number; lens: string | null; onPress: () => void }) {
  const styles = useStyles();
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    on.set(timing(active ? 1 : 0, DURATION.small));
  }, [active]);
  const pillStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.get(), [0, 1], [fixed.smokeButton, fixed.grainButton]) }));
  const labelStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.get(), [0, 1], [fixed.white, fixed.onGrainButton]) }));
  // Sur l'objectif ultra grand-angle séparé, le zoom de cet objectif multiplie son propre rapport.
  const shown = !active ? level.value : level.id === 'wide' && lens ? level.value * zoom : zoom;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('camera.zoom', { valeur: format(level.value) })} accessibilityState={{ selected: active }}>
      <Reanimated.View style={[styles.pill, pillStyle]}>
        <Reanimated.Text style={[styles.label, labelStyle]}>{active ? `${format(shown)}×` : format(level.value)}</Reanimated.Text>
      </Reanimated.View>
    </Pressable>
  );
}

type Props = { levels: ZoomLevel[]; active: ZoomLevel['id']; zoom: number; lens: string | null; bottom: number; onChoose: (level: ZoomLevel) => void };

export function ZoomBar({ levels, active, zoom, lens, bottom, onChoose }: Props) {
  const styles = useStyles();
  if (levels.length < 2) return null;
  return (
    <View pointerEvents="box-none" style={[styles.bar, { bottom }]}>
      <View style={styles.track}>
        {levels.map((level) => (
          <Pill
            key={level.id}
            level={level}
            active={level.id === active}
            zoom={zoom}
            lens={lens}
            onPress={() => {
              haptics.select();
              onChoose(level);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const useStyles = createMediaStyles(() => ({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    minWidth: PILL_MIN_WIDTH,
    height: PILL_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
}));
