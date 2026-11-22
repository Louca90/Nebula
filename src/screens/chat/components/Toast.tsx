import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Reanimated, { ReduceMotion, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { EASE } from '../../../motion';
import { createStyles, fixed, spacing, useColors } from '../../../theme';

import { TOAST_VISIBLE_MS } from '../constants';

const AnimatedPath = Reanimated.createAnimatedComponent(Path);
const CHECK_LENGTH = 24;
const config = (duration: number) => ({ duration, easing: EASE, reduceMotion: ReduceMotion.System });

// Une petite annonce en bas, au-dessus de la saisie (planche « Elvira · Notifications et toasts ») : une
// carte sombre monte de 24 points, la coche se dessine dans sa pastille violette, puis elle s'efface.
export function Toast({ text, token }: { text: string; token: number }) {
  const colors = useColors();
  const styles = useStyles();
  const shown = useSharedValue(0);
  const draw = useSharedValue(0);

  useEffect(() => {
    shown.set(0);
    draw.set(0);
    shown.set(withSequence(withTiming(1, config(260)), withDelay(TOAST_VISIBLE_MS, withTiming(2, config(220)))));
    draw.set(withDelay(160, withTiming(1, config(260))));
  }, [token, shown, draw]);

  const style = useAnimatedStyle(() => {
    const value = shown.get();
    // 0 → 1 : descend et apparaît ; 1 → 2 : remonte un peu et s'efface.
    const opacity = value <= 1 ? value : 2 - value;
    const translateY = value <= 1 ? 24 * (1 - value) : 10 * (value - 1);
    return { opacity, transform: [{ translateY }, { scale: value <= 1 ? 0.96 + 0.04 * value : 1 }] };
  });
  const check = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - draw.get()) }));

  return (
    <Reanimated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.toast, style]}>
      <View style={styles.badge}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <AnimatedPath d="M5 12.5 10 17 19 7" fill="none" stroke={colors.onSignature} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHECK_LENGTH} animatedProps={check} />
        </Svg>
      </View>
      <Text style={styles.toastText}>{text}</Text>
    </Reanimated.View>
  );
}

const useStyles = createStyles((colors) => ({
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: fixed.thumbFace,
    boxShadow: `0px 12px 30px ${colors.shadow}`,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
}));
