import notifee, { Event, EventType } from '@notifee/react-native';

import { isMed } from '../couple/meds';

import { chat } from './manager';
import { deleteCover } from './notifications';
import { REQUESTS_TARGET, setNotificationTarget, targetOf } from './notificationTarget';
import { log } from '../log';

// Appui sur une notification ou sur l'une de ses actions, app ouverte, en arrière-plan ou fermée.
// « Répondre » envoie la réponse sans ouvrir l'app (par push si le contact n'est pas connecté).
export async function handleNotificationEvent({ type, detail }: Event) {
  const data = detail.notification?.data;
  if (data?.requests) {
    if (type === EventType.PRESS) setNotificationTarget(REQUESTS_TARGET);
    else if (type === EventType.ACTION_PRESS && typeof data.key === 'string') {
      // Accepter, refuser ou bloquer sans ouvrir l'app.
      const action = detail.pressAction?.id;
      try {
        if (action === 'pair-accept') await chat.acceptRequestFromNotification(data.key);
        else if (action === 'pair-decline') await chat.declineRequestFromNotification(data.key);
        else if (action === 'pair-block') await chat.blockRequestFromNotification(data.key);
      } catch (e) {
        log.warn('action de demande', e);
      }
    }
    return;
  }
  // Nébula : une pensée ouvre l'écran Pense à toi, un rappel du cycle ouvre le suivi du cycle.
  if (typeof data?.thought === 'string' || data?.cycle) {
    if (type === EventType.PRESS) setNotificationTarget(targetOf(data));
    // « Je l'ai pris » : la prise du médicament est notée sans ouvrir l'app.
    else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'med-taken' && isMed(data.med)) {
      await chat.logMedicationFromNotification(data.med).catch((e) => log.warn('médicament', e));
      if (detail.notification?.id) await notifee.cancelNotification(detail.notification.id);
    }
    return;
  }
  // Appel (vague 5) : Répondre ouvre Pear et décroche, Refuser et Raccrocher n'ouvrent rien.
  if (typeof data?.call === 'string') {
    if (type !== EventType.ACTION_PRESS) return;
    const action = detail.pressAction?.id;
    if (action === 'call-accept') await chat.acceptCall();
    else if (action === 'call-decline') chat.declineCall();
    else if (action === 'call-end') chat.hangUp();
    return;
  }
  const contact = detail.notification?.data?.contact;
  if (typeof contact !== 'string') return;
  if (type === EventType.DISMISSED || type === EventType.PRESS) deleteCover(contact);
  if (type === EventType.PRESS) {
    setNotificationTarget(contact);
    return;
  }
  if (type !== EventType.ACTION_PRESS) return;
  try {
    if (detail.pressAction?.id === 'reply' && detail.input?.trim()) await chat.replyFromNotification(contact, detail.input.trim());
    else if (detail.pressAction?.id === 'read') await chat.markReadFromNotification(contact);
  } catch (e) {
    log.warn('action de notification', e);
  }
}
