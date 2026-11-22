import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';

import { getContactProfile, getMediaMessages } from '../chat/database';
import { haptics } from '../haptics';
import { IconButton, useInsets } from '../components/ui';
import { t } from '../i18n';
import { enterUp, timing } from '../motion';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';
import { ContactMedia } from './contact/ContactMedia';

// Planche « Elvira · Médias et visionneuse » : les photos, vidéos et fichiers échangés, sur fond noir, un
// sélecteur à trois onglets dont la pastille glisse, puis la grille. Une photo touchée s'agrandit depuis
// sa place dans la visionneuse.
type Tab = 'photos' | 'videos' | 'files';
const TABS: Tab[] = ['photos', 'videos', 'files'];
const SLIDE_MS = 320;

function Tabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const styles = useStyles();
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const index = TABS.indexOf(value);
  const position = useSharedValue(index);
  useEffect(() => {
    position.set(timing(index, SLIDE_MS));
  }, [index, position]);
  const slot = (width - 6) / TABS.length;
  const pill = useAnimatedStyle(() => ({ width: slot, transform: [{ translateX: position.get() * slot }] }));
  return (
    <View style={styles.tabs} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} accessibilityRole="tablist">
      {width > 0 && <Reanimated.View style={[styles.pill, pill]} />}
      {TABS.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => {
            if (tab === value) return;
            haptics.select();
            onChange(tab);
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === value }}
          style={styles.tab}
        >
          <Text style={[styles.tabLabel, { color: tab === value ? colors.text : colors.textMuted }]}>{t(`medias.${tab}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MediaScreen({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const { top } = useInsets();
  const [messages] = useState(() => getMediaMessages(contact.publicKey));
  const [tab, setTab] = useState<Tab>('photos');
  const name = getContactProfile(contact.publicKey).name ?? contact.name;
  const shown = messages.filter((message) => (tab === 'photos' ? message.kind === 'image' : tab === 'videos' ? message.kind === 'video' : message.kind === 'file'));
  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <View style={styles.header}>
        <IconButton onPress={onBack} label={t('commun.retour')}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
        </IconButton>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('nous.mediasPartages')}</Text>
          <Text style={styles.subtitle}>{t('medias.sousTitre', { nom: name, n: messages.length })}</Text>
        </View>
      </View>
      <Tabs value={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={styles.content}>
        <Reanimated.View key={tab} entering={enterUp(10, 240)}>
          <ContactMedia messages={shown} fixedKind={tab === 'files' ? 'files' : 'media'} />
        </Reanimated.View>
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: fixed.black },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: fixed.lilac },
  tabs: { flexDirection: 'row', marginTop: 4, marginHorizontal: 12, marginBottom: 12, padding: 3, height: 38, borderRadius: 14, backgroundColor: colors.surface },
  pill: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 11, backgroundColor: fixed.segment },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  content: { paddingHorizontal: 0, paddingBottom: 40 },
}));
