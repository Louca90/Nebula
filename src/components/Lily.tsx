import Reanimated, { useAnimatedProps, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

// Le lys d'un seul tenant des planches Elvira (même dessin, même boîte « 4 10 92 88 »).
// `open` va de 0 (fermé : pétales repliés, étamines cachées) à 1 (ouvert), sur le fil natif.
// Sur Android, un groupe SVG se déplace par sa `matrix` native (cf. Pear.tsx) : c'est ce qu'on anime.
const PETAL_LEFT = 'M46 67 C37 66 29.5 60 25 51 C22 44.5 21 36 15.5 30.5 C13.5 28.6 10.5 28.6 8.5 30.4 C10 25.4 15 23.2 20.5 25.2 C29 28.4 34 37.5 37.5 46 C40 52.5 42.6 59.4 46 67 Z';
const PETAL_RIGHT = 'M54 67 C63 66 70.5 60 75 51 C78 44.5 79 36 84.5 30.5 C86.5 28.6 89.5 28.6 91.5 30.4 C90 25.4 85 23.2 79.5 25.2 C71 28.4 66 37.5 62.5 46 C60 52.5 57.4 59.4 54 67 Z';
const STAMENS = 'M64.11 22.37 L64.22 22.64 L64.17 22.98 L62.81 25.35 L61.50 27.80 L60.26 30.29 L59.10 32.81 L57.30 37.06 L55.68 41.34 L54.48 44.78 L53.38 48.20 L52.24 52.02 L51.18 55.77 L51.16 56.09 L51.26 56.41 L51.47 56.66 L51.71 56.80 L52.04 56.85 L52.33 56.78 L52.61 56.59 L52.79 56.32 L53.99 52.07 L55.00 48.70 L56.10 45.32 L57.27 41.92 L58.55 38.54 L59.74 35.59 L61.02 32.67 L62.39 29.80 L64.08 26.57 L65.75 23.69 L66.05 23.51 L66.98 23.44 L67.78 23.15 L68.46 22.64 L68.82 22.20 L69.07 21.72 L69.25 21.15 L69.28 20.30 L69.07 19.48 L68.65 18.77 L68.25 18.37 L67.78 18.05 L67.26 17.83 L66.70 17.72 L66.13 17.71 L65.57 17.82 L65.05 18.04 L64.57 18.35 L64.17 18.75 L63.85 19.22 L63.63 19.74 L63.52 20.30 L63.51 20.87 L63.62 21.43 L63.84 21.95 Z M33.78 23.49 L34.06 23.55 L34.29 23.73 L35.93 26.58 L37.81 30.21 L39.72 34.34 L40.78 36.85 L41.78 39.38 L43.62 44.47 L45.38 49.97 L47.21 56.32 L47.39 56.59 L47.67 56.78 L47.99 56.85 L48.32 56.79 L48.59 56.61 L48.77 56.36 L48.84 56.09 L48.82 55.77 L47.64 51.60 L46.49 47.78 L45.23 43.92 L44.01 40.49 L42.18 35.78 L40.14 31.13 L38.08 26.99 L35.81 22.93 L35.77 22.76 L35.81 22.53 L36.27 21.72 L36.48 20.90 L36.48 20.30 L36.28 19.50 L35.85 18.77 L35.64 18.54 L35.20 18.18 L34.43 17.82 L33.90 17.72 L33.33 17.71 L32.77 17.82 L32.25 18.04 L31.77 18.35 L31.37 18.75 L31.05 19.22 L30.83 19.74 L30.72 20.30 L30.71 20.87 L30.82 21.43 L31.04 21.95 L31.35 22.43 L31.75 22.83 L32.22 23.15 L32.74 23.37 L33.30 23.48 Z';
const HEART = 'M50 14 C55 24 57.5 36 57 47 C56.5 56 53.5 62 50 66 C46.5 62 43.5 56 43 47 C42.5 36 45 24 50 14 Z M42 62 C43 68 46.5 71.5 50 71.5 C53.5 71.5 57 68 58 62 C55 64.5 52.6 65.4 50 65.4 C47.4 65.4 45 64.5 42 62 Z';
const STEM = 'M46.5 69.5 C47.6 72.5 48.6 76 49 81 L49 95 L51 95 L51 81 C51.4 76 52.4 72.5 53.5 69.5 C52.3 70.4 51.2 70.8 50 70.8 C48.8 70.8 47.7 70.4 46.5 69.5 Z M50.4 87.5 C56.5 81.5 63.5 78.6 71 79.6 C66 86.4 59.4 88.8 50.4 89.6 Z';

const AnimatedG = Reanimated.createAnimatedComponent(G);
// Angle des pétales repliés, comme sur la planche (24°).
const CLOSED_ANGLE = (24 * Math.PI) / 180;

function rotateAbout(angle: number, ox: number, oy: number) {
  'worklet';
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, -s, c, ox - c * ox + s * oy, oy - s * ox - c * oy];
}

function scaleAbout(k: number, ox: number, oy: number) {
  'worklet';
  return [k, 0, 0, k, ox * (1 - k), oy * (1 - k)];
}

export function Lily({ size, color, open }: { size: number; color: string; open: SharedValue<number> }) {
  const left = useAnimatedProps(() => ({ matrix: rotateAbout(CLOSED_ANGLE * (1 - open.get()), 46, 67) }) as object);
  const right = useAnimatedProps(() => ({ matrix: rotateAbout(-CLOSED_ANGLE * (1 - open.get()), 54, 67) }) as object);
  const stamens = useAnimatedProps(() => {
    const o = open.get();
    return { matrix: scaleAbout(0.2 + 0.8 * o, 50, 44), opacity: o } as object;
  });
  return (
    <Svg width={size} height={(size * 88) / 92} viewBox="4 10 92 88">
      <AnimatedG animatedProps={left}>
        <Path d={PETAL_LEFT} fill={color} />
      </AnimatedG>
      <AnimatedG animatedProps={right}>
        <Path d={PETAL_RIGHT} fill={color} />
      </AnimatedG>
      <AnimatedG animatedProps={stamens}>
        <Path d={STAMENS} fill={color} />
      </AnimatedG>
      <Path d={HEART} fill={color} />
      <Path d={STEM} fill={color} />
    </Svg>
  );
}

// Le lys ouvert, immobile, à la place de la poire de Pear : `height` comme l'ancienne marque.
export function LilyMark({ height, color }: { height: number; color: string }) {
  const open = useSharedValue(1);
  return <Lily size={(height * 92) / 88} color={color} open={open} />;
}
