// Nébula, suivi du cycle : les calculs, sans rien d'autre (testés dans cycleMath.test.ts).
//
// Un cycle commence au premier jour des règles. Les prévisions reprennent la durée moyenne des derniers
// cycles notés (sinon celle réglée, 28 jours par défaut) et se répètent sans fin : le calendrier les
// calcule pour n'importe quel mois, si loin qu'on aille.
//
// Les phases, pour un cycle de L jours :
//   règles          les premiers jours (notés, ou durée moyenne des règles pour une prévision)
//   folliculaire    jusqu'à la fenêtre fertile
//   fertile         les 5 jours avant l'ovulation et le lendemain
//   ovulation       L - 14 jours après le début (la phase lutéale dure environ 14 jours)
//   lutéale         jusqu'aux règles suivantes

export type Period = { start: number; end: number | null };
export type Phase = 'regles' | 'folliculaire' | 'fertile' | 'ovulation' | 'luteale';
export type DayInfo = { phase: Phase; predicted: boolean; cycleDay: number };

export const DAY_MS = 24 * 3600 * 1000;
export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;
export const MIN_CYCLE = 21;
export const MAX_CYCLE = 45;
const MAX_PERIOD = 10;
// Les derniers cycles comptés dans la moyenne.
const AVERAGE_OVER = 6;
const LUTEAL_DAYS = 14;

// Minuit local du jour de `at`.
export function dayStart(at: number) {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

// Le jour `n` jours après `day` (en jours du calendrier : les changements d'heure ne décalent rien).
export function addDays(day: number, n: number) {
  const date = new Date(day);
  date.setDate(date.getDate() + n);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Nombre de jours du calendrier entre deux jours.
export function daysBetween(from: number, to: number) {
  return Math.round((dayStart(to) - dayStart(from)) / DAY_MS);
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function sortedPeriods(periods: Period[]): Period[] {
  return [...periods].sort((a, b) => a.start - b.start);
}

// Durée moyenne d'un cycle d'après les débuts de règles notés ; `fallback` s'il n'y en a pas assez.
export function averageCycle(periods: Period[], fallback = DEFAULT_CYCLE): number {
  const starts = sortedPeriods(periods).map((period) => period.start);
  const gaps: number[] = [];
  for (let index = 1; index < starts.length; index += 1) {
    const gap = daysBetween(starts[index - 1], starts[index]);
    // Un oubli de saisie (deux cycles d'un coup) ne fausse pas la moyenne.
    if (gap >= MIN_CYCLE && gap <= MAX_CYCLE) gaps.push(gap);
  }
  const recent = gaps.slice(-AVERAGE_OVER);
  if (recent.length === 0) return clamp(Math.round(fallback), MIN_CYCLE, MAX_CYCLE);
  return clamp(Math.round(recent.reduce((sum, gap) => sum + gap, 0) / recent.length), MIN_CYCLE, MAX_CYCLE);
}

// Durée moyenne des règles terminées ; `fallback` sinon.
export function averagePeriod(periods: Period[], fallback = DEFAULT_PERIOD): number {
  const lengths = sortedPeriods(periods)
    .filter((period) => period.end !== null)
    .map((period) => daysBetween(period.start, period.end as number) + 1)
    .filter((length) => length >= 1 && length <= MAX_PERIOD)
    .slice(-AVERAGE_OVER);
  if (lengths.length === 0) return clamp(Math.round(fallback), 1, MAX_PERIOD);
  return clamp(Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length), 1, MAX_PERIOD);
}

// Les règles en cours aujourd'hui (début noté, pas encore de fin), s'il y en a.
export function currentPeriod(periods: Period[], now: number): Period | null {
  const today = dayStart(now);
  const last = sortedPeriods(periods).at(-1);
  if (!last || last.end !== null || last.start > today) return null;
  // Une saisie oubliée ne reste pas « en cours » indéfiniment.
  return daysBetween(last.start, today) < MAX_PERIOD ? last : null;
}

// Le prochain début de règles prévu, à partir d'aujourd'hui (aujourd'hui compris s'il n'a pas commencé).
// null tant qu'aucunes règles ne sont notées.
export function nextStart(periods: Period[], cycleLength: number, now: number): number | null {
  const sorted = sortedPeriods(periods);
  const last = sorted.at(-1);
  if (!last) return null;
  const today = dayStart(now);
  let next = addDays(last.start, cycleLength);
  // En retard : la prévision reste aujourd'hui tant que rien n'est noté (pas de saut d'un cycle entier).
  if (next < today) next = today;
  // Pendant des règles notées, la prochaine est celle du cycle suivant.
  if (currentPeriod(sorted, now) && next <= today) next = addDays(last.start, cycleLength);
  return next;
}

// La phase d'un jour, notée ou prévue. null avant les premières règles notées.
export function dayInfo(day: number, periods: Period[], cycleLength: number, periodLength: number, now: number): DayInfo | null {
  const sorted = sortedPeriods(periods);
  if (sorted.length === 0) return null;
  const target = dayStart(day);
  const today = dayStart(now);
  if (target < sorted[0].start) return null;

  // Un jour de règles notées.
  for (const period of sorted) {
    const end = period.end ?? (currentPeriod(sorted, now) === period ? today : addDays(period.start, periodLength - 1));
    if (target >= period.start && target <= end) return { phase: 'regles', predicted: false, cycleDay: daysBetween(period.start, target) + 1 };
  }

  // Le cycle auquel appartient ce jour : le dernier début noté avant lui, puis les débuts prévus.
  const last = sorted.at(-1) as Period;
  let start = [...sorted].reverse().find((period) => period.start <= target)?.start ?? sorted[0].start;
  let predicted = false;
  if (start === last.start && target >= addDays(last.start, cycleLength)) {
    // Après le dernier cycle noté : des cycles prévus, chacun de la durée moyenne. Le premier prévu ne
    // tombe jamais avant aujourd'hui (règles en retard).
    const first = nextStart(sorted, cycleLength, now) ?? addDays(last.start, cycleLength);
    if (target < first) {
      // Entre la fin prévue du cycle et des règles en retard : fin de phase lutéale.
      return { phase: 'luteale', predicted: true, cycleDay: daysBetween(last.start, target) + 1 };
    }
    const index = Math.floor(daysBetween(first, target) / cycleLength);
    start = addDays(first, index * cycleLength);
    predicted = true;
    if (daysBetween(start, target) < periodLength) return { phase: 'regles', predicted: true, cycleDay: daysBetween(start, target) + 1 };
  } else if (target > today) {
    predicted = true;
  }

  const cycleDay = daysBetween(start, target) + 1;
  // Un cycle passé a sa vraie durée (jusqu'aux règles notées suivantes).
  const following = sorted.find((period) => period.start > start);
  const length = following ? daysBetween(start, following.start) : cycleLength;
  const ovulation = Math.max(LUTEAL_DAYS / 2, length - LUTEAL_DAYS);
  const index = cycleDay - 1;
  let phase: Phase;
  if (index === ovulation) phase = 'ovulation';
  else if (index >= ovulation - 5 && index <= ovulation + 1) phase = 'fertile';
  else if (index < ovulation - 5) phase = 'folliculaire';
  else phase = 'luteale';
  return { phase, predicted, cycleDay };
}

// Clé d'un jour dans les tables (douleur) : « 2026-11-24 », en heure locale.
export function dayKey(at: number) {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
