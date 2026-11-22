import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ArrowLeft } from 'lucide-react-native';

import { chat } from '../chat/manager';
import { getContactProfile } from '../chat/database';
import { useThoughtStats } from '../couple/thoughts';
import { haptics } from '../haptics';
import { Lily } from '../components/Lily';
import { IconButton, useInsets } from '../components/ui';
import { t } from '../i18n';
import { DURATION, timing } from '../motion';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';

// Planche « Pense à toi et pouce contre pouce » : un appui sur le lys envoie une pensée (une vibration
// douce chez l'autre) ; en bas, les deux pouces posés en même temps font vibrer les deux téléphones.
type Props = { contact: Contact; onBack: () => void };

const BUTTON = 184;
const RING_COUNT = 3;
const RING_MS = 1400;
const RING_STAGGER = 180;
// Le lys bat une fois, doucement, sans dépasser sa taille de repos au retour.
const BEAT = [1.12, 1, 1.06, 1];
const THUMB_REFRESH_MS = 1200;
const BUZZ_MS = 700;
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

function Ring({ wave, index }: { wave: number; index: number }) {
  const styles = useStyles();
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!wave) return;
    progress.set(0);
    progress.set(withDelay(index * RING_STAGGER, withTiming(1, { duration: RING_MS, easing: EASE })));
  }, [wave, index, progress]);
  const style = useAnimatedStyle(() => ({ opacity: 0.8 * (1 - progress.get()), transform: [{ scale: 0.95 + 0.95 * progress.get() }] }));
  return <Reanimated.View pointerEvents="none" style={[styles.ring, style]} />;
}

// Un pouce : le cercle se remplit quand il est posé.
function Thumb({ label, down }: { label: string; down: boolean }) {
  const styles = useStyles();
  const fill = useSharedValue(down ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(down ? 1 : 0, { duration: 700, easing: EASE }));
  }, [down, fill]);
  const circumference = 2 * Math.PI * 35;
  const props = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - fill.get()) }));
  return (
    <View style={styles.thumb}>
      <Svg width={76} height={76} viewBox="0 0 76 76" style={[StyleSheet.absoluteFill, styles.thumbRing]}>
        <Circle cx={38} cy={38} r={35} fill="none" stroke={fixed.thumbTrack} strokeWidth={2.5} />
        <AnimatedCircle cx={38} cy={38} r={35} fill="none" stroke={fixed.lilac} strokeWidth={2.5} strokeDasharray={circumference} strokeLinecap="round" animatedProps={props} />
      </Svg>
      <View style={styles.thumbFace}>
        <Text style={styles.thumbLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function PenseScreen({ contact, onBack }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const { top } = useInsets();
  useSyncExternalStore(chat.subscribe, chat.getVersion);
  const name = getContactProfile(contact.publicKey).name ?? contact.name;
  const stats = useThoughtStats();
  const [wave, setWave] = useState(0);
  const [sent, setSent] = useState(false);
  const open = useSharedValue(1);
  const beat = useSharedValue(1);
  const count = stats.mineToday + stats.theirsToday;

  const send = () => {
    haptics.success();
    chat.sendThought(contact.publicKey);
    setWave((value) => value + 1);
    setSent(true);
    beat.set(withSequence(...BEAT.map((value) => withTiming(value, { duration: 220, easing: EASE }))));
  };
  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.get() }] }));

  // Pouce contre pouce : le mien est envoyé tant qu'il est posé (rafraîchi), le sien arrive en direct.
  const [mine, setMine] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const theirs = chat.isThumbDown(contact.publicKey);
  const together = mine && theirs;
  const refresh = useRef<ReturnType<typeof setInterval> | null>(null);
  const press = (down: boolean) => {
    setMine(down);
    if (refresh.current) clearInterval(refresh.current);
    refresh.current = null;
    const reached = chat.sendThumb(contact.publicKey, down);
    setUnreachable(down && !reached);
    if (down) {
      haptics.select();
      refresh.current = setInterval(() => chat.sendThumb(contact.publicKey, true), THUMB_REFRESH_MS);
    }
  };
  useEffect(() => () => {
    if (refresh.current) clearInterval(refresh.current);
    chat.sendThumb(contact.publicKey, false);
  }, [contact.publicKey]);
  // Ensemble : les deux téléphones vibrent doucement, au même rythme, tant que les pouces restent posés.
  useEffect(() => {
    if (!together) return;
    haptics.success();
    const timer = setInterval(() => haptics.action(), BUZZ_MS);
    return () => clearInterval(timer);
  }, [together]);
  const link = useSharedValue(0);
  useEffect(() => {
    link.set(timing(together ? 1 : mine ? 0.5 : 0, 500));
  }, [together, mine, link]);
  const linkStyle = useAnimatedStyle(() => ({ width: `${link.get() * 100}%` }));
  const bloom = useSharedValue(0);
  useEffect(() => {
    bloom.set(timing(together ? 1 : 0, DURATION.mascot));
  }, [together, bloom]);
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloom.get(), transform: [{ scale: 0.6 + 0.4 * bloom.get() }] }));

  const thumbText = unreachable ? t('pense.pouceHorsLigne', { nom: name }) : together ? t('pense.pouceEnsemble') : mine ? t('pense.pouceAttente') : t('pense.pouceAide');
  const caption = sent ? t('pense.envoyee', { nom: name }) : stats.theirsToday > 0 ? t('pense.recues', { nom: name, n: stats.theirsToday }) : t('pense.aujourdhui');

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <View style={styles.header}>
        <IconButton onPress={onBack} label={t('commun.retour')}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
        </IconButton>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('pense.titre')}</Text>
          <Text style={styles.subtitle}>{t('pense.sousTitre', { nom: name })}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <View style={styles.stage}>
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <Ring key={index} wave={wave} index={index} />
          ))}
          <Pressable onPress={send} accessibilityRole="button" accessibilityLabel={t('pense.envoyer')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Reanimated.View style={beatStyle}>
              <Lily size={104} color={colors.text} open={open} />
            </Reanimated.View>
          </Pressable>
        </View>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('pense.pouceTitre')}</Text>
          <Text style={styles.sectionSub}>{t('pense.pouceSous')}</Text>
        </View>
        <View style={styles.thumbs}>
          <View style={styles.track}>
            <Reanimated.View style={[styles.trackFill, linkStyle]} />
          </View>
          <Thumb label={t('pense.toi')} down={mine} />
          <Thumb label={name} down={theirs} />
          <Reanimated.View pointerEvents="none" style={[styles.bloom, bloomStyle]}>
            <Lily size={28} color={fixed.onSignatureSoft} open={open} />
          </Reanimated.View>
        </View>
        <Text style={styles.thumbText}>{thumbText}</Text>
        <Pressable
          onPressIn={() => press(true)}
          onPressOut={() => press(false)}
          accessibilityRole="button"
          accessibilityLabel={t('pense.poser')}
          style={[styles.hold, mine && styles.holdOn]}
        >
          <Text style={[styles.holdLabel, mine && styles.holdLabelOn]}>{t('pense.poser')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: fixed.lilac,
  },
  center: {
    alignItems: 'center',
    paddingTop: 24,
  },
  stage: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: fixed.lilac,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  count: {
    marginTop: 18,
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: -1.6,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    marginTop: 2,
    fontSize: 14,
    color: fixed.mutedLight,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 30,
    marginHorizontal: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    gap: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  thumbs: {
    height: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  track: {
    position: 'absolute',
    left: 82,
    right: 82,
    top: 55,
    height: 2,
    borderRadius: 1,
    backgroundColor: fixed.thumbTrack,
    overflow: 'hidden',
  },
  trackFill: {
    height: 2,
    backgroundColor: fixed.lilac,
  },
  thumb: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRing: {
    transform: [{ rotate: '-90deg' }],
  },
  thumbFace: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: fixed.thumbFace,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  thumbLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: fixed.mutedLight,
  },
  bloom: {
    position: 'absolute',
    left: '50%',
    top: 32,
    marginLeft: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: {
    fontSize: 13,
    lineHeight: 19,
    color: fixed.mutedLight,
    minHeight: 20,
  },
  hold: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdOn: {
    backgroundColor: colors.signature,
  },
  holdLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onAccent,
  },
  holdLabelOn: {
    color: colors.onSignature,
  },
}));
