import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useColors } from '../../../theme';

// Nébula : derrière la barre de saisie, un fond noir plein jusqu'en bas de l'écran (donc aussi derrière
// le clavier ouvert), surmonté d'un grand dégradé vers le haut. Clavier ouvert, le fond à grain ne se
// voyait plus qu'en bande autour de la barre ; les messages restent au-dessus.
const FADE = 180;

export function ComposerShade({ top }: { top: number }) {
  const colors = useColors();
  return (
    <View pointerEvents="none" style={[styles.shade, { top: Math.max(0, top - FADE) }]}>
      <Svg width="100%" height={FADE}>
        <Defs>
          <LinearGradient id="composerShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="0.55" stopColor={colors.background} stopOpacity={0.7} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={FADE} fill="url(#composerShade)" />
      </Svg>
      <View style={[styles.solid, { backgroundColor: colors.background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  solid: { flex: 1 },
});
