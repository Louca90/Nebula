import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import notifee from '@notifee/react-native';

import { Card, GrainButton } from '../../components/nebula';
import { t } from '../../i18n';
import { log } from '../../log';
import { enterUp } from '../../motion';
import { checkPermissions, PermissionState, requestPermission } from '../../onboarding/permissions';
import { createStyles, fixed } from '../../theme';
import Reanimated from 'react-native-reanimated';

type Missing = { notifications: PermissionState; battery: PermissionState } | null;

// Samsung met en veille les apps qu'il juge peu utilisées (listes « Applications en veille » et « en
// veille prolongée ») : leurs pushs n'arrivent plus avant l'ouverture. Le réglage est à part.
const isSamsung = () => String((Platform.constants as { Manufacturer?: string }).Manufacturer ?? '').toLowerCase() === 'samsung';

// Nébula : sans notifications ou avec la batterie « optimisée », Android retarde (ou bloque) les
// messages quand l'app est en arrière-plan. Avant, seul un point dans le profil le signalait : la carte
// le dit ici, sur l'accueil, avec le bouton qui règle le problème. Elle disparaît une fois réglé.
export function BackgroundCard() {
  const styles = useStyles();
  const [missing, setMissing] = useState<Missing>(null);

  const refresh = useCallback(() => {
    checkPermissions(['notifications', 'battery'])
      .then((states) => {
        const notifications = states.notifications ?? 'granted';
        const battery = states.battery ?? 'granted';
        setMissing(notifications === 'granted' && battery === 'granted' ? null : { notifications, battery });
      })
      .catch((e) => log.warn('autorisations', e));
  }, []);

  // Le réglage se fait hors de l'app : relu à chaque retour.
  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  if (!missing) return null;
  const notificationsOff = missing.notifications !== 'granted';
  const fix = () => {
    const id = notificationsOff ? 'notifications' : 'battery';
    requestPermission(id, notificationsOff ? missing.notifications : missing.battery)
      .then(refresh)
      .catch((e) => log.warn('autorisation', e));
  };

  return (
    <Reanimated.View entering={enterUp(8, 260, 60)}>
      <Card style={styles.card}>
        <Text style={styles.title}>{notificationsOff ? t('nous.fondNotifTitre') : t('nous.fondTitre')}</Text>
        <Text style={styles.text}>{notificationsOff ? t('nous.fondNotifTexte') : t('nous.fondTexte')}</Text>
        {!notificationsOff && isSamsung() && <Text style={styles.text}>{t('nous.fondSamsung')}</Text>}
        <View style={styles.actions}>
          <GrainButton label={t('nous.fondAutoriser')} onPress={fix} style={styles.action} />
          {!notificationsOff && isSamsung() && (
            <GrainButton
              variant="smoke"
              label={t('nous.fondReglages')}
              onPress={() => notifee.openPowerManagerSettings().catch(() => notifee.openBatteryOptimizationSettings())}
              style={styles.action}
            />
          )}
        </View>
      </Card>
    </Reanimated.View>
  );
}

const useStyles = createStyles(() => ({
  card: {
    marginHorizontal: 12,
    marginTop: 16,
    padding: 18,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: fixed.white,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: fixed.cardTextSoft,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  action: {
    flex: 1,
  },
}));
