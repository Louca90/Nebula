import { getAuth, getIdToken } from '@react-native-firebase/auth';

import { log } from '../log';
import { wakeUrl } from '../remoteConfig';

export type PushType = 'wake' | 'msg' | 'call';
// expired : le token FCM du destinataire n'existe plus (app désinstallée ou token renouvelé).
export type PushResult = 'sent' | 'expired' | 'limited' | 'failed';

// Le serveur sait-il envoyer en priorité normale ? Un serveur d'avant `quiet` refuse le champ (400) :
// on le retient pour la session et on renvoie sans.
let quietRefused = false;

// quiet : un push qui n'affiche rien chez le destinataire (accusé, modification, curseur de lecture…).
// Android 13+ et FCM rétrogradent la priorité haute d'une app dont les pushs hauts n'affichent pas de
// notification : les vrais messages arriveraient alors en retard quand le téléphone dort. Ces pushs-là
// partent donc en priorité normale (voir server/api/wake.js).
export type PushOptions = { quiet?: boolean };

// Demande à Vercel un push vers ce token. Le contenu éventuel est déjà chiffré de bout en bout.
export async function sendPush(fcmToken: string, type: PushType, payload?: string, options: PushOptions = {}): Promise<PushResult> {
  const user = getAuth().currentUser;
  const url = wakeUrl();
  if (!user || !url) return 'failed';
  const quiet = options.quiet === true && !quietRefused;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getIdToken(user)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: fcmToken, v: 1, type, ...(payload ? { payload } : {}), ...(quiet ? { quiet: true } : {}) }),
    });
    if (response.ok) return 'sent';
    if (response.status === 400 && quiet) {
      quietRefused = true;
      log.info('serveur sans priorité normale : push renvoyé sans');
      return sendPush(fcmToken, type, payload);
    }
    if (response.status === 410) return 'expired';
    if (response.status === 429) return 'limited';
    log.warn('push refusé', response.status);
    return 'failed';
  } catch (e) {
    log.warn('push', e);
    return 'failed';
  }
}
