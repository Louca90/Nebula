import { addDays, averageCycle, averagePeriod, currentPeriod, dayKey, dayStart, DEFAULT_CYCLE, DEFAULT_PERIOD, MAX_CYCLE, MIN_CYCLE, nextStart, Period, sortedPeriods } from './cycleMath';
import { isMed, MedDose, MedId } from './meds';
import { readJson, useCoupleVersion, writeJson } from './store';

// Nébula, suivi du cycle (carte « Cycle » de l'onglet Nous). Elle note ses règles (début, fin, douleur) ;
// les deux téléphones gardent la même copie, envoyée chiffrée comme Nos dates (la plus récente gagne).
// `owner` dit à qui est le cycle, vu de ce téléphone : 'me' (c'est elle qui tient ce téléphone) ou
// 'partner' (c'est son cycle à elle, vu de mon téléphone).

export type PainLevel = 0 | 1 | 2 | 3;
export type CycleOwner = 'me' | 'partner';
export type CycleData = {
  owner: CycleOwner | null;
  periods: Period[];
  pain: Record<string, PainLevel>;
  cycleLength: number;
  periodLength: number;
  // Nébula : les prises de médicaments des 7 derniers jours.
  meds: MedDose[];
  updatedAt: number;
};

const KEY = 'couple.cycle';
const EMPTY: CycleData = { owner: null, periods: [], pain: {}, cycleLength: DEFAULT_CYCLE, periodLength: DEFAULT_PERIOD, meds: [], updatedAt: 0 };
const MEDS_KEEP_MS = 7 * 24 * 3600 * 1000;
const MAX_MEDS = 60;
const MAX_PERIODS = 60;
const MAX_PAIN_DAYS = 120;

export function getCycle(): CycleData {
  return { ...EMPTY, ...readJson<Partial<CycleData>>(KEY, EMPTY) };
}

export function saveCycle(next: CycleData) {
  writeJson(KEY, next);
}

export function useCycle(): CycleData {
  useCoupleVersion();
  return getCycle();
}

// La durée de cycle et de règles qui servent aux prévisions : moyennes des saisies, sinon les réglages.
export function cycleStats(data: CycleData) {
  return { cycleLength: averageCycle(data.periods, data.cycleLength), periodLength: averagePeriod(data.periods, data.periodLength) };
}

// Ce que l'autre téléphone reçoit : `owner` vu de l'expéditeur, traduit à l'arrivée.
export function cycleForPartner(data: CycleData) {
  return { ...data, owner: data.owner === 'me' ? 'sender' : data.owner === 'partner' ? 'receiver' : null };
}

// Vérifie un objet reçu : des dates valables, des tailles bornées. Rend la copie vue de ce téléphone.
export function parseCycle(value: unknown): CycleData | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!Number.isSafeInteger(data.updatedAt) || !Array.isArray(data.periods)) return null;
  const owner: CycleOwner | null = data.owner === 'sender' ? 'partner' : data.owner === 'receiver' ? 'me' : null;
  const periods: Period[] = [];
  for (const item of data.periods.slice(-MAX_PERIODS)) {
    if (!item || typeof item !== 'object') return null;
    const period = item as Record<string, unknown>;
    if (!Number.isSafeInteger(period.start)) return null;
    const end = period.end === null ? null : Number.isSafeInteger(period.end) ? (period.end as number) : undefined;
    if (end === undefined || (end !== null && end < (period.start as number))) return null;
    periods.push({ start: period.start as number, end });
  }
  const pain: Record<string, PainLevel> = {};
  if (data.pain && typeof data.pain === 'object') {
    for (const [day, level] of Object.entries(data.pain as Record<string, unknown>).slice(-MAX_PAIN_DAYS)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && (level === 0 || level === 1 || level === 2 || level === 3)) pain[day] = level;
    }
  }
  const meds: MedDose[] = [];
  if (Array.isArray(data.meds)) {
    for (const item of data.meds.slice(-MAX_MEDS)) {
      const dose = item as Record<string, unknown> | null;
      if (dose && isMed(dose.med) && Number.isSafeInteger(dose.at)) meds.push({ med: dose.med, at: dose.at as number });
    }
  }
  const length = (value: unknown, fallback: number, min: number, max: number) => (Number.isSafeInteger(value) ? Math.max(min, Math.min(max, value as number)) : fallback);
  return {
    owner,
    periods: sortedPeriods(periods),
    pain,
    cycleLength: length(data.cycleLength, DEFAULT_CYCLE, MIN_CYCLE, MAX_CYCLE),
    periodLength: length(data.periodLength, DEFAULT_PERIOD, 1, 10),
    meds,
    updatedAt: data.updatedAt as number,
  };
}

// Reçu de l'autre téléphone : gardé seulement s'il est plus récent. Rend l'ancienne copie si gardé.
export function mergeCycle(incoming: CycleData): CycleData | null {
  const before = getCycle();
  if (incoming.updatedAt <= before.updatedAt) return null;
  saveCycle(incoming);
  return before;
}

// --- Modifications (toutes passent par update, qui date la copie) ---

function update(change: (data: CycleData) => Partial<CycleData>): CycleData {
  const data = getCycle();
  const next = { ...data, ...change(data), updatedAt: Date.now() };
  next.periods = sortedPeriods(next.periods).slice(-MAX_PERIODS);
  const keys = Object.keys(next.pain).sort().slice(-MAX_PAIN_DAYS);
  next.pain = Object.fromEntries(keys.map((key) => [key, next.pain[key]]));
  next.meds = (next.meds ?? []).filter((dose) => dose.at > Date.now() - MEDS_KEEP_MS).slice(-MAX_MEDS);
  saveCycle(next);
  return next;
}

// « J'ai mes règles » : elles commencent `day` (aujourd'hui par défaut, ou un jour passé si elle les
// note en cours), et restent en cours jusqu'à « Terminées ». Celui qui les note devient la propriétaire.
export function startPeriod(day: number, owner: CycleOwner) {
  const start = dayStart(day);
  return update((data) => {
    // Un début noté pendant des règles déjà en cours (ou à deux jours près) corrige ce début.
    const others = data.periods.filter((period) => Math.abs(start - period.start) > 2 * 24 * 3600 * 1000 && !(period.end === null && period.start <= start));
    return { owner: data.owner ?? owner, periods: [...others, { start, end: null }] };
  });
}

// « Elles sont finies » : la fin des règles en cours (aujourd'hui, ou un autre jour).
export function endPeriod(day: number) {
  const end = dayStart(day);
  return update((data) => ({
    periods: data.periods.map((period) => (period.end === null && period.start <= end ? { ...period, end } : period)),
  }));
}

export function deletePeriod(start: number) {
  return update((data) => ({ periods: data.periods.filter((period) => period.start !== start) }));
}

export function setPain(day: number, level: PainLevel) {
  return update((data) => ({ pain: { ...data.pain, [dayKey(day)]: level } }));
}

// Une prise de médicament (maintenant, ou à une autre heure).
export function addMedDose(med: MedId, at = Date.now()) {
  return update((data) => ({ meds: [...(data.meds ?? []), { med, at }].sort((a, b) => a.at - b.at) }));
}

export function deleteMedDose(at: number, med: MedId) {
  return update((data) => ({ meds: (data.meds ?? []).filter((dose) => !(dose.at === at && dose.med === med)) }));
}

export function setCycleSettings(cycleLength: number, periodLength: number) {
  return update(() => ({ cycleLength: Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, cycleLength)), periodLength: Math.max(1, Math.min(10, periodLength)) }));
}

export function setCycleOwner(owner: CycleOwner) {
  return update(() => ({ owner }));
}

// À qui est le cycle, vu de ce téléphone. Tant que rien n'est noté : elle est celle qui a accepté la
// demande de liaison (voir acceptedPairingFrom). Une fois noté, la propriétaire enregistrée l'emporte.
export function cycleOwner(data: CycleData, acceptedHere: boolean): CycleOwner {
  return data.owner ?? (acceptedHere ? 'me' : 'partner');
}

// Ce que montre la carte : règles en cours (jour n), sinon dans combien de jours.
export function cycleSummary(data: CycleData, now: number) {
  const { cycleLength, periodLength } = cycleStats(data);
  const current = currentPeriod(data.periods, now);
  const next = nextStart(data.periods, cycleLength, now);
  const today = dayStart(now);
  return {
    cycleLength,
    periodLength,
    current,
    currentDay: current ? Math.round((today - current.start) / (24 * 3600 * 1000)) + 1 : null,
    next,
    daysToNext: next !== null ? Math.max(0, Math.round((next - today) / (24 * 3600 * 1000))) : null,
    late: !current && data.periods.length > 0 && addDays(sortedPeriods(data.periods).at(-1)?.start ?? today, cycleLength) < today,
    painToday: data.pain[dayKey(now)] ?? null,
  };
}
