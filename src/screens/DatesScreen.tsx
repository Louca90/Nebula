import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Reanimated, { useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { randombytes_buf, to_base64 } from 'react-native-libsodium';

import { chat } from '../chat/manager';
import { CoupleDate, CoupleDates, daysUntil, MAX_DATES, MAX_TITLE, nextOccurrence, saveDates, useDates } from '../couple/dates';
import { haptics } from '../haptics';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { IconButton, useInsets } from '../components/ui';
import { GrainButton } from '../components/nebula';
import { dateLocale, t } from '../i18n';
import { enterUp, timing } from '../motion';
import { Contact } from '../storage';
import { createStyles, fixed, useColors } from '../theme';

// Planche « Nos dates et compte à rebours ». Tout change des deux côtés : chaque modification part
// chez l'autre téléphone (la plus récente gagne).
type Props = { partner: Contact | null; onBack: () => void };

const RING = 132;
const RING_R = 58;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;
// L'arc se remplit à l'approche : plein le jour même, presque vide à deux mois.
const RING_SPAN_DAYS = 60;
const HOUR = 3600 * 1000;
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

function format(at: number, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(dateLocale(), options).format(at);
}

function startOfDay(at: number) {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

// Un petit calendrier : le mois, ses flèches, et le jour choisi en lilas.
function MonthPicker({ value, onChange }: { value: number; onChange: (at: number) => void }) {
  const styles = useStyles();
  const colors = useColors();
  const [month, setMonth] = useState(() => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  });
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [...Array.from({ length: offset }, () => null), ...Array.from({ length }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1).getTime())];
  const weekdays = Array.from({ length: 7 }, (_, index) => format(new Date(2024, 0, 1 + index).getTime(), { weekday: 'narrow' }));
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
        {cells.map((at, index) =>
          at === null ? (
            <View key={`e${index}`} style={styles.cell} />
          ) : (
            <Pressable key={at} onPress={() => onChange(at)} accessibilityRole="button" accessibilityLabel={format(at, { day: 'numeric', month: 'long', year: 'numeric' })} style={styles.cell}>
              {/* Jamais fusionnée par React Native (sinon le rond du jour choisi sortait carré). */}
              <View collapsable={false} style={[styles.day, startOfDay(value) === at && styles.daySelected]}>
                <Text style={[styles.dayText, startOfDay(value) === at && styles.dayTextSelected]}>{new Date(at).getDate()}</Text>
              </View>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

// La feuille : soit la prochaine fois (juste le jour), soit une date à ne pas oublier (nom, jour, chaque année).
function DateSheet({ initial, mode, onClose, onSave }: { initial: CoupleDate | null; mode: 'next' | 'date'; onClose: () => void; onSave: (date: CoupleDate) => void }) {
  const styles = useStyles();
  const colors = useColors();
  const [at, setAt] = useState(initial?.at ?? startOfDay(Date.now()));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [yearly, setYearly] = useState(initial?.yearly ?? true);
  const ready = mode === 'next' || title.trim().length > 0;
  return (
    <Sheet title={mode === 'next' ? t('dates.prochaineFois') : initial ? initial.title : t('dates.nouvelle')} onClose={onClose} keyboard>
      {(close) => (
        <View style={styles.sheetBody}>
          {mode === 'date' && (
            <TextInput
              value={title}
              onChangeText={(text) => setTitle(text.slice(0, MAX_TITLE))}
              placeholder={t('dates.nom')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus={!initial}
            />
          )}
          <MonthPicker value={at} onChange={setAt} />
          {mode === 'date' && (
            <View style={styles.yearlyRow}>
              <Text style={styles.yearlyLabel}>{t('dates.chaqueAnnee')}</Text>
              <Toggle value={yearly} onChange={setYearly} label={t('dates.chaqueAnnee')} />
            </View>
          )}
          <GrainButton
            label={t('dates.enregistrer')}
            disabled={!ready}
            onPress={() => close(() => onSave({ id: initial?.id ?? to_base64(randombytes_buf(9)), title: title.trim(), at, yearly }))}
          />
        </View>
      )}
    </Sheet>
  );
}

function DateRow({ date, open, now, first, onToggle, onEdit, onDelete }: { date: CoupleDate; open: boolean; now: number; first: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const next = nextOccurrence(date, now);
  const days = daysUntil(next, now);
  const past = !date.yearly && next < startOfDay(now);
  const when = past ? t('dates.passee') : days === 0 ? t('dates.aujourdhuiCourt') : t('dates.dansJ', { n: days });
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.set(timing(open ? 1 : 0, 300));
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));
  const panel = useAnimatedStyle(() => ({ height: turn.get() * 48, opacity: turn.get() }));
  return (
    <View style={!first && styles.rowBorder}>
      <Pressable onPress={onToggle} style={styles.row} accessibilityRole="button" accessibilityLabel={date.title}>
        <View style={styles.rowIcon}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={fixed.lilac} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            <Path d="M16 2v4M8 2v4M3 10h18" />
          </Svg>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {date.title}
          </Text>
          <Text style={styles.rowDate}>{format(date.at, { day: 'numeric', month: 'long', ...(date.yearly ? {} : { year: 'numeric' }) })}</Text>
        </View>
        <Text style={styles.rowWhen}>{when}</Text>
        <Reanimated.View style={chevron}>
          <ChevronDown size={16} color={colors.textMuted} strokeWidth={2} />
        </Reanimated.View>
      </Pressable>
      <Reanimated.View style={[styles.panel, panel]}>
        <Pressable onPress={onEdit} style={styles.chip}>
          <Text style={styles.chipText}>{t('dates.changer')}</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={[styles.chip, styles.chipDanger]}>
          <Text style={[styles.chipText, styles.chipDangerText]}>{t('dates.supprimer')}</Text>
        </Pressable>
      </Reanimated.View>
    </View>
  );
}

export function DatesScreen({ partner, onBack }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const { top } = useInsets();
  const data = useDates();
  const [now] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ mode: 'next' | 'date'; date: CoupleDate | null } | null>(null);

  const update = (change: (current: CoupleDates) => Omit<CoupleDates, 'updatedAt'>) => {
    saveDates({ ...change(data), updatedAt: Date.now() });
    if (partner) chat.shareDates(partner.publicKey);
    haptics.success();
  };

  const next = data.next !== null && data.next >= startOfDay(now) ? data.next : null;
  const days = next !== null ? daysUntil(next, now) : null;
  const hours = next !== null ? Math.max(0, Math.floor(((next - now) % (24 * HOUR)) / HOUR)) : 0;
  const sorted = useMemo(() => [...data.dates].sort((a, b) => nextOccurrence(a, now) - nextOccurrence(b, now)), [data.dates, now]);

  const fill = useSharedValue(0);
  useEffect(() => {
    const target = days === null ? 0 : Math.max(0.06, 1 - days / RING_SPAN_DAYS);
    fill.set(timing(target, 1400));
  }, [days, fill]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - fill.get()) }));

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <View style={styles.header}>
        <IconButton onPress={onBack} label={t('commun.retour')}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
        </IconButton>
        <Text style={styles.title}>{t('dates.titre')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Reanimated.View entering={enterUp(10, 300)} style={styles.countdown}>
          <View style={styles.ring}>
            <Svg width={RING} height={RING} viewBox="0 0 132 132" style={styles.ringSvg}>
              <Circle cx={66} cy={66} r={RING_R} fill="none" stroke={fixed.ringTrack} strokeWidth={8} />
              <AnimatedCircle cx={66} cy={66} r={RING_R} fill="none" stroke={fixed.lilac} strokeWidth={8} strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} animatedProps={arc} />
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
              <Text style={styles.ringNumber}>{days ?? '–'}</Text>
              <Text style={styles.ringUnit}>{days === 1 ? t('dates.jour') : t('dates.jours')}</Text>
            </View>
          </View>
          <View style={styles.countText}>
            <Text style={styles.cap}>{t('dates.prochaineFois')}</Text>
            <Text style={styles.nextDate}>{next !== null ? format(next, { weekday: 'long', day: 'numeric', month: 'short' }) : t('dates.aucune')}</Text>
            {next !== null && <Text style={styles.remaining}>{days === 0 ? t('dates.aujourdhui') : t('dates.restant', { j: days ?? 0, h: String(hours).padStart(2, '0') })}</Text>}
            <Pressable onPress={() => setEditing({ mode: 'next', date: next !== null ? { id: 'next', title: '', at: next, yearly: false } : null })} style={styles.change}>
              <Text style={styles.changeText}>{next !== null ? t('dates.changer') : t('dates.choisir')}</Text>
            </Pressable>
          </View>
        </Reanimated.View>

        <Text style={styles.section}>{t('dates.aNePasOublier')}</Text>
        <View style={styles.list}>
          {sorted.length === 0 && <Text style={styles.empty}>{t('dates.vide')}</Text>}
          {sorted.map((date, index) => (
            <DateRow
              key={date.id}
              date={date}
              now={now}
              first={index === 0}
              open={openId === date.id}
              onToggle={() => setOpenId(openId === date.id ? null : date.id)}
              onEdit={() => setEditing({ mode: 'date', date })}
              onDelete={() => update((current) => ({ next: current.next, dates: current.dates.filter((item) => item.id !== date.id) }))}
            />
          ))}
        </View>
        {data.dates.length < MAX_DATES && <GrainButton variant="smoke" label={t('dates.ajouter')} onPress={() => setEditing({ mode: 'date', date: null })} style={styles.add} />}
      </ScrollView>
      {editing && (
        <DateSheet
          mode={editing.mode}
          initial={editing.date}
          onClose={() => setEditing(null)}
          onSave={(date) =>
            update((current) =>
              editing.mode === 'next'
                ? { next: date.at, dates: current.dates }
                : { next: current.next, dates: current.dates.some((item) => item.id === date.id) ? current.dates.map((item) => (item.id === date.id ? date : item)) : [...current.dates, date] },
            )
          }
        />
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text },
  scroll: { paddingBottom: 40 },
  countdown: { marginTop: 6, marginHorizontal: 12, paddingVertical: 22, paddingHorizontal: 20, borderRadius: 28, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 20 },
  ring: { width: RING, height: RING },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringNumber: { fontSize: 40, fontWeight: '700', letterSpacing: -1.2, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 44 },
  ringUnit: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  countText: { flex: 1, gap: 6 },
  cap: { fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.72, textTransform: 'uppercase' },
  nextDate: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  remaining: { fontSize: 13, color: fixed.mutedLight, fontVariant: ['tabular-nums'] },
  change: { alignSelf: 'flex-start', marginTop: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.signature, justifyContent: 'center' },
  changeText: { fontSize: 13, fontWeight: '600', color: colors.onSignature },
  section: { paddingTop: 22, paddingHorizontal: 28, paddingBottom: 8, fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.72, textTransform: 'uppercase' },
  list: { marginHorizontal: 12, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden' },
  empty: { padding: 16, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: fixed.thumbFace, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowDate: { fontSize: 13, color: colors.textMuted },
  rowWhen: { fontSize: 13, fontWeight: '600', color: fixed.lilac, fontVariant: ['tabular-nums'] },
  panel: { overflow: 'hidden', flexDirection: 'row', gap: 8, paddingLeft: 70, paddingRight: 16 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.signature, justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.onSignature },
  chipDanger: { backgroundColor: colors.dangerSoft },
  chipDangerText: { color: colors.danger },
  add: { marginTop: 14, marginHorizontal: 12 },
  sheetBody: { gap: 16, paddingTop: 12 },
  input: { height: 50, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  calendar: { gap: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: colors.textMuted, paddingVertical: 4, textTransform: 'uppercase' },
  cell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: fixed.transparent },
  daySelected: { backgroundColor: fixed.lilac },
  dayText: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  dayTextSelected: { color: colors.background, fontWeight: '700' },
  yearlyRow: { flexDirection: 'row', alignItems: 'center' },
  yearlyLabel: { flex: 1, fontSize: 15, color: colors.text },
}));

