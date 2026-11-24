import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, PermissionsAndroid, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { chat } from '../chat/manager';
import { acceptedPairingFrom, describeMessage, getContactProfile, getLastMessage, getLocationMessages, getMediaMessages, getPendingRequests, getUnreadCounts, Message, PairingRequest } from '../chat/database';
import { lastKnownLocation } from '../../modules/pear-native';
import { distanceKm, formatDistance, isSharing, parseLocationText } from '../chat/location';
import { cycleOwner, cycleSummary, useCycle } from '../couple/cycle';
import { MOOD_FRESH_MS, MoodId, MOODS, useMoods } from '../couple/mood';
import { MoodIcon } from '../components/MoodIcon';
import { Droplet, Plus } from 'lucide-react-native';
import { Sheet } from '../components/Sheet';
import { haptics } from '../haptics';
import { log } from '../log';
import type { PairMode } from '../components/PairSheet';
import { useMediaPreview } from '../chat/media';
import { useBottomBarSpace } from '../components/BottomBar';
import { Lily } from '../components/Lily';
import { Backdrop, Card, GrainButton } from '../components/nebula';
import { OnlineRing, useRingArrival } from '../components/OnlineRing';
import { Avatar, useInsets } from '../components/ui';
import { t } from '../i18n';
import { enterUp } from '../motion';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';
import { relativeTime } from './home/listFormat';
import { daysUntil, useNextDate } from '../couple/dates';
import { useThoughtsToday } from '../couple/thoughts';

// Onglet Nous : la planche « Elvira · Accueil ». Sa photo, son état, la conversation, Pense à toi,
// le compte à rebours et les médias partagés, sur le fond Horizon.
type Props = {
  contacts: Contact[];
  onOpenChat: (contact: Contact) => void;
  onProfile: (contact: Contact) => void;
  onMedia: (contact: Contact) => void;
  onPense: (contact: Contact) => void;
  onDates: () => void;
  onCycle: () => void;
  onMap: (contact: Contact) => void;
  onPair: (mode: PairMode) => void;
  onRequests: () => void;
};

const AVATAR = 72;
const MEDIA_COUNT = 4;

// L'heure du dernier message aujourd'hui (« 19:02 »), « hier », puis « il y a 3 j » ou la date.
function when(at: number, now: number) {
  const date = new Date(at);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const yesterday = new Date(now - 24 * 3600 * 1000);
  if (date.toDateString() === yesterday.toDateString()) return t('nous.hier');
  return relativeTime(at, now);
}

// Le lys plein, en petit : l'icône des planches (logo, carte Pense à toi).
function StaticLily({ size, color }: { size: number; color: string }) {
  const open = useSharedValue(1);
  return <Lily size={size} color={color} open={open} />;
}

function MediaTile({ message, onPress, index }: { message: Message; onPress: () => void; index: number }) {
  const styles = useStyles();
  const poster = useMediaPreview(message);
  return (
    <Reanimated.View entering={enterUp(8, 260, index * 30)} style={styles.tileWrap}>
      <Pressable onPress={onPress} style={styles.tile}>
        {poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      </Pressable>
    </Reanimated.View>
  );
}

// Pas encore liés : comment faire, en trois étapes, et les deux boutons de la feuille QR (Scanner son
// code en Grain, Montrer mon code en Fumé). Une demande reçue s'affiche en haut, prête à être acceptée.
function PairInvite({ pending, request, onPair, onRequests }: { pending: boolean; request: PairingRequest | null; onPair: (mode: PairMode) => void; onRequests: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const steps = [t('nous.etape1'), t('nous.etape2'), t('nous.etape3')];
  return (
    <View style={styles.invite}>
      {request && (
        <Reanimated.View entering={enterUp(10, 300)} style={styles.requestWrap}>
          <Card style={styles.request}>
            <Text style={styles.requestTitle}>{t('nous.demandeRecue', { nom: request.name || t('app.contact') })}</Text>
            <Text style={styles.requestText}>{t('nous.demandeAide')}</Text>
            <GrainButton label={t('nous.voirDemande')} onPress={onRequests} />
          </Card>
        </Reanimated.View>
      )}
      <StaticLily size={64} color={colors.text} />
      <Text style={styles.inviteTitle}>{pending ? t('nous.enAttente') : t('nous.lierTitre')}</Text>
      {pending ? (
        <Text style={styles.inviteText}>{t('nous.enAttenteAide')}</Text>
      ) : (
        <>
          <View style={styles.steps}>
            {steps.map((step, index) => (
              <Reanimated.View key={step} entering={enterUp(8, 260, 120 + index * 60)} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </Reanimated.View>
            ))}
          </View>
          <View style={styles.inviteButtons}>
            <GrainButton label={t('nous.scanner')} onPress={() => onPair('scan')} />
            <GrainButton label={t('nous.montrer')} variant="smoke" onPress={() => onPair('code')} />
          </View>
        </>
      )}
    </View>
  );
}

export function NousScreen({ contacts, onOpenChat, onProfile, onMedia, onPense, onDates, onCycle, onMap, onPair, onRequests }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const { top } = useInsets();
  const barSpace = useBottomBarSpace();
  useSyncExternalStore(chat.subscribe, chat.getVersion);
  // Rien que vous deux : la première personne liée (une demande en attente sinon).
  const partner = contacts.find((contact) => !contact.pending) ?? contacts[0] ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const nextDate = useNextDate();
  const thoughts = useThoughtsToday();
  const arriving = useRingArrival();
  const cycle = useCycle();
  const moods = useMoods();
  const [moodOpen, setMoodOpen] = useState(false);
  // Ma position, pour la carte Distance : seulement si la localisation est autorisée.
  const [located, setLocated] = useState(false);
  useEffect(() => {
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
      .then(setLocated)
      .catch((e) => log.warn('distance', e));
  }, [now]);

  const header = (
    <View style={[styles.header, { paddingTop: top + 8 }]}>
      <StaticLily size={30} color={colors.text} />
      <Text style={styles.appName}>Nébula</Text>
    </View>
  );

  if (!partner || partner.pending) {
    return (
      <View style={styles.screen}>
        <Backdrop kind="horizon" />
        {header}
        <PairInvite pending={!!partner?.pending} request={getPendingRequests()[0] ?? null} onPair={onPair} onRequests={onRequests} />
      </View>
    );
  }

  const key = partner.publicKey;
  const profile = getContactProfile(key);
  const name = profile.name ?? partner.name;
  const online = chat.isContactOnline(key);
  const typing = chat.isTyping(key);
  const route = chat.getLink(key).route;
  const last = getLastMessage(key);
  const unread = getUnreadCounts().get(key) ?? 0;
  const media = getMediaMessages(key).slice(0, MEDIA_COUNT);
  const status = typing ? t('nous.ecrit') : online ? (route === 'relay' ? t('nous.enLigneRelais') : t('nous.enLigneDirect')) : t('nous.horsLigne');
  const days = nextDate ? daysUntil(nextDate, now) : null;
  const away = distanceBetween(key, located, now);
  const cycleInfo = cycle.periods.length > 0 ? cycleSummary(cycle, now) : null;
  const cycleText = !cycleInfo
    ? null
    : cycleInfo.current
      ? t('cycle.carteJour', { n: cycleInfo.currentDay ?? 1 })
      : cycleInfo.late
        ? t('cycle.carteRetard')
        : cycleInfo.daysToNext === 0
          ? t('cycle.carteAujourdhui')
          : t('cycle.carteDans', { n: cycleInfo.daysToNext ?? 0 });
  const theirMood = moods.theirs && now - moods.theirs.at < MOOD_FRESH_MS ? moods.theirs : null;
  const myMood = moods.mine && now - moods.mine.at < MOOD_FRESH_MS ? moods.mine : null;
  const pickMood = (mood: MoodId) => {
    haptics.success();
    chat.sendMood(key, mood);
  };

  return (
    <View style={styles.screen}>
      <Backdrop kind="horizon" />
      <ScrollView contentContainerStyle={{ paddingBottom: barSpace + 16 }} showsVerticalScrollIndicator={false}>
        {header}

        <Reanimated.View entering={enterUp(8, 260)} style={styles.who}>
          <Pressable onPress={() => onProfile(partner)} accessibilityRole="button" accessibilityLabel={name}>
            <OnlineRing online={online} size={AVATAR} trace={arriving.current}>
              <View style={!online && styles.dim}>
                <Avatar uri={profile.photo_uri} size={AVATAR} />
              </View>
            </OnlineRing>
          </Pressable>
          <View style={styles.whoText}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.status, { color: online || typing ? fixed.lilac : colors.textMuted }]}>{status}</Text>
          </View>
        </Reanimated.View>

        <Reanimated.View entering={enterUp(8, 260, 40)}>
          <Pressable onPress={() => onOpenChat(partner)} accessibilityRole="button" accessibilityLabel={t('nous.conversation')}>
            <Card style={styles.conversation}>
              <View style={styles.convTop}>
                <Text style={styles.convTitle}>{t('nous.conversation')}</Text>
                {last && <Text style={styles.convWhen}>{when(last.created_at, now)}</Text>}
              </View>
              <View style={styles.convBottom}>
                <Text style={styles.convPreview} numberOfLines={1}>
                  {last ? describeMessage(last) : t('nous.premierMessage')}
                </Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        </Reanimated.View>

        <Reanimated.View entering={enterUp(8, 260, 80)} style={styles.duo}>
          <Pressable style={styles.duoItem} onPress={() => onPense(partner)} accessibilityRole="button" accessibilityLabel={t('nous.penseAToi')}>
            <Card style={styles.small}>
              <View style={styles.penseTop}>
                <StaticLily size={26} color={fixed.lilac} />
                {thoughts > 0 && <Text style={styles.penseCount}>{thoughts}</Text>}
              </View>
              <Text style={styles.smallLabel}>{t('nous.penseAToi')}</Text>
            </Card>
          </Pressable>
          <Pressable style={styles.duoItem} onPress={onDates} accessibilityRole="button" accessibilityLabel={t('nous.nosDates')}>
            <Card style={styles.small}>
              {days !== null ? <Text style={styles.days}>{t('nous.jours', { n: days })}</Text> : <CalendarGlyph color={fixed.lilac} />}
              <Text style={styles.smallLabel}>{days !== null ? t('nous.avantDeSeRevoir') : t('nous.ajouterDate')}</Text>
            </Card>
          </Pressable>
        </Reanimated.View>

        <Reanimated.View entering={enterUp(8, 260, 120)} style={styles.duo}>
          <Pressable style={styles.duoItem} onPress={onCycle} accessibilityRole="button" accessibilityLabel={t('cycle.titre')}>
            <Card style={styles.small}>
              <View style={styles.penseTop}>
                <Droplet size={22} color={fixed.cycle.period} fill={cycleInfo?.current ? fixed.cycle.period : fixed.transparent} strokeWidth={1.8} />
                {cycleText && (
                  <Text style={styles.penseCount} numberOfLines={1}>
                    {cycleText}
                  </Text>
                )}
              </View>
              <Text style={styles.smallLabel}>{cycleText ? t('cycle.titre') : cycleOwner(cycle, acceptedPairingFrom(key)) === 'me' ? t('cycle.carteSuivre') : t('cycle.carteAttente')}</Text>
            </Card>
          </Pressable>
          {away !== null && (
            <Pressable style={styles.duoItem} onPress={() => onMap(partner)} accessibilityRole="button" accessibilityLabel={t('distance.titre')}>
              <Card style={styles.small}>
                <Text style={styles.days} numberOfLines={1} adjustsFontSizeToFit>
                  {formatDistance(away, t('position.virgule'))}
                </Text>
                <Text style={styles.smallLabel}>{t('distance.entreVous')}</Text>
              </Card>
            </Pressable>
          )}
        </Reanimated.View>

        <Reanimated.View entering={enterUp(8, 260, 160)}>
          <Card style={styles.mood}>
            <Text style={styles.moodTitle}>{t('humeur.titre')}</Text>
            <View style={styles.moodRow}>
              <View style={styles.moodSide} accessible accessibilityLabel={`${name} : ${theirMood ? t(`humeur.${theirMood.mood}`) : t('humeur.pasEncore')}`}>
                <View style={[styles.moodTile, !theirMood && styles.moodTileEmpty]}>
                  {theirMood && <MoodIcon mood={theirMood.mood} size={20} color={fixed.lilac} />}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.moodWho} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.moodText} numberOfLines={1}>
                    {theirMood ? `${t(`humeur.${theirMood.mood}`)} · ${when(theirMood.at, now)}` : t('humeur.pasEncore')}
                  </Text>
                </View>
              </View>
              <Pressable style={({ pressed }) => [styles.moodSide, pressed && styles.pressed]} onPress={() => setMoodOpen(true)} accessibilityRole="button" accessibilityLabel={t('humeur.choisir')}>
                <View style={styles.moodTile}>
                  {myMood ? <MoodIcon mood={myMood.mood} size={20} color={fixed.lilac} /> : <Plus size={20} color={fixed.lilac} strokeWidth={1.8} />}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.moodWho}>{t('pense.toi')}</Text>
                  <Text style={styles.moodText} numberOfLines={1}>
                    {myMood ? t(`humeur.${myMood.mood}`) : t('humeur.choisir')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </Card>
        </Reanimated.View>

        {media.length > 0 && (
          <>
            <View style={styles.mediaHead}>
              <Text style={styles.cap}>{t('nous.mediasPartages')}</Text>
              <Pressable onPress={() => onMedia(partner)} hitSlop={10}>
                <Text style={styles.seeAll}>{t('nous.toutVoir')}</Text>
              </Pressable>
            </View>
            <View style={styles.media}>
              {media.map((message, index) => (
                <MediaTile key={message.id} message={message} index={index} onPress={() => onMedia(partner)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      {moodOpen && <MoodSheet current={myMood?.mood ?? null} onClose={() => setMoodOpen(false)} onPick={pickMood} />}
    </View>
  );
}

// La distance entre nous : sa dernière position en direct, et la mienne (celle que je lui partage en
// direct, sinon la dernière connue du téléphone). null si l'une des deux manque.
function distanceBetween(contact: string, located: boolean, now: number): number | null {
  let theirs: { latitude: number; longitude: number } | null = null;
  let mine: { latitude: number; longitude: number } | null = null;
  for (const message of getLocationMessages()) {
    if (message.contact !== contact) continue;
    const location = parseLocationText(message.text);
    if (!location || !isSharing(location, now)) continue;
    if (message.mine === 0 && !theirs) theirs = location;
    if (message.mine === 1 && !mine) mine = location;
  }
  if (!theirs) return null;
  if (!mine && located) {
    try {
      mine = lastKnownLocation();
    } catch (e) {
      log.warn('distance', e);
    }
  }
  return mine ? distanceKm(mine, theirs) : null;
}

// Choisir son humeur : une grille d'icônes au trait, l'autre la voit tout de suite.
function MoodSheet({ current, onClose, onPick }: { current: MoodId | null; onClose: () => void; onPick: (mood: MoodId) => void }) {
  const styles = useStyles();
  return (
    <Sheet title={t('humeur.question')} onClose={onClose}>
      {(close) => (
        <View style={styles.moodGrid}>
          {MOODS.map((mood) => (
            <Pressable
              key={mood}
              onPress={() => close(() => onPick(mood))}
              accessibilityRole="radio"
              accessibilityState={{ checked: current === mood }}
              style={({ pressed }) => [styles.moodChoice, current === mood && styles.moodChoiceOn, pressed && styles.pressed]}
            >
              <MoodIcon mood={mood} size={24} color={current === mood ? fixed.onSignatureSoft : fixed.lilac} />
              <Text style={styles.moodChoiceLabel}>{t(`humeur.${mood}`)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

function CalendarGlyph({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
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
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  appName: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  dim: {
    opacity: 0.55,
  },
  whoText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.text,
  },
  status: {
    marginTop: 4,
    fontSize: 13,
  },
  conversation: {
    marginHorizontal: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
  },
  convTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  convTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  convWhen: {
    fontSize: 13,
    fontWeight: '600',
    color: fixed.lilac,
  },
  convBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  convPreview: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: fixed.cardText,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: fixed.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  duo: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginHorizontal: 12,
  },
  duoItem: {
    flex: 1,
  },
  small: {
    height: 92,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  penseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  penseCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  smallLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  days: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 28,
    color: colors.text,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  mood: {
    marginTop: 8,
    marginHorizontal: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  moodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 12,
  },
  moodSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moodTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodTileEmpty: {
    backgroundColor: fixed.transparent,
    borderWidth: 1,
    borderColor: fixed.smokeEdge,
  },
  moodWho: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  moodText: {
    fontSize: 13,
    color: fixed.cardTextSoft,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    paddingBottom: 8,
  },
  moodChoice: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: colors.signature,
  },
  moodChoiceOn: {
    backgroundColor: fixed.lilacDeep,
  },
  moodChoiceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  mediaHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  cap: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
  },
  seeAll: {
    fontSize: 13,
    color: fixed.lilac,
  },
  media: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  tileWrap: {
    flex: 1,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: fixed.tile,
  },
  invite: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
    paddingBottom: 120,
  },
  requestWrap: {
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  request: {
    padding: 16,
    gap: 8,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  requestText: {
    fontSize: 13,
    lineHeight: 19,
    color: fixed.cardTextSoft,
    marginBottom: 4,
  },
  steps: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 8,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: fixed.card,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSignature,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  inviteButtons: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 12,
  },
  inviteTitle: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.text,
    textAlign: 'center',
  },
  inviteText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.onDarkMuted,
    textAlign: 'center',
  },
  inviteButton: {
    marginTop: 16,
    alignSelf: 'stretch',
  },
}));
