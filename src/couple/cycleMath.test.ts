import { describe, expect, test } from '@jest/globals';

import { addDays, averageCycle, averagePeriod, currentPeriod, dayInfo, dayStart, nextStart, Period } from './cycleMath';

const day = (iso: string) => dayStart(new Date(`${iso}T12:00:00`).getTime());

describe('cycle', () => {
  const periods: Period[] = [
    { start: day('2026-08-01'), end: day('2026-08-05') },
    { start: day('2026-08-30'), end: day('2026-09-03') },
    { start: day('2026-09-28'), end: day('2026-10-02') },
  ];

  test('moyennes des cycles et des règles', () => {
    expect(averageCycle(periods)).toBe(29);
    expect(averagePeriod(periods)).toBe(5);
    // Pas assez de saisies : le réglage.
    expect(averageCycle(periods.slice(0, 1), 31)).toBe(31);
    // Un oubli (deux cycles d'un coup) est ignoré.
    expect(averageCycle([...periods, { start: day('2026-12-01'), end: null }])).toBe(29);
  });

  test('prochaines règles prévues, et en retard', () => {
    expect(nextStart(periods, 29, day('2026-10-10'))).toBe(addDays(day('2026-09-28'), 29));
    // En retard : la prévision reste aujourd'hui.
    expect(nextStart(periods, 29, day('2026-10-30'))).toBe(day('2026-10-30'));
    expect(nextStart([], 28, Date.now())).toBeNull();
  });

  test('règles en cours, notées en retard', () => {
    const ongoing = [...periods, { start: day('2026-10-26'), end: null }];
    expect(currentPeriod(ongoing, day('2026-10-28'))?.start).toBe(day('2026-10-26'));
    expect(dayInfo(day('2026-10-28'), ongoing, 29, 5, day('2026-10-28'))).toEqual({ phase: 'regles', predicted: false, cycleDay: 3 });
    // La prochaine est celle du cycle suivant.
    expect(nextStart(ongoing, 29, day('2026-10-28'))).toBe(addDays(day('2026-10-26'), 29));
  });

  test('phases d’un cycle noté et prévisions sans fin', () => {
    const now = day('2026-10-10');
    // Ovulation : 29 - 14 = 15 jours après le début.
    expect(dayInfo(addDays(day('2026-09-28'), 15), periods, 29, 5, now)?.phase).toBe('ovulation');
    expect(dayInfo(addDays(day('2026-09-28'), 12), periods, 29, 5, now)?.phase).toBe('fertile');
    expect(dayInfo(addDays(day('2026-09-28'), 7), periods, 29, 5, now)?.phase).toBe('folliculaire');
    expect(dayInfo(addDays(day('2026-09-28'), 20), periods, 29, 5, now)?.phase).toBe('luteale');
    // Dix cycles plus loin : des règles prévues.
    const far = addDays(day('2026-09-28'), 29 * 10 + 1);
    expect(dayInfo(far, periods, 29, 5, now)).toEqual({ phase: 'regles', predicted: true, cycleDay: 2 });
    // Avant les premières règles notées : rien.
    expect(dayInfo(day('2026-07-01'), periods, 29, 5, now)).toBeNull();
  });
});
