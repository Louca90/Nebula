import { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { dateLocale } from '../../i18n';
import { fixed } from '../../theme';

// Les marques des filtres d'ambiance (Heure, Date, Pellicule, Lieu, Jour, Batterie), dessinées
// en SVG : pareilles dans l'appareil photo, dans l'éditeur et dans le fichier envoyé. Polices embarquées
// (voir STAMP_FONTS). Chaque marque a 3 styles ; toucher à nouveau la vignette choisie passe au suivant.
export type StampKind = 'time' | 'date' | 'film' | 'place' | 'weekday' | 'battery';

// Combien de styles typographiques a chaque marque.
export const STAMP_VARIANTS: Record<StampKind, number> = { time: 3, date: 3, film: 3, place: 3, weekday: 3, battery: 3 };

// Ce que le téléphone sait au moment de la photo. Lu sur l'appareil, jamais envoyé : voir ambient.ts.
export type Ambient = { place: string | null; battery: { level: number; charging: boolean } | null };
export const NO_AMBIENT: Ambient = { place: null, battery: null };

export type Stamp = { time: string; weekday: string; day: string; dayNumber: string; month: string; long: string; film: string; filmTime: string; place: string | null; battery: Ambient['battery'] };

export function formatStamp(timestamp: number, ambient: Ambient = NO_AMBIENT): Stamp {
  const date = new Date(timestamp);
  const two = (value: number) => String(value).padStart(2, '0');
  const time = `${two(date.getHours())}:${two(date.getMinutes())}`;
  const film = `'${two(date.getFullYear() % 100)} ${two(date.getMonth() + 1)} ${two(date.getDate())}`;
  return {
    time,
    weekday: date.toLocaleDateString(dateLocale(), { weekday: 'long' }).toUpperCase(),
    day: date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }),
    dayNumber: String(date.getDate()),
    month: date.toLocaleDateString(dateLocale(), { month: 'long' }).toUpperCase(),
    long: date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }),
    // Comme l'impression des appareils argentiques : 'AA MM JJ.
    film,
    filmTime: `${film}  ${time}`,
    place: ambient.place,
    battery: ambient.battery,
  };
}

const SHADOW = fixed.black;
const LIGHT = fixed.white;
const FILM_ORANGE = fixed.filmOrange;
const FILM_GLOW = fixed.filmGlow;

// Les polices embarquées (assets/fonts, plugins/with-stamp-fonts.js). Chaque fichier est une famille :
// on ne demande jamais de gras ni d'italique au système, qui les imiterait mal.
export const STAMP_FONTS = {
  serif: 'NebulaSerif',
  serifItalic: 'NebulaSerifItalic',
  light: 'NebulaSansLight',
  sans: 'NebulaSans',
  mono: 'NebulaMono',
  hand: 'NebulaHand',
} as const;
const F = STAMP_FONTS;

type Anchor = 'start' | 'middle' | 'end';

// « VENDREDI » → « Vendredi ».
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

// Un texte clair avec une ombre douce : deux couches décalées, assez légères pour ne pas faire contour.
function Soft({ x, y, size, family, spacing = 0, anchor = 'middle', children }: { x: number; y: number; size: number; family: string; spacing?: number; anchor?: Anchor; children: string }) {
  const shared = { fontSize: size, fontFamily: family, letterSpacing: spacing, textAnchor: anchor };
  return (
    <>
      <SvgText {...shared} x={x} y={y + Math.max(1, size * 0.04)} fill={SHADOW} opacity={0.18}>{children}</SvgText>
      <SvgText {...shared} x={x} y={y + Math.max(0.5, size * 0.015)} fill={SHADOW} opacity={0.14}>{children}</SvgText>
      <SvgText {...shared} x={x} y={y} fill={LIGHT}>{children}</SvgText>
    </>
  );
}

// Une étiquette posée en bas à gauche : une pilule sombre translucide et le texte à chasse fixe.
function Badge({ x, y, size, children }: { x: number; y: number; size: number; children: string }) {
  const height = size * 2;
  const width = children.length * size * 0.6 + size * 1.7;
  return (
    <G>
      <Rect x={x} y={y - height} width={width} height={height} rx={height / 2} fill={SHADOW} opacity={0.38} />
      <SvgText x={x + width / 2} y={y - height / 2 + size * 0.36} fontSize={size} fontFamily={F.mono} letterSpacing={size * 0.04} textAnchor="middle" fill={LIGHT}>
        {children}
      </SvgText>
    </G>
  );
}

// Une épingle, au-dessus du nom du lieu.
function Pin({ cx, y, size }: { cx: number; y: number; size: number }) {
  const scale = size / 24;
  const d = 'M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z';
  return (
    <G transform={`translate(${cx - 12 * scale} ${y}) scale(${scale})`}>
      <Path d={d} fill="none" stroke={SHADOW} strokeOpacity={0.2} strokeWidth={3.4} />
      <Path d={d} fill="none" stroke={LIGHT} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={2.4} fill={LIGHT} />
    </G>
  );
}

// Une pile avec son niveau, pour le filtre Batterie.
function BatteryIcon({ x, y, width, level, charging }: { x: number; y: number; width: number; level: number; charging: boolean }) {
  const height = width * 0.46;
  const stroke = Math.max(2, width * 0.04);
  const inner = Math.max(0, (width - stroke * 3) * (level / 100));
  const color = level <= 20 && !charging ? fixed.batteryLow : LIGHT;
  return (
    <G>
      <Rect x={x} y={y} width={width} height={height} rx={height * 0.24} fill="none" stroke={SHADOW} strokeOpacity={0.2} strokeWidth={stroke + 1.5} />
      <Rect x={x} y={y} width={width} height={height} rx={height * 0.24} fill="none" stroke={LIGHT} strokeWidth={stroke} />
      <Rect x={x + width + stroke * 0.8} y={y + height * 0.3} width={stroke * 1.4} height={height * 0.4} rx={stroke * 0.5} fill={LIGHT} />
      <Rect x={x + stroke * 1.5} y={y + stroke * 1.5} width={inner} height={height - stroke * 3} rx={height * 0.14} fill={color} />
      {charging && <Path d={`M${x + width * 0.54} ${y + height * 0.14} L${x + width * 0.4} ${y + height * 0.54} H${x + width * 0.52} L${x + width * 0.46} ${y + height * 0.86} L${x + width * 0.62} ${y + height * 0.44} H${x + width * 0.5} Z`} fill={SHADOW} opacity={0.75} />}
    </G>
  );
}

// Trois styles par marque, sur trois voix : le serif éditorial (Instrument Serif), le sans moderne
// (Space Grotesk, fin ou appuyé), l'écriture à la main (Caveat) ; la chasse fixe (DM Mono) pour les
// étiquettes et la pellicule.
export function StampMarks({ kind, stamp, width, height, variant = 0 }: { kind: StampKind | undefined; stamp: Stamp; width: number; height: number; variant?: number }) {
  if (!kind) return null;
  const unit = Math.min(width, height * 0.6);
  const style = Math.max(0, Math.min(STAMP_VARIANTS[kind] - 1, variant));
  const cx = width / 2;
  const left = unit * 0.09;
  const bottom = height - unit * 0.1;
  // Une taille qui tient dans la largeur : `perChar`, la largeur moyenne d'un signe (en part de la taille).
  const fit = (text: string, base: number, perChar: number, share = 0.86) => Math.min(base, (width * share) / Math.max(1, text.length * perChar));
  // L'écriture à la main penche un peu, comme un mot ajouté au stylo.
  const tilt = (y: number) => `rotate(-4 ${cx} ${y})`;

  if (kind === 'time') {
    // 0 : écran de verrouillage. Le jour en petit, l'heure très grande au trait fin.
    if (style === 0) {
      const y = height * 0.2;
      return (
        <G>
          <Soft x={cx} y={y} size={unit * 0.05} family={F.sans} spacing={unit * 0.004}>{`${capitalize(stamp.weekday)} ${stamp.day}`}</Soft>
          <Soft x={cx} y={y + unit * 0.3} size={unit * 0.3} family={F.light} spacing={-unit * 0.008}>{stamp.time}</Soft>
        </G>
      );
    }
    // 1 : éditorial. L'heure en serif, le jour en italique dessous.
    if (style === 1) {
      const y = height * 0.42;
      return (
        <G>
          <Soft x={cx} y={y} size={unit * 0.28} family={F.serif}>{stamp.time}</Soft>
          <Soft x={cx} y={y + unit * 0.1} size={unit * 0.075} family={F.serifItalic}>{capitalize(stamp.weekday)}</Soft>
        </G>
      );
    }
    // 2 : une étiquette discrète, en bas à gauche.
    return <Badge x={left} y={bottom} size={unit * 0.06}>{stamp.time}</Badge>;
  }

  if (kind === 'date') {
    // 0 : le jour en italique, la date en grand serif.
    if (style === 0) {
      const y = height * 0.38;
      return (
        <G>
          <Soft x={cx} y={y} size={unit * 0.08} family={F.serifItalic}>{capitalize(stamp.weekday)}</Soft>
          <Soft x={cx} y={y + unit * 0.17} size={fit(stamp.day, unit * 0.17, 0.44)} family={F.serif}>{stamp.day}</Soft>
        </G>
      );
    }
    // 1 : le quantième très grand au trait fin, le mois en capitales espacées, calés à gauche.
    if (style === 1) {
      const y = height * 0.42;
      return (
        <G>
          <Soft x={left - unit * 0.015} y={y} size={unit * 0.34} family={F.light} anchor="start">{stamp.dayNumber}</Soft>
          <Soft x={left} y={y + unit * 0.08} size={unit * 0.045} family={F.sans} spacing={unit * 0.016} anchor="start">{stamp.month}</Soft>
        </G>
      );
    }
    // 2 : écrit à la main en bas, comme au dos d'une photo.
    const y = bottom - unit * 0.04;
    return (
      <G transform={tilt(y)}>
        <Soft x={cx} y={y} size={fit(stamp.long, unit * 0.12, 0.4)} family={F.hand}>{stamp.long}</Soft>
      </G>
    );
  }

  if (kind === 'film') {
    // Pellicule : la date orange imprimée, avec un léger halo.
    const size = unit * (style === 2 ? 0.055 : 0.065);
    const anchor: Anchor = style === 1 ? 'start' : 'end';
    const x = style === 1 ? left : width - unit * 0.07;
    const y = style === 2 ? bottom - size * 1.5 : height - unit * 0.1;
    const shared = { fontSize: size, fontFamily: F.mono, letterSpacing: size * 0.1, textAnchor: anchor };
    // 0 : en bas à droite ; 1 : en bas à gauche ; 2 : la date et l'heure sur deux lignes.
    const lines = style === 2 ? [stamp.film, stamp.time] : [stamp.film];
    return (
      <G>
        {lines.map((line, index) => (
          <G key={line}>
            <SvgText {...shared} x={x + 1} y={y + 1 + index * size * 1.35} fill={FILM_GLOW} opacity={0.55}>{line}</SvgText>
            <SvgText {...shared} x={x} y={y + index * size * 1.35} fill={FILM_ORANGE}>{line}</SvgText>
          </G>
        ))}
      </G>
    );
  }

  if (kind === 'place') {
    // Sans position connue (autorisation refusée, ville inconnue) : rien n'est dessiné.
    if (!stamp.place) return null;
    const place = stamp.place;
    // 0 : l'épingle, puis la ville en capitales espacées.
    if (style === 0) {
      const size = fit(place, unit * 0.095, 0.78);
      const y = height * 0.4;
      return (
        <G>
          <Pin cx={cx} y={y - size * 2.3} size={size * 1.3} />
          <Soft x={cx} y={y} size={size} family={F.sans} spacing={size * 0.14}>{place.toUpperCase()}</Soft>
        </G>
      );
    }
    // 1 : la date en petit, la ville en grand serif italique, en bas à gauche.
    if (style === 1) {
      const size = fit(place, unit * 0.17, 0.42);
      return (
        <G>
          <Soft x={left} y={bottom - size * 0.95} size={unit * 0.04} family={F.sans} spacing={unit * 0.014} anchor="start">{stamp.day.toUpperCase()}</Soft>
          <Soft x={left} y={bottom} size={size} family={F.serifItalic} anchor="start">{place}</Soft>
        </G>
      );
    }
    // 2 : écrite à la main.
    const y = bottom - unit * 0.04;
    return (
      <G transform={tilt(y)}>
        <Soft x={cx} y={y} size={fit(place, unit * 0.18, 0.4)} family={F.hand}>{place}</Soft>
      </G>
    );
  }

  if (kind === 'weekday') {
    const day = capitalize(stamp.weekday);
    // 0 : le jour en grand serif italique.
    if (style === 0) return <Soft x={cx} y={height * 0.42} size={fit(day, unit * 0.22, 0.42)} family={F.serifItalic}>{day}</Soft>;
    // 1 : capitales espacées, la date au trait fin dessous.
    if (style === 1) {
      const size = fit(stamp.weekday, unit * 0.085, 0.8);
      const y = height * 0.4;
      return (
        <G>
          <Soft x={cx} y={y} size={size} family={F.sans} spacing={size * 0.18}>{stamp.weekday}</Soft>
          <Soft x={cx} y={y + unit * 0.08} size={unit * 0.05} family={F.light}>{stamp.day}</Soft>
        </G>
      );
    }
    // 2 : écrit à la main.
    const y = height * 0.42;
    return (
      <G transform={tilt(y)}>
        <Soft x={cx} y={y} size={fit(day, unit * 0.22, 0.4)} family={F.hand}>{day}</Soft>
      </G>
    );
  }

  // Batterie
  const battery = stamp.battery;
  if (!battery) return null;
  const percent = `${battery.level} %`;
  if (style === 0) return <Soft x={cx} y={height * 0.4} size={unit * 0.26} family={F.light}>{percent}</Soft>;
  if (style === 1) {
    const iconWidth = unit * 0.3;
    return (
      <G>
        <BatteryIcon x={cx - iconWidth / 2 - unit * 0.01} y={height * 0.3} width={iconWidth} level={battery.level} charging={battery.charging} />
        <Soft x={cx} y={height * 0.3 + iconWidth * 0.46 + unit * 0.1} size={unit * 0.07} family={F.sans} spacing={unit * 0.006}>{percent}</Soft>
      </G>
    );
  }
  return <Badge x={left} y={bottom} size={unit * 0.06}>{percent}</Badge>;
}
