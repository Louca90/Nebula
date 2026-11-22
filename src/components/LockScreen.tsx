import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { authenticate } from '../../modules/pear-native';
import { haptics } from '../haptics';
import { t } from '../i18n';
import { Lily } from './Lily';
import { Backdrop } from './nebula';
import { createStyles, fixed, useColors } from '../theme';

// Planche « Nébula · Verrou » : le lys fermé, et la nouvelle empreinte (des arcs réguliers et
// symétriques, tracés du centre vers le bord). Reconnue : les arcs passent en lilas et le lys s'ouvre.
// Ratée : ils passent en rouge et l'empreinte tremble doucement. La demande d'Android se lance seule ;
// toucher l'empreinte la relance.
// waiting : on ne sait pas encore si le verrou est activé ; l'écran couvre l'app sans rien demander.

// Les arcs, du centre vers le bord, et leur longueur (un peu au-dessus de la vraie) pour le tracé.
const RIDGES = [
  { d: 'M12 11.5v8', length: 9 },
  { d: 'M9.5 19.5v-8a2.5 2.5 0 0 1 5 0v6.5', length: 23 },
  { d: 'M7 17.5v-6a5 5 0 0 1 10 0v8.5', length: 31 },
  { d: 'M4.5 15v-3.5a7.5 7.5 0 0 1 15 0v4.5', length: 33 },
  { d: 'M3.2 8.2A9.4 9.4 0 0 1 20.8 8.2', length: 24 },
];
const RIDGE_STEP_MS = 90;
const DRAW_MS = 900;
const OPEN_DELAY_MS = 650;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const AnimatedPath = Reanimated.createAnimatedComponent(Path);

type State = 'idle' | 'scan' | 'ok' | 'bad';

function Ridge({ d, length, index, drawn, color }: { d: string; length: number; index: number; drawn: boolean; color: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(drawn ? index * RIDGE_STEP_MS : 0, withTiming(drawn ? 1 : 0, { duration: drawn ? DRAW_MS : 300, easing: EASE })));
  }, [drawn, index, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.get()) }));
  return <AnimatedPath d={d} fill="none" stroke={color} strokeWidth={1.15} strokeLinecap="round" strokeDasharray={length} animatedProps={props} />;
}

export function LockScreen({ onUnlock, waiting = false }: { onUnlock: () => void; waiting?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const asking = useRef(false);
  const [state, setState] = useState<State>('idle');
  const open = useSharedValue(0);
  const shake = useSharedValue(0);
  const ring = useSharedValue(0);

  const ask = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    setState('scan');
    try {
      // Sans verrou d'écran sur le téléphone, rien ne peut être demandé : l'app s'ouvre.
      const result = await authenticate(t('reglages.verrouTitre'));
      if (result !== 'cancelled') {
        haptics.success();
        setState('ok');
        open.set(withTiming(1, { duration: 620, easing: EASE }));
        setTimeout(onUnlock, OPEN_DELAY_MS);
      } else {
        haptics.error();
        setState('bad');
        shake.set(withSequence(...[-8, 7, -4, 2, 0].map((x) => withTiming(x, { duration: 80, easing: EASE }))));
        setTimeout(() => setState((current) => (current === 'bad' ? 'idle' : current)), 1200);
      }
    } finally {
      asking.current = false;
    }
  }, [onUnlock, open, shake]);

  useEffect(() => {
    if (!waiting) ask();
  }, [ask, waiting]);

  // L'onde qui invite à poser le doigt, tant que rien ne se passe.
  const idle = state === 'idle';
  useEffect(() => {
    if (idle) {
      ring.set(0);
      ring.set(withRepeat(withTiming(1, { duration: 2200, easing: EASE }), -1, false));
    } else ring.set(withTiming(1, { duration: 200 }));
  }, [idle, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ring.get()), transform: [{ scale: 0.9 + 0.7 * ring.get() }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  if (waiting) return <View style={[StyleSheet.absoluteFill, styles.root]} />;
  const ridgeColor = state === 'ok' ? fixed.lilac : state === 'bad' ? colors.danger : colors.text;
  const title = state === 'ok' ? t('verrou.bonRetour') : t('verrou.titre');
  const hint = state === 'scan' ? t('verrou.garde') : state === 'bad' ? t('verrou.echec') : state === 'ok' ? '' : t('verrou.poser');
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Backdrop kind="horizon" />
      <View style={styles.top}>
        <Lily size={58} color={colors.text} open={open} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{t('verrou.sousTitre')}</Text>
      </View>
      <Reanimated.View style={[styles.sensor, shakeStyle]}>
        <Reanimated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <Pressable onPress={ask} accessibilityRole="button" accessibilityLabel={t('reglages.deverrouiller')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Svg width={68} height={68} viewBox="0 0 24 24">
            {RIDGES.map(({ d }) => (
              <Path key={d} d={d} fill="none" stroke={fixed.ridgeIdle} strokeWidth={1.15} strokeLinecap="round" />
            ))}
            {RIDGES.map(({ d, length }, index) => (
              <Ridge key={`l${d}`} d={d} length={length} index={index} drawn={!idle} color={ridgeColor} />
            ))}
          </Svg>
        </Pressable>
      </Reanimated.View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: {
    backgroundColor: colors.background,
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
  },
  top: {
    marginTop: 140,
    alignItems: 'center',
  },
  title: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: fixed.mutedLight,
  },
  sensor: {
    marginTop: 'auto',
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 66,
    borderWidth: 1.5,
    borderColor: fixed.lilac,
  },
  button: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: fixed.sensor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  hint: {
    marginTop: 18,
    marginBottom: 120,
    minHeight: 18,
    fontSize: 13,
    color: fixed.mutedLight,
  },
}));
