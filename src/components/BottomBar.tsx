import { useEffect, useState, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Reanimated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { haptics } from '../haptics';
import { createStyles, fixed, radius, spacing, useColors } from '../theme';
import { useNavigationBarHeight } from './ui';
import { t } from '../i18n';
import { DURATION, timing } from '../motion';
import { Lily } from './Lily';

export type Tab = 'home' | 'map' | 'profile';

// Planche « Nébula · onglets » : Nous (le lys), Carte, Profil. Emplacements de 64 × 52 séparés de 4 points,
// une pastille qui glisse sous l'onglet choisi, et la pilule floutée en direct comme One UI.
const SLOT_WIDTH = 64;
const SLOT_HEIGHT = 52;
const SLOT_GAP = 4;
const BAR_PADDING = 6;
const ICON_SIZE = 24;
const LILY_SIZE = 26;
const SLIDE_MS = 300;
const SLIDE_STEP = SLOT_WIDTH + SLOT_GAP;
// Gros flou façon One UI. Sur Android, expo-blur tire de `intensity` à la fois le rayon (intensité ÷
// réduction, en pixels) et un voile gris (69 % d'opacité à 100) : à 100, le voile cachait le flou.
// Intensité basse = voile léger, réduction minuscule = rayon énorme (≈ 160 px). Teinte claire : un voile
// blanc d'environ 10 %, le verre dépoli lumineux de One UI (la teinte sombre donnait une pastille grise).
const BLUR_INTENSITY = 24;
const BLUR_REDUCTION = 0.15;

const AnimatedG = Reanimated.createAnimatedComponent(G);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedPath = Reanimated.createAnimatedComponent(Path);

type BlurTarget = RefObject<ComponentRef<typeof View> | null>;

// La place que les écrans laissent libre sous leur contenu, pour que la barre flottante ne le cache pas.
export function useBottomBarSpace() {
  return SLOT_HEIGHT + BAR_PADDING * 2 + spacing.md * 2 + useNavigationBarHeight();
}

// Carte : l'épingle descend et se pose, son ombre s'étire dessous.
function PinIcon({ play, color }: { play: SharedValue<number>; color: string }) {
  const pin = useAnimatedProps(() => {
    const p = play.get();
    return { matrix: [1, 0, 0, 1, 0, -8 * (1 - p)], opacity: p } as object;
  });
  const shadow = useAnimatedProps(() => {
    const k = Math.max(0, (play.get() - 0.4) / 0.6);
    return { matrix: [k, 0, 0, 1, 12 * (1 - k), 0] } as object;
  });
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <AnimatedG animatedProps={pin}>
        <Path d="M12 20s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
        <Circle cx={12} cy={9} r={2.3} />
      </AnimatedG>
      <AnimatedG animatedProps={shadow}>
        <Path d="M9 23h6" />
      </AnimatedG>
    </Svg>
  );
}

// Profil : la silhouette se dessine d'un trait, la tête puis les épaules.
const HEAD_LENGTH = 26;
const BODY_LENGTH = 24;
function ProfileIcon({ play, color }: { play: SharedValue<number>; color: string }) {
  const head = useAnimatedProps(() => ({ strokeDashoffset: HEAD_LENGTH * (1 - Math.min(1, play.get() / 0.6)) }));
  const body = useAnimatedProps(() => ({ strokeDashoffset: BODY_LENGTH * (1 - Math.max(0, (play.get() - 0.3) / 0.7)) }));
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <AnimatedCircle cx={12} cy={8} r={4} strokeDasharray={HEAD_LENGTH} animatedProps={head} />
      <AnimatedPath d="M4.5 21a7.5 7.5 0 0 1 15 0" strokeDasharray={BODY_LENGTH} animatedProps={body} />
    </Svg>
  );
}

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'home', label: t('onglets.messages') },
  { tab: 'map', label: t('carte.titre') },
  { tab: 'profile', label: t('profil.titre') },
];

function TabButton({ tab, label, active, onPress }: { tab: Tab; label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  // Le lys s'ouvre quand Nous est choisi et se replie sinon ; l'épingle et la silhouette rejouent leur
  // entrée à chaque sélection et restent entières au repos.
  const open = useSharedValue(active ? 1 : 0);
  const play = useSharedValue(1);

  useEffect(() => {
    open.set(timing(active ? 1 : 0, DURATION.mascot));
    if (active) {
      play.set(0);
      play.set(timing(1, DURATION.mascot));
    }
  }, [active, open, play]);

  const press = () => {
    haptics.select();
    if (active) {
      play.set(0);
      play.set(timing(1, DURATION.mascot));
    } else onPress();
  };

  const color = active ? colors.text : colors.textMuted;
  return (
    <Pressable onPress={press} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} style={styles.slot}>
      {tab === 'home' ? <Lily size={LILY_SIZE} color={color} open={open} /> : tab === 'map' ? <PinIcon play={play} color={color} /> : <ProfileIcon play={play} color={color} />}
    </Pressable>
  );
}

// La pilule flottante : le contenu passe dessous, flouté en direct. Elle reste au-dessus de la barre d'Android.
export function BottomBar({ active, onChange, blurTarget }: { active: Tab; onChange: (tab: Tab) => void; blurTarget?: BlurTarget }) {
  const styles = useStyles();
  const bottom = useNavigationBarHeight();
  const activeIndex = Math.max(0, TABS.findIndex(({ tab }) => tab === active));
  const position = useSharedValue(activeIndex);

  useEffect(() => {
    position.set(timing(activeIndex, SLIDE_MS));
  }, [activeIndex, position]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * SLIDE_STEP }] }));

  // expo-blur lit la cible une seule fois, au montage de la vue floue : elle n'est créée qu'une fois la
  // cible montée (sa référence remplie), sinon le flou reste coupé pour toujours.
  const [targetReady, setTargetReady] = useState(false);
  useEffect(() => {
    if (blurTarget?.current) setTargetReady(true);
    else {
      const frame = requestAnimationFrame(() => setTargetReady(!!blurTarget?.current));
      return () => cancelAnimationFrame(frame);
    }
  }, [blurTarget]);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottom + spacing.md }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {blurTarget && targetReady && (
          <BlurView
            blurTarget={blurTarget}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={BLUR_INTENSITY}
            blurReductionFactor={BLUR_REDUCTION}
            tint="default"
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.tint} />
        <Reanimated.View style={[styles.indicator, slide]} />
        {TABS.map(({ tab, label }) => (
          <TabButton key={tab} tab={tab} label={label} active={tab === active} onPress={() => onChange(tab)} />
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    gap: SLOT_GAP,
    padding: BAR_PADDING,
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: fixed.tabBarEdge,
  },
  // Voile violacé léger par-dessus le flou, comme la planche (rgba(28, 22, 40, .38)).
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: fixed.tabBarTint,
  },
  indicator: {
    position: 'absolute',
    top: BAR_PADDING,
    left: BAR_PADDING,
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    borderRadius: SLOT_HEIGHT / 2,
    backgroundColor: colors.elevatedActive,
  },
  slot: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
