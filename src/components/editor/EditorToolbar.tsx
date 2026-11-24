import { ComponentType, useEffect } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions } from 'react-native';
import Reanimated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { t } from '../../i18n';
import { DURATION, timing } from '../../motion';
import { createMediaStyles, fixed } from '../../theme';
import { usePressFeedback } from '../ui';

// Hauteur de la rangée : le rond de 48 points, l'écart et le nom dessous.
export const TOOLBAR_HEIGHT = 72;
const DISC = 48;
const ICON_SIZE = 20;
// Jusqu'à six outils tiennent dans la largeur ; au-delà, la rangée défile.
const VISIBLE_TOOLS = 6;
// Quand elle défile : cinq outils et demi, le demi dit qu'il y en a d'autres.
const SCROLL_VISIBLE = 5.5;
const ROW_PADDING = 6;
// La barre s'efface (fondu et glissement vers le bas) quand un outil plein écran l'a remplacée.
const HIDE_SHIFT = 14;

export type ToolIconProps = { size?: number; color?: string; strokeWidth?: number };

export type EditorTool = {
  id: string;
  icon: ComponentType<ToolIconProps>;
  label: string;
  // Écrit dans le rond à la place de l'icône (la vitesse : « 1× »).
  text?: string;
  // Un réglage en place (son coupé, vidéo découpée, filtre choisi…) : l'outil reste allumé en blanc.
  on?: boolean;
  onPress: () => void;
};

// L'icône de la catégorie Ambiance : trois cercles qui se chevauchent, au trait comme les autres outils.
export function AmbianceIcon({ size = 24, color, strokeWidth = 1.8 }: ToolIconProps) {
  const line = { fill: 'none', stroke: color, strokeWidth };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={5} {...line} />
      <Circle cx={8.5} cy={15} r={5} {...line} />
      <Circle cx={15.5} cy={15} r={5} {...line} />
    </Svg>
  );
}

function ToolButton({ tool, selected, width }: { tool: EditorTool; selected: boolean; width: number }) {
  const styles = useStyles();
  const feedback = usePressFeedback();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.set(timing(selected ? 1 : 0, DURATION.small));
  }, [selected, progress]);

  // Au repos : un rond sombre et l'icône lilas ; réglage en place : l'icône passe en blanc ; outil
  // ouvert : le rond se remplit du lilas clair des boutons à grain.
  const rest = tool.on ? fixed.white : fixed.lilac;
  const lit = fixed.onGrainButton;
  const disc = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.get(), [0, 1], [fixed.card, fixed.grainButton]) }));
  const restIcon = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const litIcon = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const labelColor = tool.on ? fixed.white : fixed.mutedLight;
  const label = useAnimatedStyle(() => ({ color: interpolateColor(progress.get(), [0, 1], [labelColor, fixed.white]) }));
  const Icon = tool.icon;
  const face = (color: string) => (tool.text ? <Text style={[styles.text, { color }]}>{tool.text}</Text> : <Icon size={ICON_SIZE} color={color} strokeWidth={1.8} />);

  return (
    <Pressable
      onPress={tool.onPress}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={tool.text ? `${tool.label} ${tool.text}` : tool.label}
      accessibilityState={{ selected, checked: tool.on }}
      hitSlop={4}
      style={{ width }}
    >
      <Reanimated.View style={[styles.tool, feedback.style]}>
        <Reanimated.View style={[styles.disc, disc]}>
          {/* Deux faces superposées, en fondu croisé : la couleur change sur le fil natif. */}
          <Reanimated.View style={[styles.face, restIcon]}>{face(rest)}</Reanimated.View>
          <Reanimated.View style={[styles.face, litIcon]}>{face(lit)}</Reanimated.View>
        </Reanimated.View>
        <Reanimated.Text numberOfLines={1} style={[styles.label, label]}>
          {tool.label}
        </Reanimated.Text>
      </Reanimated.View>
    </Pressable>
  );
}

// La rangée d'outils, sous le média : un rond et son nom pour chaque outil ; l'outil ouvert se remplit
// de lilas. Six outils tiennent dans la largeur ; au-delà (vidéo), la rangée défile.
export function EditorToolbar({ tools, selected, bottom, hidden }: { tools: EditorTool[]; selected: string | null; bottom: number; hidden: boolean }) {
  const styles = useStyles();
  const { width: screenWidth } = useWindowDimensions();
  const visible = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    visible.set(timing(hidden ? 0 : 1, DURATION.small));
  }, [hidden, visible]);
  const shown = useAnimatedStyle(() => ({ opacity: visible.get(), transform: [{ translateY: HIDE_SHIFT * (1 - visible.get()) }] }));
  const scrolls = tools.length > VISIBLE_TOOLS;
  // Qui défile laisse voir la moitié de l'outil suivant : on comprend qu'il y en a d'autres.
  const itemWidth = (screenWidth - ROW_PADDING * 2) / (scrolls ? SCROLL_VISIBLE : Math.max(tools.length, 1));

  return (
    <Reanimated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.bar, { bottom }, shown]} accessibilityLabel={t('editeur.outils')}>
      <ScrollView horizontal scrollEnabled={scrolls} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tools.map((tool) => (
          <ToolButton key={tool.id} tool={tool} selected={selected === tool.id} width={itemWidth} />
        ))}
      </ScrollView>
    </Reanimated.View>
  );
}

const useStyles = createMediaStyles(() => ({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TOOLBAR_HEIGHT,
  },
  row: {
    paddingHorizontal: ROW_PADDING,
  },
  tool: {
    alignItems: 'center',
    gap: 7,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
  },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
}));
