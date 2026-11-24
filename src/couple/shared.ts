import { AppState } from 'react-native';

import { showCoupleNotification } from '../chat/notifications';
import { t } from '../i18n';
import { log } from '../log';
import { cycleForPartner, getCycle, mergeCycle, parseCycle } from './cycle';
import { notifyCycleChange, rescheduleCycleNotifications } from './cycleNotifications';
import { getDates, mergeDates, parseDates } from './dates';
import { getMoods, isMood, receiveMood } from './mood';

// Nébula : les données de couple partagées entre les deux téléphones, au même endroit. Chacune a son
// événement chiffré (le nom de l'action reste celui d'avant : un téléphone pas encore à jour comprend
// toujours), ce qu'il envoie, et ce qu'il fait de ce qu'il reçoit (en général : la plus récente gagne,
// puis une notification ou des rappels). Ajouter une donnée partagée = ajouter une entrée ici.
// Les pensées (« Pense à toi ») restent à part : ce sont des gestes qui s'additionnent, pas un état.

type Received = { contact: string; name: string; foreground: boolean };
type SharedKind = {
  // Ce qui part, ajouté à l'événement ; null : rien à envoyer.
  fields: () => Record<string, unknown> | null;
  receive: (data: Record<string, unknown>, from: Received) => void;
};

const KINDS: Record<string, SharedKind> = {
  // Nos dates : la liste entière, la plus récente gagne.
  dates: {
    fields: () => ({ dates: getDates() }),
    receive: (data) => {
      const dates = parseDates(data.dates);
      if (dates) mergeDates(dates);
    },
  },
  // Le suivi du cycle : la copie entière ; ses règles qui commencent ou sa douleur font une notification.
  cycle: {
    fields: () => ({ cycle: cycleForPartner(getCycle()) }),
    receive: (data, { name, foreground }) => {
      const cycle = parseCycle(data.cycle);
      const before = cycle ? mergeCycle(cycle) : null;
      if (!cycle || !before) return;
      if (!foreground) notifyCycleChange(name, before, cycle);
      rescheduleCycleNotifications(name, cycle).catch((e) => log.warn('rappels du cycle', e));
    },
  },
  // Mon humeur : la sienne arrive, la plus récente gagne, avec une notification app fermée.
  mood: {
    fields: () => {
      const mine = getMoods().mine;
      return mine ? { mood: mine.mood, at: mine.at } : null;
    },
    receive: (data, { contact, name, foreground }) => {
      if (!isMood(data.mood) || !Number.isSafeInteger(data.at)) return;
      if (!receiveMood(data.mood, Math.min(data.at as number, Date.now())) || foreground) return;
      showCoupleNotification('mood', t('humeur.notifTitre', { nom: name }), t('humeur.notifTexte', { humeur: t(`humeur.${data.mood}`) }), { mood: contact }).catch((e) =>
        log.warn('notification', e),
      );
    },
  },
};

export type SharedAction = keyof typeof KINDS;

export const isSharedAction = (action: unknown): action is SharedAction => typeof action === 'string' && action in KINDS;

// L'événement à envoyer pour une donnée partagée (null : rien à envoyer).
export function sharedEvent(action: SharedAction): Record<string, unknown> | null {
  const fields = KINDS[action].fields();
  return fields ? { action, id: '', ...fields } : null;
}

// Un événement reçu de l'autre téléphone.
export function receiveShared(data: Record<string, unknown>, contact: string, name: string) {
  if (!isSharedAction(data.action)) return;
  KINDS[data.action].receive(data, { contact, name, foreground: AppState.currentState === 'active' });
}
