import { Platform } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';

import { getSetting, setSetting } from './chat/database';
import { NOTIFICATION_CHANNEL_ID } from './config';
import { log } from './log';

// Ce qui permet de comprendre pourquoi une notification n'est pas arrivée (écran Diagnostic).

const LAST_PUSH = 'last_push';

// Appelé à chaque push reçu (réveil ou message), app ouverte ou fermée.
// Les 30 derniers pushs envoyés en priorité haute : true pour ceux qu'Android a fait passer en priorité
// normale (FCM le fait quand une app reçoit trop de pushs hauts sans notification). Un push ralenti
// attend que le téléphone se réveille : c'est la première cause d'un message qui arrive en retard.
const PUSH_PRIORITY = 'push_priority';
const PUSH_PRIORITY_KEEP = 30;
// Les valeurs de RemoteMessage côté Android.
const PRIORITY_HIGH = 1;
const PRIORITY_NORMAL = 2;

export function recordPush(type: string, priority?: unknown, originalPriority?: unknown) {
  try {
    setSetting(LAST_PUSH, JSON.stringify({ at: Date.now(), type }));
    if (originalPriority === PRIORITY_HIGH) {
      const recent = readJson<boolean[]>(PUSH_PRIORITY) ?? [];
      const demoted = priority === PRIORITY_NORMAL;
      if (demoted) log.warn('push ralenti par Android', type);
      setSetting(PUSH_PRIORITY, JSON.stringify([...recent, demoted].slice(-PUSH_PRIORITY_KEEP)));
    }
  } catch (e) {
    log.warn('diagnostic', e);
  }
}

export type Diagnostics = {
  notificationsAllowed: boolean;
  channelBlocked: boolean;
  batteryRestricted: boolean;
  // Réglage propre au constructeur (démarrage automatique, mise en veille des apps), s'il existe.
  powerManager: boolean;
  manufacturer: string;
  lastPush: { at: number; type: string } | null;
  // Parmi les derniers pushs hauts reçus : combien Android a ralentis.
  pushes: { total: number; demoted: number };
  inboxRegistered: boolean;
  tokenPublished: boolean;
};

function readJson<T>(key: string): T | null {
  try {
    const saved = getSetting(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}

export async function collectDiagnostics(): Promise<Diagnostics> {
  const [settings, channelBlocked, batteryRestricted, power] = await Promise.all([
    notifee.getNotificationSettings(),
    notifee.isChannelBlocked(NOTIFICATION_CHANNEL_ID).catch(() => false),
    notifee.isBatteryOptimizationEnabled().catch(() => false),
    notifee.getPowerManagerInfo().catch(() => null),
  ]);
  const published = readJson<Record<string, unknown>>('tokens_published');
  return {
    notificationsAllowed: settings.authorizationStatus === AuthorizationStatus.AUTHORIZED,
    channelBlocked,
    batteryRestricted,
    powerManager: Boolean(power?.activity),
    manufacturer: String((Platform.constants as { Manufacturer?: string }).Manufacturer ?? power?.manufacturer ?? ''),
    lastPush: readJson(LAST_PUSH),
    pushes: (() => {
      const recent = readJson<boolean[]>(PUSH_PRIORITY) ?? [];
      return { total: recent.length, demoted: recent.filter(Boolean).length };
    })(),
    inboxRegistered: readJson('inbox') !== null,
    tokenPublished: published !== null && Object.keys(published).length > 0,
  };
}

// Constructeurs connus pour arrêter les apps en arrière-plan : il faut autoriser Pear à la main.
const AGGRESSIVE = ['xiaomi', 'redmi', 'poco', 'oppo', 'realme', 'oneplus', 'huawei', 'honor', 'vivo', 'samsung', 'meizu', 'asus'];

export function needsManufacturerAdvice(manufacturer: string) {
  return AGGRESSIVE.includes(manufacturer.toLowerCase());
}

export function openBatterySettings() {
  return notifee.openBatteryOptimizationSettings();
}

export function openPowerManagerSettings() {
  return notifee.openPowerManagerSettings();
}

export function openNotificationSettings() {
  return notifee.openNotificationSettings();
}
