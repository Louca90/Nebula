import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { chat } from '../chat/manager';
import { describeMessage, getContactProfile, getLastMessage, getMediaMessages, getUnreadCounts, Message } from '../chat/database';
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
  onPair: () => void;
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

// Pas encore liés : l'invitation à scanner son QR code, avec le lys et le bouton Grain.
function PairInvite({ pending, onPair }: { pending: boolean; onPair: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.invite}>
      <StaticLily size={64} color={colors.text} />
      <Text style={styles.inviteTitle}>{pending ? t('nous.enAttente') : t('nous.lierTitre')}</Text>
      <Text style={styles.inviteText}>{pending ? t('nous.enAttenteAide') : t('nous.lierAide')}</Text>
      {!pending && <GrainButton label={t('nous.lier')} onPress={onPair} style={styles.inviteButton} />}
    </View>
  );
}

export function NousScreen({ contacts, onOpenChat, onProfile, onMedia, onPense, onDates, onPair }: Props) {
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
        <PairInvite pending={!!partner?.pending} onPair={onPair} />
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
    </View>
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
    paddingHorizontal: 32,
    gap: 12,
    paddingBottom: 120,
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
