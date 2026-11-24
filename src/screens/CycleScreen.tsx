import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ArrowLeft, ChevronLeft, ChevronRight, Droplet, Minus, Plus } from 'lucide-react-native';

import { chat } from '../chat/manager';
import { getContactProfile } from '../chat/database';
import { cycleStats, CycleData, cycleSummary, deletePeriod, endPeriod, PainLevel, setCycleOwner, setCycleSettings, setPain, startPeriod, useCycle } from '../couple/cycle';
import { DAY_MS, dayInfo, dayKey, dayStart, MAX_CYCLE, MIN_CYCLE, Phase, sortedPeriods } from '../couple/cycleMath';
import { painLabel } from '../couple/cycleNotifications';
import { haptics } from '../haptics';
import { showDialog } from '../components/dialog';
import { Sheet } from '../components/Sheet';
import { IconButton, useInsets } from '../components/ui';
import { GrainButton } from '../components/nebula';
import { dateLocale, t } from '../i18n';
import { enterUp, timing } from '../motion';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';
import { MonthPicker } from './DatesScreen';

// Nébula : le suivi du cycle (carte « Cycle » de l'onglet Nous), sur le modèle de la planche « Nos dates » :
// un anneau en haut (le jour du cycle), puis des listes sur fond de surface. Elle note ses règles (même
// en cours, en choisissant le jour où elles ont commencé), leur fin et sa douleur ; le calendrier montre
// chaque phase, notée ou prévue, aussi loin qu'on veut. Lui voit la même chose, sans rien modifier.
type Props = { partner: Contact | null; onBack: () => void };

const RING = 132;
const RING_R = 58;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const PAIN_LEVELS: PainLevel[] = [0, 1, 2, 3];

function format(at: number, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(dateLocale(), options).format(at);
}

const phaseLabel = (phase: Phase) => t(`cycle.phase_${phase}`);

// L'intensité d'une douleur, dessinée : quatre barres qui montent, autant d'allumées que le niveau.
function PainBars({ level, on }: { level: PainLevel; on: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[1, 2, 3].map((step) => (
        <View key={step} style={[styles.bar, { height: 6 + step * 5 }, step <= level && (on ? styles.barOnSelected : styles.barOn)]} />
      ))}
    </View>
  );
}

// Le calendrier du cycle : un mois, ses flèches (sans fin dans les deux sens), chaque jour teinté par sa
// phase. Règles notées : rose plein ; prévues : anneau rose. Ovulation : lilas plein ; fertile : lilas pâle.
// Aujourd'hui : le chiffre en gras, souligné.
function CycleCalendar({ data, now, onDay }: { data: CycleData; now: number; onDay: (day: number) => void }) {
  const styles = useStyles();
  const colors = useColors();
  const { cycleLength, periodLength } = cycleStats(data);
  const [month, setMonth] = useState(() => {
    const date = new Date(now);
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  });
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array.from({ length: offset }, () => null), ...Array.from({ length }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1).getTime())];
  const weekdays = Array.from({ length: 7 }, (_, index) => format(new Date(2024, 0, 1 + index).getTime(), { weekday: 'narrow' }));
  const today = dayStart(now);
  const shift = (step: number) => {
    haptics.select();
    setMonth(new Date(first.getFullYear(), first.getMonth() + step, 1).getTime());
  };
  return (
    <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <IconButton onPress={() => shift(-1)} label={t('dates.moisPrecedent')}>
          <ChevronLeft size={20} color={colors.text} strokeWidth={1.8} />
        </IconButton>
        <Text style={styles.monthTitle}>{format(month, { month: 'long', year: 'numeric' })}</Text>
        <IconButton onPress={() => shift(1)} label={t('dates.moisSuivant')}>
          <ChevronRight size={20} color={colors.text} strokeWidth={1.8} />
        </IconButton>
      </View>
      <View style={styles.grid}>
        {weekdays.map((day, index) => (
          <Text key={`w${index}`} style={styles.weekday}>
            {day}
          </Text>
        ))}
        {cells.map((at, index) => {
          if (at === null) return <View key={`e${index}`} style={styles.cell} />;
          const info = dayInfo(at, data.periods, cycleLength, periodLength, now);
          const pain = data.pain[dayKey(at)];
          const period = info?.phase === 'regles';
          const ovulation = info?.phase === 'ovulation';
          const solid = (period || ovulation) && !info?.predicted;
          return (
            <Pressable
              key={at}
              onPress={() => onDay(at)}
              accessibilityRole="button"
              accessibilityLabel={`${format(at, { day: 'numeric', month: 'long' })}${info ? ` · ${phaseLabel(info.phase)}${info.predicted ? ` (${t('cycle.prevu')})` : ''}` : ''}`}
              style={styles.cell}
            >
              {/* Jamais fusionnée par React Native (sinon le rond sortait carré). */}
              <View
                collapsable={false}
                style={[
                  styles.day,
                  info?.phase === 'fertile' && styles.dayFertile,
                  period && (info?.predicted ? styles.dayPeriodPredicted : styles.dayPeriod),
                  ovulation && (info?.predicted ? styles.dayOvulationPredicted : styles.dayOvulation),
                ]}
              >
                <Text style={[styles.dayText, solid && styles.dayTextOn, at === today && styles.dayTextToday, at < today && !info && styles.dayTextPast]}>{new Date(at).getDate()}</Text>
              </View>
              {at === today ? <View style={styles.todayMark} /> : pain !== undefined && pain > 0 ? <View style={styles.painMark} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.dayPeriod]} />
          <Text style={styles.legendText}>{t('cycle.legendeRegles')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.dayPeriodPredicted]} />
          <Text style={styles.legendText}>{t('cycle.legendePrevues')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.dayFertile]} />
          <Text style={styles.legendText}>{t('cycle.phase_fertile')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.dayOvulation]} />
          <Text style={styles.legendText}>{t('cycle.phase_ovulation')}</Text>
        </View>
      </View>
    </View>
  );
}

// Choisir un jour (début ou fin des règles) dans une feuille.
function DaySheet({ title, initial, onClose, onSave }: { title: string; initial: number; onClose: () => void; onSave: (day: number) => void }) {
  const styles = useStyles();
  const [day, setDay] = useState(initial);
  const future = dayStart(day) > dayStart(Date.now());
  return (
    <Sheet title={title} onClose={onClose}>
      {(close) => (
        <View style={styles.sheetBody}>
          <MonthPicker value={day} onChange={setDay} />
          {future && <Text style={styles.hint}>{t('cycle.pasDansLeFutur')}</Text>}
          <GrainButton label={t('dates.enregistrer')} disabled={future} onPress={() => close(() => onSave(day))} />
        </View>
      )}
    </Sheet>
  );
}

function Stepper({ label, value, min, max, first, onChange }: { label: string; value: number; min: number; max: number; first: boolean; onChange: (value: number) => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <Text style={styles.rowTitleFlex}>{label}</Text>
      <IconButton onPress={() => value > min && onChange(value - 1)} label={t('cycle.moins')}>
        <Minus size={18} color={value > min ? colors.text : colors.disabled} strokeWidth={1.8} />
      </IconButton>
      <Text style={styles.stepperValue}>{t('cycle.nJours', { n: value })}</Text>
      <IconButton onPress={() => value < max && onChange(value + 1)} label={t('cycle.plus')}>
        <Plus size={18} color={value < max ? colors.text : colors.disabled} strokeWidth={1.8} />
      </IconButton>
    </View>
  );
}

export function CycleScreen({ partner, onBack }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const { top } = useInsets();
  const data = useCycle();
  const [now] = useState(() => Date.now());
  const [sheet, setSheet] = useState<'start' | 'end' | null>(null);
  const name = partner ? (getContactProfile(partner.publicKey).name ?? partner.name) : '';
  const summary = cycleSummary(data, now);
  // Lui voit son cycle à elle sans le modifier ; tant que personne n'a rien noté, chacun peut commencer.
  const canEdit = data.owner !== 'partner';
  const today = dayStart(now);
  const info = dayInfo(today, data.periods, summary.cycleLength, summary.periodLength, now);

  // L'anneau : le jour du cycle sur sa durée (vide tant que rien n'est noté).
  const fill = useSharedValue(0);
  const progress = info ? Math.min(1, info.cycleDay / summary.cycleLength) : 0;
  const started = !!info;
  useEffect(() => {
    fill.set(timing(Math.max(progress, started ? 0.04 : 0), 1400));
  }, [progress, started, fill]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - fill.get()) }));

  const change = (action: () => void) => {
    action();
    if (partner) chat.shareCycle(partner.publicKey);
    haptics.success();
  };

  const onDay = (day: number) => {
    const value = dayInfo(day, data.periods, summary.cycleLength, summary.periodLength, now);
    const pain = data.pain[dayKey(day)];
    const lines = [
      value ? `${phaseLabel(value.phase)}${value.predicted ? ` (${t('cycle.prevu')})` : ''} · ${t('cycle.jourDuCycle', { n: value.cycleDay })}` : t('cycle.pasDeDonnees'),
      pain !== undefined ? t('cycle.douleurCeJour', { niveau: painLabel(pain) }) : null,
    ].filter(Boolean);
    showDialog(format(day, { weekday: 'long', day: 'numeric', month: 'long' }), lines.join('\n'));
  };

  const headline = summary.current
    ? t('cycle.phase_regles')
    : summary.late
      ? t('cycle.enRetard')
      : summary.daysToNext === null
        ? t('cycle.commencer')
        : summary.daysToNext === 0
          ? t('cycle.prevuesAujourdhui')
          : t('cycle.reglesDans', { n: summary.daysToNext });
  const subline = summary.current
    ? t('cycle.finPrevue', { n: Math.max(1, summary.periodLength - (summary.currentDay ?? 1) + 1) })
    : summary.next !== null
      ? `${info ? `${phaseLabel(info.phase)} · ` : ''}${t('cycle.prevuesLe', { jour: format(summary.next, { day: 'numeric', month: 'long' }) })}`
      : canEdit
        ? t('cycle.introElle')
        : t('cycle.introLui', { nom: name });

  const history = sortedPeriods(data.periods).reverse().slice(0, 8);

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <View style={styles.header}>
        <IconButton onPress={onBack} label={t('commun.retour')}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
        </IconButton>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('cycle.titre')}</Text>
          {data.owner === 'partner' && <Text style={styles.subtitle}>{t('cycle.sousTitreLui', { nom: name })}</Text>}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Reanimated.View entering={enterUp(10, 300)} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.ring}>
              <Svg width={RING} height={RING} viewBox="0 0 132 132" style={styles.ringSvg}>
                <Circle cx={66} cy={66} r={RING_R} fill="none" stroke={fixed.ringTrack} strokeWidth={8} />
                <AnimatedCircle
                  cx={66}
                  cy={66}
                  r={RING_R}
                  fill="none"
                  stroke={summary.current ? fixed.cycle.period : fixed.lilac}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  animatedProps={arc}
                />
              </Svg>
              <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
                <Text style={styles.ringNumber}>{info ? info.cycleDay : '–'}</Text>
                <Text style={styles.ringUnit}>{t('cycle.jourDuCycleCourt')}</Text>
              </View>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.cap}>{t('cycle.aujourdhui')}</Text>
              <Text style={styles.headline}>{headline}</Text>
              <Text style={styles.subline}>{subline}</Text>
            </View>
          </View>
          {canEdit && (
            <View style={styles.actions}>
              <GrainButton
                label={summary.current ? t('cycle.terminees') : t('cycle.ontCommence')}
                icon={summary.current ? undefined : <Droplet size={18} color={fixed.onGrainButton} strokeWidth={1.9} />}
                onPress={() => change(() => (summary.current ? endPeriod(now) : startPeriod(now, 'me')))}
              />
              <GrainButton variant="smoke" label={t('cycle.autreJour')} onPress={() => setSheet(summary.current ? 'end' : 'start')} />
              {/* Rien n'est encore noté : sur son téléphone à lui, il laisse le suivi à elle. */}
              {data.owner === null && data.periods.length === 0 && partner && (
                <Pressable onPress={() => change(() => setCycleOwner('partner'))} hitSlop={8} style={styles.ownerLink} accessibilityRole="button">
                  <Text style={styles.ownerLinkText}>{t('cycle.cEstElle', { nom: name })}</Text>
                </Pressable>
              )}
            </View>
          )}
        </Reanimated.View>

        {(summary.current || summary.painToday !== null) && (
          <>
            <Text style={styles.section}>{canEdit ? t('cycle.douleurQuestion') : t('cycle.douleurLui', { nom: name })}</Text>
            <Reanimated.View entering={enterUp(8, 260, 40)} style={styles.list}>
              {canEdit ? (
                <View style={styles.pains}>
                  {PAIN_LEVELS.map((level) => {
                    const selected = summary.painToday === level;
                    return (
                      <Pressable
                        key={level}
                        onPress={() => change(() => setPain(now, level))}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={painLabel(level)}
                        style={({ pressed }) => [styles.pain, selected && styles.painSelected, pressed && styles.pressed]}
                      >
                        <PainBars level={level} on={selected} />
                        <Text style={[styles.painLabel, selected && styles.painLabelSelected]}>{painLabel(level)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.row}>
                  {summary.painToday !== null && <PainBars level={summary.painToday} on={false} />}
                  <Text style={styles.rowTitleFlex}>{summary.painToday !== null ? painLabel(summary.painToday) : t('cycle.douleurInconnue')}</Text>
                </View>
              )}
            </Reanimated.View>
          </>
        )}

        <Text style={styles.section}>{t('cycle.calendrier')}</Text>
        <Reanimated.View entering={enterUp(8, 260, 80)} style={[styles.list, styles.calendarBox]}>
          <CycleCalendar data={data} now={now} onDay={onDay} />
        </Reanimated.View>

        {history.length > 0 && (
          <>
            <Text style={styles.section}>{t('cycle.historique')}</Text>
            <View style={styles.list}>
              {history.map((period, index) => {
                const end = period.end ?? today;
                const days = Math.round((dayStart(end) - period.start) / DAY_MS) + 1;
                return (
                  <Pressable
                    key={period.start}
                    disabled={!canEdit}
                    onLongPress={() =>
                      showDialog(t('cycle.supprimerTitre'), t('cycle.supprimerAide'), [
                        { label: t('commun.supprimer'), style: 'danger', onPress: () => change(() => deletePeriod(period.start)) },
                        { label: t('commun.annuler'), style: 'cancel' },
                      ])
                    }
                    style={[styles.row, index > 0 && styles.rowBorder]}
                  >
                    <View style={styles.rowIcon}>
                      <Droplet size={18} color={fixed.cycle.period} strokeWidth={1.8} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{format(period.start, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                      <Text style={styles.rowDate}>{period.end === null ? t('cycle.enCours') : t('cycle.nJours', { n: days })}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {canEdit && <Text style={styles.note}>{t('cycle.supprimerIndice')}</Text>}
            <View style={[styles.list, styles.stats]}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{summary.cycleLength}</Text>
                <Text style={styles.statLabel}>{t('cycle.statCycle')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{summary.periodLength}</Text>
                <Text style={styles.statLabel}>{t('cycle.statRegles')}</Text>
              </View>
            </View>
          </>
        )}

        {canEdit && (
          <>
            <Text style={styles.section}>{t('cycle.reglages')}</Text>
            <View style={styles.list}>
              <Stepper first label={t('cycle.reglageCycle')} value={data.cycleLength} min={MIN_CYCLE} max={MAX_CYCLE} onChange={(value) => change(() => setCycleSettings(value, data.periodLength))} />
              <Stepper first={false} label={t('cycle.reglageRegles')} value={data.periodLength} min={1} max={10} onChange={(value) => change(() => setCycleSettings(data.cycleLength, value))} />
            </View>
            <Text style={styles.note}>{t('cycle.moyennesAide')}</Text>
          </>
        )}
        <Text style={styles.footer}>{t('cycle.prive')}</Text>
      </ScrollView>

      {sheet === 'start' && <DaySheet title={t('cycle.debutTitre')} initial={now} onClose={() => setSheet(null)} onSave={(day) => change(() => startPeriod(day, 'me'))} />}
      {sheet === 'end' && <DaySheet title={t('cycle.finTitre')} initial={now} onClose={() => setSheet(null)} onSave={(day) => change(() => endPeriod(day))} />}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: fixed.lilac },
  scroll: { paddingBottom: 40 },
  hero: { marginTop: 6, marginHorizontal: 12, paddingVertical: 22, paddingHorizontal: 20, borderRadius: 28, backgroundColor: colors.surface, gap: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ring: { width: RING, height: RING },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringNumber: { fontSize: 40, fontWeight: '700', letterSpacing: -1.2, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 44 },
  ringUnit: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  heroText: { flex: 1, gap: 6 },
  cap: { fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.72, textTransform: 'uppercase' },
  headline: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  subline: { fontSize: 13, lineHeight: 18, color: fixed.mutedLight },
  actions: { gap: 10 },
  ownerLink: { alignSelf: 'center', paddingVertical: 6 },
  ownerLinkText: { fontSize: 14, fontWeight: '500', color: fixed.lilac },
  section: { paddingTop: 22, paddingHorizontal: 28, paddingBottom: 8, fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.72, textTransform: 'uppercase' },
  list: { marginHorizontal: 12, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden' },
  calendarBox: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 14 },
  note: { paddingTop: 8, paddingHorizontal: 28, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  pains: { flexDirection: 'row', gap: 6, padding: 8 },
  pain: { flex: 1, alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 12, borderRadius: 16 },
  painSelected: { backgroundColor: colors.signature },
  painLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  painLabelSelected: { color: colors.onSignature },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 21 },
  bar: { width: 5, borderRadius: 2.5, backgroundColor: fixed.ringTrack },
  barOn: { backgroundColor: fixed.cycle.period },
  barOnSelected: { backgroundColor: fixed.cycle.period },
  calendar: { gap: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: colors.textMuted, paddingVertical: 4, textTransform: 'uppercase' },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: fixed.transparent },
  dayPeriod: { backgroundColor: fixed.cycle.period },
  dayPeriodPredicted: { borderWidth: 1.5, borderColor: fixed.cycle.period, backgroundColor: fixed.cycle.periodSoft },
  dayFertile: { backgroundColor: fixed.cycle.fertile },
  dayOvulation: { backgroundColor: fixed.cycle.ovulation },
  dayOvulationPredicted: { borderWidth: 1.5, borderColor: fixed.cycle.ovulation, backgroundColor: fixed.cycle.fertile },
  dayText: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  dayTextOn: { color: fixed.cycle.onPeriod, fontWeight: '700' },
  dayTextToday: { fontWeight: '700' },
  dayTextPast: { color: colors.textMuted },
  todayMark: { position: 'absolute', bottom: 2, width: 12, height: 2, borderRadius: 1, backgroundColor: colors.text },
  painMark: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: fixed.cycle.period },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, paddingTop: 8, paddingHorizontal: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: 12, color: fixed.mutedLight },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: fixed.thumbFace, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowTitleFlex: { flex: 1, fontSize: 15, color: colors.text },
  rowDate: { fontSize: 13, color: colors.textMuted },
  stepperValue: { minWidth: 56, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  stats: { marginTop: 10, flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  footer: { fontSize: 12, lineHeight: 17, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 28, paddingTop: 24 },
  sheetBody: { gap: 16, paddingTop: 12 },
}));
