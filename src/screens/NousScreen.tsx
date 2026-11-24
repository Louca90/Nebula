import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
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
import { Camera, ChevronRight, Droplet, MapPin, MessageCircle, Navigation, Phone, Plus } from 'lucide-react-native';
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
import { dateLocale, t } from '../i18n';
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
  onShareLocation: (contact: Contact) => void;
  onCamera: (contact: Contact) => void;
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

export function NousScreen({ contacts, onOpenChat, onProfile, onMedia, onPense, onDates, onCycle, onMap, onShareLocation, onCamera, onPair, onRequests }: Props) {
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
      <StaticLily size={22} color={colors.text} />
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

        {/* Nébula : la conversation est une barre de message (son dernier message, l'heure, les nouveaux),
            avec un bouton rond qui ouvre la discussion : plus de carte « Conversation ». */}
        <Reanimated.View entering={enterUp(8, 260, 40)}>
          <Pressable onPress={() => onOpenChat(partner)} accessibilityRole="button" accessibilityLabel={t('nous.conversation')} style={({ pressed }) => [styles.message, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <Text style={styles.messageText} numberOfLines={1}>
                {last ? describeMessage(last) : t('nous.premierMessage')}
              </Text>
              {last && (
                <Text style={styles.messageMeta} numberOfLines={1}>
                  {unread > 0 ? `${when(last.created_at, now)} · ${t('nous.nouveaux', { n: unread })}` : when(last.created_at, now)}
                </Text>
              )}
            </View>
            <View style={styles.messageButton}>
              <MessageCircle size={20} color={fixed.onGrainButton} strokeWidth={2} />
            </View>
          </Pressable>
        </Reanimated.View>

        {/* Quatre gestes, en ronds comme sur une fiche contact. */}
        <Reanimated.View entering={enterUp(8, 260, 80)} style={styles.actions}>
          <QuickAction label={t('nous.penseAToi')} badge={thoughts} onPress={() => onPense(partner)}>
            <StaticLily size={22} color={fixed.lilac} />
          </QuickAction>
          <QuickAction label={t('nous.appeler')} onPress={() => chat.startCall(key, false)}>
            <Phone size={22} color={fixed.lilac} strokeWidth={1.8} />
          </QuickAction>
          <QuickAction label={t('nous.position')} onPress={() => onShareLocation(partner)}>
            <MapPin size={22} color={fixed.lilac} strokeWidth={1.8} />
          </QuickAction>
          <QuickAction label={t('nous.photo')} onPress={() => onCamera(partner)}>
            <Camera size={22} color={fixed.lilac} strokeWidth={1.8} />
          </QuickAction>
        </Reanimated.View>

        {/* Aujourd'hui : une seule liste, des lignes de même forme (plus de petites cartes éparpillées). */}
        <Text style={styles.cap}>{t('nous.aujourdhui')}</Text>
        <Reanimated.View entering={enterUp(8, 260, 120)} style={styles.list}>
          <TodayRow
            first
            label={t('humeur.titre')}
            detail={`${name} : ${theirMood ? t(`humeur.${theirMood.mood}`) : t('humeur.pasEncore')} · ${t('pense.toi')} : ${myMood ? t(`humeur.${myMood.mood}`) : t('humeur.choisir')}`}
            onPress={() => setMoodOpen(true)}
            icon={theirMood ? <MoodIcon mood={theirMood.mood} size={18} color={fixed.lilac} /> : <Plus size={18} color={fixed.lilac} strokeWidth={1.8} />}
          />
          <TodayRow
            label={t('cycle.titre')}
            detail={cycleText ?? (cycleOwner(cycle, acceptedPairingFrom(key)) === 'me' ? t('cycle.carteSuivre') : t('cycle.carteAttente'))}
            value={cycleInfo?.current ? t('cycle.carteJourCourt', { n: cycleInfo.currentDay ?? 1 }) : undefined}
            onPress={onCycle}
            icon={<Droplet size={18} color={fixed.cycle.period} fill={cycleInfo?.current ? fixed.cycle.period : fixed.transparent} strokeWidth={1.8} />}
          />
          {away !== null && (
            <TodayRow
              label={t('distance.titre')}
              detail={t('distance.entreVous')}
              value={formatDistance(away, t('position.virgule'))}
              onPress={() => onMap(partner)}
              icon={<Navigation size={18} color={fixed.lilac} strokeWidth={1.8} />}
            />
          )}
          <TodayRow
            label={t('nous.prochaineFois')}
            detail={nextDate ? new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(nextDate) : t('nous.ajouterDate')}
            value={days !== null ? t('nous.jours', { n: days }) : undefined}
            onPress={onDates}
            icon={<CalendarGlyph color={fixed.lilac} size={18} />}
          />
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

// Un geste rapide : un rond sombre, son icône et son nom dessous ; un compteur éventuel en pastille.
function QuickAction({ label, badge, onPress, children }: { label: string; badge?: number; onPress: () => void; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View style={styles.actionCircle}>
        {children}
        {!!badge && (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Une ligne de la liste « Aujourd'hui » : icône, titre, détail, valeur et chevron.
function TodayRow({ label, detail, value, icon, first, onPress }: { label: string; detail: string; value?: string; icon: ReactNode; first?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && styles.rowPressed]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </Pressable>
  );
}

function CalendarGlyph({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: fixed.cardTextSoft,
  },
  message: {
    marginHorizontal: 12,
    minHeight: 64,
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: 32,
    backgroundColor: fixed.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  messageMeta: {
    marginTop: 3,
    fontSize: 12,
    color: fixed.mutedLight,
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: fixed.grainButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 20,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: fixed.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: fixed.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: fixed.onGrainButton,
    fontVariant: ['tabular-nums'],
  },
  actionLabel: {
    fontSize: 12,
    color: fixed.cardTextSoft,
  },
  list: {
    marginHorizontal: 12,
    borderRadius: 22,
    backgroundColor: fixed.card,
    overflow: 'hidden',
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: fixed.hairline,
  },
  rowPressed: {
    backgroundColor: fixed.hairline,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.signature,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowDetail: {
    marginTop: 2,
    fontSize: 12,
    color: fixed.mutedLight,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
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
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
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
