// Les événements qui font une notification chez le destinataire partent en priorité haute ; les
// autres (modification, épingle, curseur de lecture, profil…) en priorité normale (voir sendPush).
const NOTIFYING_EVENTS = new Set(['thought', 'mood', 'cycle', 'relay', 'relay-text', 'accepted']);
export function eventNotifies(event: { action?: unknown; emoji?: unknown }) {
  if (event.action === 'react') return typeof event.emoji === 'string' && event.emoji.length > 0;
  return typeof event.action === 'string' && NOTIFYING_EVENTS.has(event.action);
}
