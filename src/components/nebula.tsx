import { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { haptics } from '../haptics';
import { DURATION, timing } from '../motion';
import { createStyles, fixed } from '../theme';

// Les fonds violets à grain des planches, déjà calculés en images (scripts/make-backgrounds.mjs) :
// rien n'est dessiné en direct, aucun coût de batterie.
const BACKDROPS = {
  horizon: require('../../assets/backgrounds/horizon.webp'),
  spot: require('../../assets/backgrounds/spot.webp'),
  amethyste: require('../../assets/backgrounds/amethyste.webp'),
  soie: require('../../assets/backgrounds/soie.webp'),
  aube: require('../../assets/backgrounds/aube.webp'),
};
export type BackdropKind = keyof typeof BACKDROPS;
const GRAIN = require('../../assets/backgrounds/grain.webp');

// Une image locale garde sinon sa taille d'origine en points (1080 × 2337 pour un fond, 256 pour le grain),
// qui l'emporte sur absoluteFill : le fond était 2,6 fois trop grand (zoomé) et le grain s'arrêtait en carré.
const fill = [StyleSheet.absoluteFill, { width: '100%', height: '100%' }] as const;

export function Backdrop({ kind }: { kind: BackdropKind }) {
  return <Image source={BACKDROPS[kind]} style={fill} resizeMode="cover" />;
}

// Le grain des fonds, en incrustation sur un bouton (Grain : 0,45 ; Fumé : 0,25).
function GrainOverlay({ opacity }: { opacity: number }) {
  return <Image source={GRAIN} resizeMode="repeat" style={[fill, { opacity, mixBlendMode: 'overlay' }]} />;
}

type GrainButtonProps = {
  label: string;
  onPress: () => void;
  // Grain : l'action principale (lilas uni + grain). Fumé : l'action d'à côté (sombre, translucide).
  variant?: 'grain' | 'smoke';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

// Appui : le bouton rétrécit à 0,97, sans rebond (planche « Mouvement »).
export function GrainButton({ label, onPress, variant = 'grain', icon, style, disabled }: GrainButtonProps) {
  const styles = useStyles();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const grain = variant === 'grain';
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => scale.set(timing(0.97, DURATION.press))}
      onPressOut={() => scale.set(timing(1, DURATION.press))}
      onPress={() => {
        haptics.action();
        onPress();
      }}
      style={style}
    >
      <Reanimated.View style={[styles.button, grain ? styles.grain : styles.smoke, disabled && styles.disabled, pressStyle]}>
        <GrainOverlay opacity={grain ? 0.45 : 0.25} />
        {icon}
        <Text style={[styles.label, grain ? styles.grainLabel : styles.smokeLabel]}>{label}</Text>
      </Reanimated.View>
    </Pressable>
  );
}

// Une surface des planches (carte, ligne) posée sur un fond à grain.
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = createStyles((colors) => ({
  button: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  grain: {
    backgroundColor: fixed.grainButton,
    boxShadow: `inset 0px 1px 0px ${fixed.grainHighlight}, 0px 10px 30px ${fixed.grainShadow}`,
  },
  smoke: {
    backgroundColor: fixed.smokeButton,
    borderWidth: 1,
    borderColor: fixed.smokeEdge,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  grainLabel: {
    color: fixed.onGrainButton,
  },
  smokeLabel: {
    color: colors.text,
  },
  card: {
    borderRadius: 18,
    backgroundColor: fixed.card,
  },
}));
