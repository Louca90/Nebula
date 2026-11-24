import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react-native';

import { chat } from '../chat/manager';
import { getContactProfile } from '../chat/database';
import { cycleStats, cycleSummary, CycleData, deletePeriod, endPeriod, PainLevel, setCycleSettings, setPain, startPeriod, useCycle } from '../couple/cycle';
import { DAY_MS, dayInfo, dayKey, dayStart, MAX_CYCLE, MIN_CYCLE, Phase, sortedPeriods } from '../couple/cycleMath';
import { painLabel } from '../couple/cycleNotifications';
import { haptics } from '../haptics';
import { showDialog } from '../components/dialog';
import { Sheet } from '../components/Sheet';
import { IconButton, useInsets } from '../components/ui';
import { GrainButton } from '../components/nebula';
import { dateLocale, t } from '../i18n';
import { enterUp } from '../motion';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';
import { MonthPicker } from './DatesScreen';

// Nébula : le suivi du cycle (carte « Cycle » de l'onglet Nous). Elle note ses règles (même en cours,
// en choisissant le jour où elles ont commencé), leur fin et sa douleur ; le calendrier montre chaque
// phase, notée ou prévue, aussi loin qu'on veut. Lui voit la même chose, sans rien modifier.
type Props = { partner: Contact | null; onBack: () => void };

// Les couleurs des phases : le rose du cœur pour les règles, le lilas des planches pour la fertilité.
export const PHASE_COLORS: Record<Phase, string> = {
  regles: fixed.heart,
  folliculaire: 'rgba(255, 255, 255, 0.06)',
  fertile: 'rgba(185, 163, 227, 0.28)',
  ovulation: fixed.lilac,
  luteale: 'rgba(255, 255, 255, 0.03)',
};
const PAIN_LEVELS: PainLevel[] = [0, 1, 2, 3];
const PAIN_EMOJI = ['🙂', '😕', '😣', '😖'];

function format(at: number, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(dateLocale(), options).format(at);
}

const phaseLabel = (phase: Phase) => t(`cycle.phase_${phase}`);

// Le calendrier du cycle : un mois, ses flèches (sans fin dans les deux sens), chaque jour teinté par sa
// phase. Règles notées : rose plein ; prévues : contour rose. Ovulation : rond lilas ; fertile : lilas pâle.
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
          const filled = period && !info?.predicted;
          const ovulation = info?.phase === 'ovulation';
          return (
            <Pressable
              key={at}
              onPress={() => onDay(at)}
              accessibilityRole="button"
              accessibilityLabel={`${format(at, { day: 'numeric', month: 'long' })}${info ? ` · ${phaseLabel(info.phase)}${info.predicted ? ` (${t('cycle.prevu')})` : ''}` : ''}`}
              style={styles.cell}
            >
              <View
                collapsable={false}
                style={[
                  styles.day,
                  info && !period && !ovulation && { backgroundColor: PHASE_COLORS[info.phase] },
                  filled && styles.dayPeriod,
                  period && info?.predicted && styles.dayPredicted,
                  ovulation && (info?.predicted ? styles.dayOvulationPredicted : styles.dayOvulation),
                  at === today && styles.dayToday,
                ]}
              >
                <Text style={[styles.dayText, (filled || (ovulation && !info?.predicted)) && styles.dayTextOn, at < today && !info && styles.dayTextPast]}>{new Date(at).getDate()}</Text>
              </View>
              {pain !== undefined && pain > 0 && <View style={[styles.painDot, { opacity: 0.4 + pain * 0.2 }]} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        {(
          [
            ['regles', t('cycle.legendeRegles')],
            ['prevues', t('cycle.legendePrevues')],
            ['fertile', t('cycle.phase_fertile')],
            ['ovulation', t('cycle.phase_ovulation')],
          ] as const
        ).map(([kind, label]) => (
          <View key={kind} style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                kind === 'regles' && { backgroundColor: fixed.heart },
                kind === 'prevues' && styles.dayPredicted,
                kind === 'fertile' && { backgroundColor: PHASE_COLORS.fertile },
                kind === 'ovulation' && { backgroundColor: fixed.lilac },
              ]}
            />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
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

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <IconButton onPress={() => value > min && onChange(value - 1)} label={t('cycle.moins')}>
        <Minus size={18} color={colors.text} strokeWidth={1.8} />
      </IconButton>
      <Text style={styles.stepperValue}>{t('cycle.nJours', { n: value })}</Text>
      <IconButton onPress={() => value < max && onChange(value + 1)} label={t('cycle.plus')}>
        <Plus size={18} color={colors.text} strokeWidth={1.8} />
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

  const share = () => {
    if (partner) chat.shareCycle(partner.publicKey);
  };
  const change = (action: () => void) => {
    action();
    share();
    haptics.success();
  };

  const onDay = (day: number) => {
    const dayInfoValue = dayInfo(day, data.periods, summary.cycleLength, summary.periodLength, now);
    const pain = data.pain[dayKey(day)];
    const lines = [
      dayInfoValue ? `${phaseLabel(dayInfoValue.phase)}${dayInfoValue.predicted ? ` (${t('cycle.prevu')})` : ''} · ${t('cycle.jourDuCycle', { n: dayInfoValue.cycleDay })}` : t('cycle.pasDeDonnees'),
      pain !== undefined ? t('cycle.douleurCeJour', { niveau: painLabel(pain) }) : null,
    ].filter(Boolean);
    showDialog(format(day, { weekday: 'long', day: 'numeric', month: 'long' }), lines.join('\n'));
  };

  const headline = summary.current
    ? t('cycle.reglesJour', { n: summary.currentDay ?? 1 })
    : summary.late
      ? t('cycle.enRetard')
      : summary.daysToNext === null
        ? t('cycle.commencer')
        : summary.daysToNext === 0
          ? t('cycle.prevuesAujourdhui')
          : t('cycle.reglesDans', { n: summary.daysToNext });
  const subline = summary.next !== null && !summary.current ? t('cycle.prevuesLe', { jour: format(summary.next, { weekday: 'long', day: 'numeric', month: 'long' }) }) : info ? phaseLabel(info.phase) : canEdit ? t('cycle.introElle') : t('cycle.introLui', { nom: name });

  const history = sortedPeriods(data.periods).reverse().slice(0, 8);

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <View style={styles.header}>
        <IconButton onPress={onBack} label={t('commun.retour')}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
        </IconButton>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('cycle.titre')}</Text>
          <Text style={styles.subtitle}>{data.owner === 'partner' ? t('cycle.sousTitreLui', { nom: name }) : t('cycle.sousTitre')}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Reanimated.View entering={enterUp(8, 260)} style={styles.hero}>
          <View style={[styles.heroDot, { backgroundColor: summary.current ? fixed.heart : info ? PHASE_COLORS[info.phase] : fixed.thumbTrack }]} />
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subline}>{subline}</Text>
          {canEdit && (
            <View style={styles.actions}>
              {summary.current ? (
                <>
                  <GrainButton label={t('cycle.terminees')} onPress={() => change(() => endPeriod(now))} />
                  <Pressable onPress={() => setSheet('end')} hitSlop={8}>
                    <Text style={styles.link}>{t('cycle.termineesUnAutreJour')}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <GrainButton label={t('cycle.ontCommence')} onPress={() => change(() => startPeriod(now, 'me'))} />
                  <Pressable onPress={() => setSheet('start')} hitSlop={8}>
                    <Text style={styles.link}>{t('cycle.ontCommenceUnAutreJour')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </Reanimated.View>

        {(summary.current || summary.painToday !== null) && (
          <Reanimated.View entering={enterUp(8, 260, 40)} style={styles.card}>
            <Text style={styles.cardTitle}>{canEdit ? t('cycle.douleurQuestion') : t('cycle.douleurLui', { nom: name })}</Text>
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
                      style={[styles.pain, selected && styles.painSelected]}
                    >
                      <Text style={styles.painEmoji}>{PAIN_EMOJI[level]}</Text>
                      <Text style={[styles.painLabel, selected && styles.painLabelSelected]}>{painLabel(level)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.painReadOnly}>{summary.painToday !== null ? `${PAIN_EMOJI[summary.painToday]} ${painLabel(summary.painToday)}` : t('cycle.douleurInconnue')}</Text>
            )}
          </Reanimated.View>
        )}

        <Reanimated.View entering={enterUp(8, 260, 80)} style={styles.card}>
          <CycleCalendar data={data} now={now} onDay={onDay} />
        </Reanimated.View>

        {data.periods.length > 0 && (
          <Reanimated.View entering={enterUp(8, 260, 120)} style={styles.card}>
            <Text style={styles.cardTitle}>{t('cycle.moyennes')}</Text>
            <Text style={styles.stat}>{t('cycle.dureeCycle', { n: summary.cycleLength })}</Text>
            <Text style={styles.stat}>{t('cycle.dureeRegles', { n: summary.periodLength })}</Text>
            <Text style={styles.hint}>{t('cycle.moyennesAide')}</Text>
          </Reanimated.View>
        )}

        {canEdit && (
          <Reanimated.View entering={enterUp(8, 260, 160)} style={styles.card}>
            <Text style={styles.cardTitle}>{t('cycle.reglages')}</Text>
            <Stepper label={t('cycle.reglageCycle')} value={data.cycleLength} min={MIN_CYCLE} max={MAX_CYCLE} onChange={(value) => change(() => setCycleSettings(value, data.periodLength))} />
            <Stepper label={t('cycle.reglageRegles')} value={data.periodLength} min={1} max={10} onChange={(value) => change(() => setCycleSettings(data.cycleLength, value))} />
          </Reanimated.View>
        )}

        {history.length > 0 && (
          <Reanimated.View entering={enterUp(8, 260, 200)} style={styles.card}>
            <Text style={styles.cardTitle}>{t('cycle.historique')}</Text>
            {history.map((period, index) => {
              const end = period.end ?? today;
              const days = Math.round((dayStart(end) - period.start) / DAY_MS) + 1;
              return (
                <View key={period.start} style={[styles.historyRow, index > 0 && styles.historyBorder]}>
                  <View style={styles.historyDot} />
                  <View style={styles.flex}>
                    <Text style={styles.historyTitle}>{format(period.start, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                    <Text style={styles.historyText}>{period.end === null ? t('cycle.enCours') : t('cycle.nJours', { n: days })}</Text>
                  </View>
                  {canEdit && (
                    <IconButton
                      onPress={() =>
                        showDialog(t('cycle.supprimerTitre'), t('cycle.supprimerAide'), [
                          { label: t('commun.supprimer'), style: 'danger', onPress: () => change(() => deletePeriod(period.start)) },
                          { label: t('commun.annuler'), style: 'cancel' },
                        ])
                      }
                      label={t('commun.supprimer')}
                    >
                      <Trash2 size={18} color={colors.textMuted} strokeWidth={1.8} />
                    </IconButton>
                  )}
                </View>
              );
            })}
          </Reanimated.View>
        )}
        <Text style={styles.footer}>{t('cycle.prive')}</Text>
      </ScrollView>

      {sheet === 'start' && (
        <DaySheet title={t('cycle.debutTitre')} initial={now} onClose={() => setSheet(null)} onSave={(day) => change(() => startPeriod(day, 'me'))} />
      )}
      {sheet === 'end' && <DaySheet title={t('cycle.finTitre')} initial={now} onClose={() => setSheet(null)} onSave={(day) => change(() => endPeriod(day))} />}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, color: fixed.lilac },
  scroll: { paddingBottom: 40, gap: 10 },
  hero: { marginTop: 6, marginHorizontal: 12, paddingVertical: 24, paddingHorizontal: 20, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', gap: 6 },
  heroDot: { width: 14, height: 14, borderRadius: 7, marginBottom: 6 },
  headline: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, color: colors.text, textAlign: 'center' },
  subline: { fontSize: 14, lineHeight: 20, color: fixed.mutedLight, textAlign: 'center', textTransform: 'none' },
  actions: { alignSelf: 'stretch', marginTop: 14, gap: 12, alignItems: 'center' },
  link: { fontSize: 14, color: fixed.lilac, fontWeight: '500' },
  card: { marginHorizontal: 12, padding: 16, borderRadius: 24, backgroundColor: colors.surface, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  pains: { flexDirection: 'row', gap: 8 },
  pain: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 16, backgroundColor: fixed.thumbFace },
  painSelected: { backgroundColor: fixed.heart },
  painEmoji: { fontSize: 22 },
  painLabel: { fontSize: 12, fontWeight: '600', color: fixed.mutedLight },
  painLabelSelected: { color: fixed.white },
  painReadOnly: { fontSize: 17, color: colors.text },
  calendar: { gap: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: colors.textMuted, paddingVertical: 4, textTransform: 'uppercase' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: fixed.transparent },
  dayPeriod: { backgroundColor: fixed.heart },
  dayPredicted: { borderWidth: 2, borderColor: fixed.heart, borderStyle: 'dashed' },
  dayOvulation: { backgroundColor: fixed.lilac },
  dayOvulationPredicted: { borderWidth: 2, borderColor: fixed.lilac },
  dayToday: { borderWidth: 2, borderColor: colors.text },
  dayText: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  dayTextOn: { color: colors.background, fontWeight: '700' },
  dayTextPast: { color: colors.textMuted },
  painDot: { position: 'absolute', bottom: 1, width: 5, height: 5, borderRadius: 3, backgroundColor: fixed.heart },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: 12, color: fixed.mutedLight },
  stat: { fontSize: 15, color: colors.text },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperLabel: { flex: 1, fontSize: 15, color: colors.text },
  stepperValue: { minWidth: 64, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  historyBorder: { borderTopWidth: 1, borderTopColor: fixed.thumbTrack },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: fixed.heart },
  historyTitle: { fontSize: 15, color: colors.text },
  historyText: { fontSize: 12, color: colors.textMuted },
  footer: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, paddingTop: 6 },
  sheetBody: { gap: 14, paddingBottom: 8 },
}));
