// Nébula : les médicaments courants contre les douleurs de règles, et le délai minimum entre deux prises
// indiqué par leur notice (adulte). Ce n'est qu'un rappel : l'écran renvoie toujours à la notice.
export const MEDS = [
  { id: 'paracetamol', hours: 4 },
  { id: 'ibuprofene', hours: 6 },
  { id: 'spasfon', hours: 2 },
  { id: 'mefenamique', hours: 8 },
] as const;

export type MedId = (typeof MEDS)[number]['id'];
export type MedDose = { med: MedId; at: number };

export const isMed = (value: unknown): value is MedId => typeof value === 'string' && MEDS.some((med) => med.id === value);
export const medHours = (id: MedId) => MEDS.find((med) => med.id === id)?.hours ?? 4;

// La dernière prise de chaque médicament, et quand il peut être repris.
export function lastDoses(doses: MedDose[]): { med: MedId; at: number; next: number }[] {
  const last = new Map<MedId, number>();
  for (const dose of doses) last.set(dose.med, Math.max(last.get(dose.med) ?? 0, dose.at));
  return [...last.entries()].map(([med, at]) => ({ med, at, next: at + medHours(med) * 3600 * 1000 })).sort((a, b) => b.at - a.at);
}
