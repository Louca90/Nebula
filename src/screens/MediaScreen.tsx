import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { getContactProfile, getMediaMessages } from '../chat/database';
import { IconButton, useInsets } from '../components/ui';
import { t } from '../i18n';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';
import { ContactMedia } from './contact/ContactMedia';

// Planche « Elvira · Médias et visionneuse » : les photos, vidéos et fichiers échangés, sur fond noir. Une
// photo touchée s'agrandit depuis sa place dans la visionneuse (celle de la conversation).
export function MediaScreen({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const { top } = useInsets();
  const [messages] = useState(() => getMediaMessages(contact.publicKey));
  const name = getContactProfile(contact.publicKey).name ?? contact.name;
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
      <ScrollView contentContainerStyle={styles.content}>
        <ContactMedia messages={messages} />
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
  content: { paddingHorizontal: 12, paddingBottom: 40 },
}));
