import { cancelScheduledNotifications, scheduleCoupleNotification, showCoupleNotification } from '../chat/notifications';
import { dateLocale, t } from '../i18n';
import { log } from '../log';
import { CycleData, cycleSummary, getCycle, PainLevel } from './cycle';
import { addDays, dayKey } from './cycleMath';

// Nébula : les rappels du cycle, programmés sur chaque téléphone à partir de la copie commune.
//   - les deux : deux jours avant les règles prévues ;
//   - elle : le jour prévu (le soir), « Tes règles sont arrivées ? », redemandé deux jours plus tard,
//     puis pendant les règles, « Elles sont terminées ? » ;
//   - lui : le jour prévu (le matin).
// Tout est reprogrammé à chaque changement (ici ou reçu) et à l'ouverture de l'app.

const IDS = ['cycle-soon', 'cycle-day', 'cycle-ask', 'cycle-ask-again', 'cycle-end'];
const DATA = { cycle: '1' };

function at(day: number, hour: number) {
  const date = new Date(day);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

const formatDay = (day: number) => new Intl.DateTimeFormat(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(day);

export async function rescheduleCycleNotifications(partnerName: string, data: CycleData = getCycle()) {
  try {
    await cancelScheduledNotifications(IDS);
    if (!data.owner || data.periods.length === 0) return;
    const now = Date.now();
    const summary = cycleSummary(data, now);
    const mine = data.owner === 'me';
    const tasks: Promise<void>[] = [];
    if (summary.current) {
      // Pendant les règles : elle confirme la fin, le lendemain de la durée habituelle.
      if (mine) tasks.push(scheduleCoupleNotification('cycle-end', at(addDays(summary.current.start, summary.periodLength), 19), t('cycle.notifFinTitre'), t('cycle.notifFinTexte'), DATA));
    }
    if (summary.next !== null) {
      const soon = addDays(summary.next, -2);
      tasks.push(
        scheduleCoupleNotification(
          'cycle-soon',
          at(soon, 10),
          mine ? t('cycle.notifBientotTitre') : t('cycle.notifBientotTitreLui', { nom: partnerName }),
          mine ? t('cycle.notifBientotTexte', { jour: formatDay(summary.next) }) : t('cycle.notifBientotTexteLui', { nom: partnerName, jour: formatDay(summary.next) }),
          DATA,
        ),
      );
      if (mine) {
        tasks.push(scheduleCoupleNotification('cycle-ask', at(summary.next, 19), t('cycle.notifArriveesTitre'), t('cycle.notifArriveesTexte'), DATA));
        tasks.push(scheduleCoupleNotification('cycle-ask-again', at(addDays(summary.next, 2), 19), t('cycle.notifArriveesTitre'), t('cycle.notifArriveesTexte'), DATA));
      } else {
        tasks.push(scheduleCoupleNotification('cycle-day', at(summary.next, 9), t('cycle.notifJourTitreLui', { nom: partnerName }), t('cycle.notifJourTexteLui'), DATA));
      }
    }
    await Promise.all(tasks);
  } catch (e) {
    log.warn('rappels du cycle', e);
  }
}

const PAIN_KEYS = ['cycle.douleur0', 'cycle.douleur1', 'cycle.douleur2', 'cycle.douleur3'] as const;
export const painLabel = (level: PainLevel) => t(PAIN_KEYS[level]);

// Reçu de l'autre téléphone : prévient de ce qui vient de changer chez elle (règles commencées, douleur).
export function notifyCycleChange(partnerName: string, before: CycleData, after: CycleData) {
  if (after.owner !== 'partner') return;
  const now = Date.now();
  const startedBefore = before.periods.at(-1)?.start;
  const current = cycleSummary(after, now).current;
  if (current && current.start !== startedBefore) {
    showCoupleNotification('cycle-started', t('cycle.notifCommenceTitreLui', { nom: partnerName }), t('cycle.notifCommenceTexteLui'), DATA).catch((e) => log.warn('notification', e));
  }
  const today = dayKey(now);
  const pain = after.pain[today];
  if (pain !== undefined && pain > 0 && pain !== before.pain[today]) {
    showCoupleNotification('cycle-pain', t('cycle.notifDouleurTitre', { nom: partnerName }), t('cycle.notifDouleurTexte', { niveau: painLabel(pain).toLowerCase() }), DATA).catch((e) => log.warn('notification', e));
  }
}
