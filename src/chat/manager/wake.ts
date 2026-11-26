import { fetchContactToken } from '../../network/tokens';
import { PushResult, sendPush } from '../../network/wake';
import { deleteContactToken, getContactToken, getOutboxEvents, getSetting, getUndelivered, Message, setContactToken } from '../database';
import { encodePushPayload } from '../pushPayload';
import { parseMeta } from '../meta';

import { ChatCore } from './core';
import { offlineRoute } from '../packets';
import { countsAsAttempt } from '../pending';
import { noteAttempt, pushKeysFor, sealedText, sealSecure } from './secure';
import { textPayload } from './payloads';
import { WAKE_INTERVAL_MS } from './types';
import { log } from '../../log';
import { eventNotifies } from '../pushPriority';

// Pas plus de pushs d'un coup : le serveur limite à 20 par minute et par destinataire.
const MAX_PUSHES_PER_ROUND = 5;
// Les accusés reçus en rafale partent dans un seul push.
const ACK_DELAY_MS = 300;
// Un accusé qui n'a pas pu partir (réseau qui hésite au réveil) est retenté deux fois, avec le même
// contenu chiffré : sans accusé, l'expéditeur croit son message perdu.
const ACK_RETRY_MS = [1500, 4000];


// Réglage « Relais des fichiers » : activé tant qu'il n'a pas été coupé. Il sert aussi aux textes trop
// longs pour un push.
export const isRelayEnabled = () => getSetting('relay_enabled') !== '0';

// Le push d'un texte : son enveloppe gardée (jamais rechiffrée), null s'il ne tient pas dans un push.
export function textPushPayload(core: ChatCore, contact: string, message: Message): string | null {
  const keys = pushKeysFor(core, contact);
  return encodePushPayload(keys.tag, keys.key, sealedText(core, contact, message));
}

// Le contact n'est pas connecté : ce qui attend part chiffré dans un push. Le destinataire l'affiche
// tout de suite, même app fermée. Un texte trop long pour un push passe par le relais (relay.ts) ; un
// fichier déclenche en plus un simple réveil : l'autre téléphone se connecte et le reçoit en direct.
export function wakeIfNeeded(core: ChatCore, contact: string) {
  // Plus de garde sur « pas de réseau » : Android dit parfois « sans internet » sur un réseau qui marche
  // (Wi-Fi non validé, VPN, DNS privé) et le message attendait pour rien. Sans réseau, l'essai échoue
  // aussitôt et le suivant repart au prochain tour.
  if (core.links.get(contact)?.status === 'connected') return;
  if (getUndelivered(contact).length === 0 && getOutboxEvents(contact).length === 0) return;
  resolveToken(core, contact)
    .then((token) => (token ? pushPending(core, contact, token) : undefined))
    .catch((e) => log.warn('push', e));
}

// Un texte parti par push dont l'accusé n'est jamais revenu. Souvent il est bien arrivé et c'est
// l'accusé qui s'est perdu : il voyage en priorité normale, qu'Android jette quand notre app dort (sans
// batterie « sans restriction »). Parfois c'est le push lui-même. Dans les deux cas, le même paquet
// chiffré repart : s'il est déjà arrivé, l'autre téléphone le reconnaît, ne notifie rien et renvoie
// son accusé. Au retour dans l'app après 45 s sans accusé, puis toutes les 2 minutes, au plus 4 essais
// en tout (« Réessayer » reste là ensuite).
const REPUSH_ON_RETURN_MS = 45 * 1000;
const REPUSH_EVERY_MS = 2 * 60 * 1000;
const MAX_AUTO_ATTEMPTS = 4;

export function repushUnconfirmed(core: ChatCore, contact: string, returning = false) {
  if (core.links.get(contact)?.status === 'connected') return;
  const now = Date.now();
  const wait = returning ? REPUSH_ON_RETURN_MS : REPUSH_EVERY_MS;
  let again = false;
  for (const message of getUndelivered(contact)) {
    if (message.kind !== 'text' || !message.last_attempt_at || !core.pushed.has(message.id)) continue;
    if ((message.attempts ?? 0) >= MAX_AUTO_ATTEMPTS || now - message.last_attempt_at < wait) continue;
    core.pushed.delete(message.id);
    again = true;
  }
  if (again) {
    log.info('renvoi sans accusé', contact.slice(0, 6));
    wakeIfNeeded(core, contact);
  }
}

// Le token du contact : celui reçu en direct, sinon celui qu'il a publié (chiffré) dans Firebase. Relu
// au plus une fois par minute, par exemple après un token périmé.
export async function resolveToken(core: ChatCore, contact: string) {
  const known = getContactToken(contact);
  if (known) return known;
  if (!core.identity || Date.now() - (core.tokenFetches.get(contact) ?? 0) < WAKE_INTERVAL_MS) return null;
  core.tokenFetches.set(contact, Date.now());
  const fresh = await fetchContactToken(core.identity, contact);
  if (fresh) setContactToken(contact, fresh);
  return fresh;
}

// Prévient le contact d'un changement (supprimé, bloqué, débloqué) : en direct s'il est connecté,
// sinon par push. Fonctionne aussi pour un contact qu'on vient de retirer de la liste.
export async function sendStatusNow(core: ChatCore, contact: string, state: 'removed' | 'blocked' | 'unblocked') {
  const message = { type: 'status', state };
  const peer = core.links.get(contact)?.peer;
  if (peer?.isOpen()) {
    peer.send({ type: 'ratchet', ...sealSecure(core, contact, message) });
    return;
  }
  const token = await resolveToken(core, contact);
  if (!token) return;
  const keys = pushKeysFor(core, contact);
  const payload = encodePushPayload(keys.tag, keys.key, sealSecure(core, contact, message));
  if (payload) handleResult(core, contact, await sendPush(token, 'msg', payload));
}

// Envoie tout de suite ce qui attend, et attend la fin (réponse depuis une notification, app fermée :
// Android peut arrêter l'app juste après).
export async function deliverNow(core: ChatCore, contact: string) {
  if (core.links.get(contact)?.status === 'connected') return;
  const token = await resolveToken(core, contact);
  if (token) await pushPending(core, contact, token);
}

async function pushPending(core: ChatCore, contact: string, token: string) {
  const keys = pushKeysFor(core, contact);
  let sent = 0;
  // Ce qui ne tient pas dans un push demande un réveil. Pour les messages listés ici (fichiers…), un
  // réveil accepté compte comme un essai.
  let needsWake = false;
  const waking: string[] = [];
  // payload : le push déjà préparé ; messageId : le message dont c'est un essai (pas pour un événement).
  const send = async (id: string, payload: string, messageId?: string, quiet = false) => {
    if (core.pushed.has(id)) return true;
    if (sent >= MAX_PUSHES_PER_ROUND) return false;
    core.pushed.add(id);
    sent += 1;
    const result = await sendPush(token, 'msg', payload, { quiet });
    if (messageId && countsAsAttempt(result)) noteAttempt(core, contact, messageId);
    return handleResult(core, contact, result, id);
  };

  for (const message of getUndelivered(contact)) {
    if (message.kind !== 'text') {
      waking.push(message.id);
      continue;
    }
    const payload = textPushPayload(core, contact, message);
    const route = offlineRoute(payload, isRelayEnabled());
    if (payload) {
      if (!(await send(message.id, payload, message.id))) return;
    } else if (route === 'wake') {
      // Relais coupé : le même texte allégé (aperçu de lien sans son image) s'il tient dans un push,
      // sinon il attend la connexion directe. Le texte complet reste celui envoyé en direct.
      waking.push(message.id);
      const meta = message.meta ? parseMeta(message.meta) : null;
      if (meta?.preview?.image && !core.pushed.has(message.id) && sent < MAX_PUSHES_PER_ROUND) {
        const lighter = { ...textPayload(message, false), meta: { ...meta, preview: { ...meta.preview, image: undefined } } };
        const light = encodePushPayload(keys.tag, keys.key, sealSecure(core, contact, lighter));
        if (light && !(await send(message.id, light, message.id))) return;
      }
    }
    // route === 'relay' : relayPending (relay.ts) le dépose chiffré dans le relais ; le réveil permet
    // en plus une connexion directe si l'autre téléphone la prend avant.
    else needsWake = true;
  }
  for (const event of getOutboxEvents(contact)) {
    // Vérifié avant de chiffrer : chaque chiffrement d'un événement consomme une clé du ratchet.
    if (core.pushed.has(event.id)) continue;
    if (sent >= MAX_PUSHES_PER_ROUND) return;
    const body = JSON.parse(event.payload);
    const payload = encodePushPayload(keys.tag, keys.key, sealSecure(core, contact, { type: 'event', eventId: event.id, ...body }));
    if (!payload) {
      // Trop gros pour un push : il partira en direct, sans être rechiffré à chaque tour.
      core.pushed.add(event.id);
      needsWake = true;
      continue;
    }
    if (!(await send(event.id, payload, undefined, !eventNotifies(body)))) return;
  }
  if ((needsWake || waking.length > 0) && Date.now() - (core.lastWake.get(contact) ?? 0) >= WAKE_INTERVAL_MS) {
    core.lastWake.set(contact, Date.now());
    const result = await sendPush(token, 'wake', keys.tag);
    if (countsAsAttempt(result)) waking.forEach((id) => noteAttempt(core, contact, id));
    handleResult(core, contact, result);
  }
}

// Renvoie false s'il faut arrêter d'envoyer pour l'instant.
function handleResult(core: ChatCore, contact: string, result: PushResult, id?: string) {
  if (result === 'sent') return true;
  if (id) core.pushed.delete(id);
  if (result === 'expired') {
    // Le token ne sert plus : on l'oublie. Le prochain essai relit celui que le contact a publié.
    deleteContactToken(contact);
    log.info('token du contact périmé', contact.slice(0, 6));
  }
  return false;
}

// Un message reçu sans connexion (par push) est confirmé par push aussi : l'expéditeur voit « reçu »
// même si les deux apps restent fermées.
export function queuePushAck(core: ChatCore, contact: string, ack: { id?: string; eventId?: string }) {
  let pending = core.pushAcks.get(contact);
  if (!pending) {
    pending = { ids: new Set(), events: new Set() };
    core.pushAcks.set(contact, pending);
  }
  if (ack.id) pending.ids.add(ack.id);
  if (ack.eventId) pending.events.add(ack.eventId);
  clearTimeout(core.pushAckTimer);
  core.pushAckTimer = setTimeout(() => {
    core.pushAckFlush = flushPushAcks(core);
  }, ACK_DELAY_MS);
}

// Attendue par le réveil en arrière-plan avant de rendre la main à Android.
export async function settlePushAcks(core: ChatCore) {
  await new Promise((resolve) => setTimeout(resolve, ACK_DELAY_MS + 50));
  await core.pushAckFlush;
}

async function flushPushAcks(core: ChatCore) {
  const all = [...core.pushAcks];
  core.pushAcks.clear();
  for (const [contact, { ids, events }] of all) {
    // Connecté entre-temps : les accusés sont déjà partis en direct.
    if (core.links.get(contact)?.status === 'connected') continue;
    const token = await resolveToken(core, contact);
    if (!token) continue;
    const keys = pushKeysFor(core, contact);
    const payload = encodePushPayload(keys.tag, keys.key, sealSecure(core, contact, { type: 'acks', ids: [...ids], events: [...events] }));
    if (!payload) continue;
    // Un accusé n'affiche rien : priorité normale. Chiffré une seule fois, renvoyé tel quel.
    let result = await sendPush(token, 'msg', payload, { quiet: true });
    for (const delay of ACK_RETRY_MS) {
      if (result !== 'failed' && result !== 'limited') break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (core.links.get(contact)?.status === 'connected') break;
      result = await sendPush(token, 'msg', payload, { quiet: true });
    }
    handleResult(core, contact, result);
  }
}

// Le token voyage dans la connexion chiffrée : ni le QR code ni Firebase ne le transportent.
export function shareToken(core: ChatCore, contact?: string) {
  if (!core.myToken) return;
  const message = { type: 'token', token: core.myToken };
  if (contact) core.links.get(contact)?.peer.send(message);
  else core.links.forEach((link) => link.peer.send(message));
}
