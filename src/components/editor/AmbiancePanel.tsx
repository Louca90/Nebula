import { ComponentRef, memo, useEffect, useRef } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Reanimated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { haptics } from '../../haptics';

import { t } from '../../i18n';
import { DURATION, enterUp, exitFade, timing } from '../../motion';
import { createMediaStyles, fixed, radius } from '../../theme';
import { getStampStyle } from './ambient';
import { RoundFiltered } from './FilterStrip';
import { Adjustments, FILTERS, FilterId } from './filters';
import { Stamp, STAMP_FONTS, StampKind } from './stamps';

// Les vignettes : la photo elle-même, filtrée, 48 × 60 aux coins arrondis. L'anneau lilas du filtre
// choisi est dessiné autour (écart + bordure), dans la place de la vignette : la bande ne le rogne pas.
const THUMB_WIDTH = 48;
const THUMB_HEIGHT = 60;
const THUMB_RADIUS = 14;
const RING_GAP = 2;
const RING_WIDTH = 2;
const FRAME = RING_GAP + RING_WIDTH;
const ITEM_WIDTH = THUMB_WIDTH + FRAME * 2;
const ITEM_GAP = 8;
const STRIP_PADDING = 16;
// Hauteur du panneau : la vignette, son anneau, l'écart et le nom.
export const AMBIANCE_PANEL_HEIGHT = THUMB_HEIGHT + FRAME * 2 + 3 + 14;
const ENTER_SHIFT = 10;
const ENTER_MS = 220;

const F = STAMP_FONTS;
// La police de chaque style de marque, pour écrire la vignette comme la marque elle-même.
const THUMB_FONTS: Record<StampKind, string[]> = {
  time: [F.light, F.serif, F.mono],
  date: [F.serif, F.light, F.hand],
  weekday: [F.serifItalic, F.sans, F.hand],
  place: [F.sans, F.serifItalic, F.hand],
  battery: [F.light, F.sans, F.mono],
  film: [F.mono, F.mono, F.mono],
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

// Le texte que chaque marque montre sur sa vignette (19:04, 24 nov., Ven., Annecy, 84 %, ’26).
function stampLabel(kind: StampKind, stamp: Stamp, style: number): string | null {
  if (kind === 'time') return stamp.time;
  if (kind === 'date') return style === 1 ? stamp.dayNumber : `${stamp.dayNumber} ${stamp.month.slice(0, 3).toLowerCase()}.`;
  if (kind === 'weekday') return style === 1 ? stamp.weekday.slice(0, 3) : `${capitalize(stamp.weekday).slice(0, 3)}.`;
  if (kind === 'place') return stamp.place ? (style === 0 ? stamp.place.toUpperCase() : stamp.place) : null;
  if (kind === 'battery') return stamp.battery ? `${stamp.battery.level} %` : null;
  return `’${stamp.film.slice(1, 3)}`;
}

// Lieu ou batterie encore inconnus (position non permise) : une petite icône à la place du texte.
function StampGlyph({ kind }: { kind: StampKind }) {
  const line = { stroke: fixed.white, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (kind === 'battery') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Rect x={2} y={7} width={18} height={10} rx={2.6} {...line} />
        <Path d="M22.2 10.5v3" {...line} />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M12 21.5s-7-6.2-7-11.5a7 7 0 0 1 14 0c0 5.3-7 11.5-7 11.5z" {...line} />
      <Circle cx={12} cy={10} r={2.6} {...line} />
    </Svg>
  );
}

type ThumbProps = {
  id: FilterId;
  label: string;
  kind: StampKind | undefined;
  stamp: Stamp;
  // Le style de la marque (change quand on retouche la vignette choisie).
  variant: number;
  poster: string | null;
  adjustments: Adjustments;
  selected: boolean;
  onPick: (id: FilterId) => void;
};

const Thumb = memo(function Thumb({ id, label, kind, stamp, variant, poster, adjustments, selected, onPick }: ThumbProps) {
  const styles = useStyles();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.set(timing(selected ? 1 : 0, DURATION.small));
  }, [selected, on]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const nameStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.get(), [0, 1], [fixed.mutedLight, fixed.white]) }));
  const text = kind ? stampLabel(kind, stamp, variant) : null;
  const font = kind ? THUMB_FONTS[kind][variant] ?? THUMB_FONTS[kind][0] : undefined;
  // Écriture à la main et serif : plus grandes, à chasse égale de lecture ; capitales espacées : plus petites.
  const size = !text ? 0 : font === F.hand ? 19 : font === F.serif || font === F.serifItalic ? 18 : text.length > 5 ? 10 : 15;

  return (
    <Pressable
      onPress={() => onPick(id)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      accessibilityHint={selected && kind ? t('editeur.changerStyle') : undefined}
      style={styles.item}
    >
      <View style={styles.frame}>
        <Reanimated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        <View style={styles.thumb}>
          <RoundFiltered id={id} radius={THUMB_RADIUS} adjustments={adjustments}>
            {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.empty]} />}
          </RoundFiltered>
          {kind && (
            <View pointerEvents="none" style={styles.stamp}>
              {/* Un voile léger : le texte clair reste lisible sur une photo claire. */}
              <View style={[StyleSheet.absoluteFill, styles.scrim]} />
              {text ? (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  style={[styles.stampText, { fontFamily: font, fontSize: size, letterSpacing: font === F.sans && variant === 0 ? 1 : 0 }, kind === 'film' && styles.stampFilm]}
                >
                  {text}
                </Text>
              ) : (
                <StampGlyph kind={kind} />
              )}
            </View>
          )}
        </View>
      </View>
      <Reanimated.Text numberOfLines={1} style={[styles.name, nameStyle]}>
        {label}
      </Reanimated.Text>
    </Pressable>
  );
});

type Props = {
  value: FilterId;
  // L'image des vignettes : la photo, ou la première image de la vidéo.
  poster: string | null;
  adjustments: Adjustments;
  stamp: Stamp;
  // Augmente quand une marque change de style : les vignettes se réécrivent.
  styleTick: number;
  bottom: number;
  onChange: (id: FilterId) => void;
  // Un appui sur la marque déjà choisie : son style suivant.
  onRestyle: (kind: StampKind) => void;
};

// La rangée Ambiance, à la place des boutons du bas : la photo reste visible en entier pendant qu'on
// choisit. Choisir ici ou glisser sur l'image revient au même : la bande suit et remet le filtre au milieu.
export function AmbiancePanel({ value, poster, adjustments, stamp, styleTick, bottom, onChange, onRestyle }: Props) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const indexOf = (id: FilterId) => Math.max(0, FILTERS.findIndex((preset) => preset.id === id));
  const offsetOf = (index: number) => Math.max(0, STRIP_PADDING + index * (ITEM_WIDTH + ITEM_GAP) + ITEM_WIDTH / 2 - width / 2);
  const first = useRef(offsetOf(indexOf(value)));

  useEffect(() => {
    scroll.current?.scrollTo({ x: offsetOf(indexOf(value)), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, width]);

  const pick = (id: FilterId) => {
    const kind = FILTERS[indexOf(id)].stamp;
    if (id === value) {
      if (kind) onRestyle(kind);
      return;
    }
    haptics.select();
    onChange(id);
  };

  return (
    <Reanimated.View entering={enterUp(ENTER_SHIFT, ENTER_MS)} exiting={exitFade(DURATION.small)} style={[styles.panel, { bottom }]} accessibilityLabel={t('editeur.ambiance')}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: first.current, y: 0 }}
        contentContainerStyle={styles.strip}
      >
        {FILTERS.map((preset) => (
          <Thumb
            key={preset.id}
            id={preset.id}
            label={t(preset.label)}
            kind={preset.stamp}
            stamp={stamp}
            variant={preset.stamp ? getStampStyle(preset.stamp) : 0}
            poster={poster}
            adjustments={adjustments}
            selected={preset.id === value}
            onPick={pick}
          />
        ))}
      </ScrollView>
    </Reanimated.View>
  );
}

const useStyles = createMediaStyles(() => ({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: AMBIANCE_PANEL_HEIGHT,
  },
  strip: {
    paddingHorizontal: STRIP_PADDING,
    gap: ITEM_GAP,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: 3,
  },
  frame: {
    padding: FRAME,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: THUMB_RADIUS + FRAME,
    borderWidth: RING_WIDTH,
    borderColor: fixed.grainButton,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: THUMB_RADIUS,
    overflow: 'hidden',
    backgroundColor: fixed.filterStripBackground,
  },
  empty: {
    backgroundColor: fixed.filterStripBackground,
  },
  stamp: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  scrim: {
    backgroundColor: fixed.black,
    opacity: 0.22,
    borderRadius: radius.sm,
  },
  stampText: {
    color: fixed.white,
    textShadowColor: fixed.stampShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    includeFontPadding: false,
  },
  stampFilm: {
    color: fixed.filmOrange,
  },
  name: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
}));
