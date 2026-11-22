import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Reanimated, { Easing, FadeIn, FadeOut, useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { LILY_PATHS } from '../../../components/Lily';
import { t } from '../../../i18n';
import { createStyles, fixed } from '../../../theme';
import { ephemeralLabel } from '../format';

// Planche « Messages éphémères » : en haut de la conversation, le lys dont un pétale tombe puis revient,
// en boucle, et la durée choisie. Courbe douce, sans rebond.
const AnimatedG = Reanimated.createAnimatedComponent(G);
const EASE = Easing.bezier(0.4, 0, 0.6, 1);
const FALL_MS = 1500;
const REST_MS = 900;

export function EphemeralBanner({ seconds }: { seconds: number }) {
  const styles = useStyles();
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.set(
      withRepeat(
        withSequence(withTiming(0, { duration: REST_MS }), withTiming(1, { duration: FALL_MS, easing: EASE }), withTiming(0, { duration: 1 }), withTiming(0, { duration: 300 })),
        -1,
        false,
      ),
    );
  }, [fall]);
  // Le pétale droit glisse vers le bas en tournant autour de sa base, et s'efface.
  const petal = useAnimatedProps(() => {
    const k = fall.get();
    const angle = (50 * Math.PI * k) / 180;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const ox = 54;
    const oy = 67;
    return { matrix: [c, s, -s, c, ox - c * ox + s * oy + 14 * k, oy - s * ox - c * oy + 46 * k], opacity: 1 - k } as object;
  });
  const color = fixed.onSignatureSoft;
  return (
    <Reanimated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={styles.banner}>
      <Svg width={40} height={38} viewBox="4 10 92 88" style={styles.icon}>
        <Path d={LILY_PATHS.left} fill={color} />
        <AnimatedG animatedProps={petal}>
          <Path d={LILY_PATHS.right} fill={color} />
        </AnimatedG>
        <Path d={LILY_PATHS.stamens} fill={color} />
        <Path d={LILY_PATHS.heart} fill={color} />
        <Path d={LILY_PATHS.stem} fill={color} />
      </Svg>
      <View style={styles.textWrap}>
        <Text style={styles.text}>{t('ephemere.bandeau', { duree: ephemeralLabel(seconds) })}</Text>
      </View>
    </Reanimated.View>
  );
}

const useStyles = createStyles((colors) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    marginHorizontal: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.signature,
  },
  icon: {
    overflow: 'visible',
  },
  textWrap: {
    flex: 1,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
    color: fixed.onSignatureSoft,
  },
}));
