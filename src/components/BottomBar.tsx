import { useEffect, useState, type RefObject } from 'react';
import { findNodeHandle, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { haptics } from '../haptics';
import { createStyles, fixed, spacing, useColors } from '../theme';
import { useNavigationBarHeight } from './ui';
import { t } from '../i18n';
import { DURATION, timing } from '../motion';
import { Lily } from './Lily';
import { NebulaBlurView } from '../../modules/pear-native/blur';

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
// Le verre de la planche : backdrop-filter: blur(60px) saturate(180%), voile rgba(28, 22, 40, .38), filet
// intérieur de 1 px blanc à 8 %, ombre 0 10 30 noire à 35 %. Flou natif en direct (NebulaBlurView) :
// expo-blur liait la force du flou à un voile gris et restait parfois coupé (transparent puis gris).
const BLUR_SIGMA = 60;
const BLUR_SATURATION = 1.8;
const EDGE_WIDTH = 1;
const BAR_RADIUS = 40;
// La cible du flou peut être montée un peu après la barre : on la cherche quelques images, pas plus.
const FIND_TARGET_FRAMES = 120;

const AnimatedG = Reanimated.createAnimatedComponent(G);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedPath = Reanimated.createAnimatedComponent(Path);

type BlurTarget = RefObject<unknown>;

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

  // Le numéro natif de la cible (les pages). La vue floue le résout elle-même à chaque image : même s'il
  // arrive après elle, le verre apparaît dès qu'il est connu, sans jamais rester bloqué.
  const [targetId, setTargetId] = useState<number | null>(null);
  useEffect(() => {
    if (!blurTarget) return;
    let frame = 0;
    let tries = 0;
    const find = () => {
      const id = blurTarget.current ? findNodeHandle(blurTarget.current as never) : null;
      if (id) setTargetId(id);
      else if (tries++ < FIND_TARGET_FRAMES) frame = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(frame);
  }, [blurTarget]);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottom + spacing.md }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {/* Le verre : flou et saturation en direct, voile, puis le filet par-dessus (il s'adapte à ce qui passe
            dessous). Sans cible (la copie de la barre sous une page qui arrive), une couleur pleine. */}
        <NebulaBlurView
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          targetId={blurTarget ? targetId : null}
          blurRadius={BLUR_SIGMA}
          saturation={BLUR_SATURATION}
          tint={fixed.tabBarTint}
          fallbackColor={fixed.tabBarFallback}
          edgeColor={fixed.tabBarEdge}
          edgeWidth={EDGE_WIDTH}
          cornerRadius={BAR_RADIUS}
        />
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
  // L'ombre de la planche porte sur la pilule ; le verre lui-même est découpé par la vue floue.
  bar: {
    flexDirection: 'row',
    gap: SLOT_GAP,
    padding: BAR_PADDING,
    borderRadius: BAR_RADIUS,
    boxShadow: `0px 10px 30px ${fixed.tabBarShadow}`,
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
