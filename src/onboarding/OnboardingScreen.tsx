import { useCallback, useEffect, useState } from 'react';
import Reanimated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { AppState, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BatteryCharging, Bell, Camera, Download, ImageIcon, LucideIcon, MapPin } from 'lucide-react-native';

import { chat } from '../chat/manager';
import { LINK_NAME_LENGTH } from '../crypto/pairing';
import { collectDiagnostics, needsManufacturerAdvice, openPowerManagerSettings } from '../diagnostics';
import { Avatar, IconButton, useInsets, useNavigationBarHeight } from '../components/ui';
import { t } from '../i18n';
import { log } from '../log';
import { createStyles, fixed, radius, spacing, useColors } from '../theme';
import { checkPermissions, ONBOARDING_PERMISSIONS, PermissionId, PermissionState, requestPermission } from './permissions';
import { PermissionCard } from './PermissionCard';
import { Lily } from '../components/Lily';
import { Backdrop, GrainButton } from '../components/nebula';
import { BackupSheet } from '../components/BackupSheet';
import { MediaPicker } from '../components/MediaPicker';
import { ProfilePhotoCropper } from '../components/ProfilePhotoCropper';
import { saveOnboardingStep } from './progress';

export type OnboardingStep = 0 | 1 | 2 | 3;

// Planche « Elvira · Bienvenue et liaison », pour Nébula : bienvenue (le lys qui s'ouvre), autorisations,
// profil, puis « Une seule personne » (le QR code qui se dessine) avant de lier les deux téléphones.
// Fond Améthyste à grain, points de progression en haut, boutons Grain et Fumé.
const STEP_MS = 320;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const STEPS: OnboardingStep[] = [0, 1, 2, 3];

const ICONS: Record<PermissionId, LucideIcon> = {
  notifications: Bell,
  battery: BatteryCharging,
  camera: Camera,
  media: ImageIcon,
  location: MapPin,
  install: Download,
  fullScreen: Download,
};
// Les apps inconnues (mises à jour de Nébula) : carte en plus, seulement s'il manque l'autorisation.
const CHECKED: PermissionId[] = [...ONBOARDING_PERMISSIONS, 'install'];

// Le QR code dessiné de la planche (7 × 7), case par case.
const QR = '1110111' + '0101011' + '1110101' + '1100000' + '0000101' + '1011101' + '1101011';

type Props = {
  // full : nouveau téléphone ; permissions : utilisateur existant à qui il manque une autorisation.
  mode: 'full' | 'permissions';
  initialStep: OnboardingStep;
  onDone: () => void;
};

// Un point de progression : l'étape en cours s'allonge en lilas, les étapes faites restent claires.
function Dot({ index, step }: { index: number; step: number }) {
  const styles = useStyles();
  const colors = useColors();
  const state = useSharedValue(index === step ? 1 : 0);
  useEffect(() => {
    state.set(withTiming(index === step ? 1 : 0, { duration: 260, easing: EASE }));
  }, [index, step, state]);
  const style = useAnimatedStyle(() => ({ width: 12 + 16 * state.get() }));
  const color = index === step ? fixed.lilac : index < step ? colors.text : fixed.thumbTrack;
  return <Reanimated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

// Accueil : le lys arrive en fondu, grandit un peu, puis s'ouvre.
function WelcomeLily() {
  const colors = useColors();
  const open = useSharedValue(0);
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.set(withTiming(1, { duration: 700, easing: EASE }));
    open.set(withDelay(500, withTiming(1, { duration: 900, easing: EASE })));
  }, [appear, open]);
  const style = useAnimatedStyle(() => ({ opacity: appear.get(), transform: [{ scale: 0.9 + 0.1 * appear.get() }] }));
  return (
    <Reanimated.View style={style}>
      <Lily size={150} color={colors.text} open={open} />
    </Reanimated.View>
  );
}

// « Une seule personne » : le QR code se remplit case par case, les coins de visée apparaissent et la
// ligne de lecture passe et repasse.
function ScanArt() {
  const styles = useStyles();
  const line = useSharedValue(0);
  useEffect(() => {
    line.set(withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1, false));
  }, [line]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 150 * line.get() }] }));
  return (
    <View style={styles.qr}>
      <View style={styles.qrGrid}>
        {QR.split('').map((cell, index) => (
          <Reanimated.View key={index} entering={FadeIn.duration(300).delay(index * 12)} style={[styles.qrCell, cell === '1' && styles.qrOn]} />
        ))}
      </View>
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner, index) => (
        <Reanimated.View key={corner} entering={FadeIn.duration(400).delay(index * 80)} style={[styles.corner, styles[corner]]} />
      ))}
      <Reanimated.View style={[styles.scanLine, lineStyle]} />
    </View>
  );
}

export function OnboardingScreen({ mode, initialStep, onDone }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const { top } = useInsets();
  const bottom = useNavigationBarHeight();
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const content = useSharedValue(0);
  const finishing = useSharedValue(0);
  const [states, setStates] = useState<Partial<Record<PermissionId, PermissionState>> | null>(null);
  // La carte « apps inconnues » reste affichée une fois apparue, même accordée (sa coche se dessine).
  const [showInstall, setShowInstall] = useState(false);
  const [manufacturerAdvice, setManufacturerAdvice] = useState<{ brand: string; settings: boolean } | null>(null);
  const saved = chat.getMyProfile();
  const [name, setName] = useState(saved.name ?? '');
  const [restoring, setRestoring] = useState(false);
  const [photo, setPhoto] = useState(saved.photo);

  const refresh = useCallback(() => {
    checkPermissions(CHECKED)
      .then((next) => {
        setStates(next);
        if (next.install !== 'granted') setShowInstall(true);
      })
      .catch((e) => log.warn('autorisations', e));
  }, []);

  useEffect(() => {
    refresh();
    collectDiagnostics()
      .then((data) => (data.powerManager || needsManufacturerAdvice(data.manufacturer) ? setManufacturerAdvice({ brand: data.manufacturer, settings: data.powerManager }) : null))
      .catch((e) => log.warn('diagnostic', e));
    // Batterie, apps inconnues et accès refusés pour de bon passent par les réglages d'Android : on
    // relit l'état réel de chaque autorisation au retour dans l'app.
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => subscription.remove();
  }, [refresh]);

  // Chaque étape glisse depuis la droite en fondu (planche : 320 ms).
  useEffect(() => {
    content.set(0);
    content.set(withTiming(1, { duration: STEP_MS, easing: EASE }));
    if (mode === 'full') saveOnboardingStep(step);
  }, [step, mode, content]);

  const goTo = useCallback(
    (next: OnboardingStep) => {
      const go = () => setStep(next);
      content.set(
        withTiming(0, { duration: STEP_MS / 2, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(go);
        }),
      );
    },
    [content],
  );

  // Retour Android : étape précédente ; à la première étape, Android garde la main (quitter).
  const first: OnboardingStep = mode === 'full' ? 0 : 1;
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step <= first) return false;
      goTo((step - 1) as OnboardingStep);
      return true;
    });
    return () => subscription.remove();
  }, [step, first, goTo]);

  const cards = showInstall ? CHECKED : ONBOARDING_PERMISSIONS;
  // Rien n'est obligatoire : le bouton du bas dit seulement « Plus tard » tant qu'il en manque.
  const allGranted = states !== null && cards.every((id) => states[id] === 'granted');

  const ask = async (id: PermissionId) => {
    if (!states) return;
    try {
      const next = await requestPermission(id, states[id] ?? 'missing');
      setStates((current) => ({ ...current, [id]: next }));
    } catch (e) {
      log.warn('autorisation', e);
    }
  };

  // La galerie, une seule photo : elle est réduite à l'enregistrement (saveProfile).
  const [galleryOpen, setGalleryOpen] = useState(false);
  // La photo choisie passe d'abord par le recadrage en carré, avant d'être gardée.
  const [cropping, setCropping] = useState<string | null>(null);

  const saveProfile = async () => {
    try {
      await chat.saveProfile(name.trim(), photo);
      goTo(3);
    } catch (e) {
      log.warn('profil', e);
    }
  };

  // L'écran s'efface et l'app s'ouvre (sans contact, sur la feuille QR code).
  const finish = () => {
    finishing.set(
      withTiming(1, { duration: STEP_MS * 1.5, easing: EASE }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  };

  const afterPermissions = () => (mode === 'full' ? goTo(2) : finish());

  const screenStyle = useAnimatedStyle(() => ({ opacity: 1 - finishing.get() }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.get(), transform: [{ translateX: 24 * (1 - content.get()) }] }));
  const visible = mode === 'full' ? STEPS : STEPS.slice(1, 2);

  return (
    <Reanimated.View style={[styles.screen, screenStyle]}>
      <Backdrop kind="amethyste" />
      <View style={[styles.dots, { marginTop: top + 16 }]} accessibilityLabel={t('priseEnMain.etape', { n: step + 1, total: visible.length })}>
        {visible.map((index) => (
          <Dot key={index} index={index} step={step} />
        ))}
      </View>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Reanimated.View style={[styles.flex, contentStyle]}>
            {step === 0 && (
              <View style={styles.block}>
                <View style={styles.center}>
                  <WelcomeLily />
                  <Reanimated.View entering={FadeIn.duration(400).delay(1200)} style={styles.centerText}>
                    <Text style={styles.brand}>{t('priseEnMain.bienvenue')}</Text>
                    <Text style={styles.lead}>{t('priseEnMain.presentation')}</Text>
                  </Reanimated.View>
                </View>
                <GrainButton label={t('priseEnMain.commencer')} onPress={() => goTo(1)} />
                <GrainButton label={t('sauvegarde.restaurer')} variant="smoke" onPress={() => setRestoring(true)} />
              </View>
            )}
            {step === 1 && (
              <View style={styles.block}>
                <Text style={styles.title}>{t('priseEnMain.autorisations')}</Text>
                <Text style={styles.text}>{t('priseEnMain.autorisationsAide')}</Text>
                <View style={styles.rows}>
                  {states &&
                    cards.map((id, index) => (
                      <PermissionCard
                        key={id}
                        index={index}
                        icon={ICONS[id]}
                        title={t(`priseEnMain.${id}`)}
                        why={t(`priseEnMain.${id}Aide`)}
                        state={states[id] ?? 'missing'}
                        onPress={() => ask(id)}
                        later
                      />
                    ))}
                </View>
                {manufacturerAdvice && (
                  <Pressable
                    onPress={() => (manufacturerAdvice.settings ? openPowerManagerSettings() : null)}
                    style={({ pressed }) => [styles.advice, pressed && manufacturerAdvice.settings && styles.pressed]}
                  >
                    <Text style={styles.adviceTitle}>{t('diag.constructeur', { marque: manufacturerAdvice.brand })}</Text>
                    <Text style={styles.rowText}>{t('diag.constructeurAide')}</Text>
                  </Pressable>
                )}
                <View style={styles.spacer} />
                {/* Le bouton passe de Fumé (« Plus tard ») à Grain quand tout est accordé. */}
                <Reanimated.View key={allGranted ? 'continuer' : 'plusTard'} entering={FadeIn.duration(220)}>
                  <GrainButton label={allGranted ? t('priseEnMain.continuer') : t('priseEnMain.plusTard')} variant={allGranted ? 'grain' : 'smoke'} onPress={afterPermissions} />
                </Reanimated.View>
              </View>
            )}
            {step === 2 && (
              <View style={styles.block}>
                <Text style={styles.title}>{t('priseEnMain.profil')}</Text>
                <Text style={styles.text}>{t('priseEnMain.profilAide')}</Text>
                <IconButton onPress={() => setGalleryOpen(true)} label={t('profil.choisirPhoto')} hitSlop={0} style={styles.photo}>
                  <Avatar uri={photo} size={104} />
                  <View style={styles.photoBadge}>
                    <Camera size={18} color={fixed.onGrainButton} strokeWidth={1.75} />
                  </View>
                </IconButton>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('profil.commentPresenter')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={LINK_NAME_LENGTH}
                />
                <View style={styles.spacer} />
                <GrainButton label={t('priseEnMain.suivant')} disabled={!name.trim()} onPress={saveProfile} />
              </View>
            )}
            {step === 3 && (
              <View style={styles.block}>
                <View style={styles.center}>
                  <ScanArt />
                  <View style={styles.centerText}>
                    <Text style={styles.title}>{t('priseEnMain.uneSeule')}</Text>
                    <Text style={styles.lead}>{t('priseEnMain.uneSeuleAide')}</Text>
                  </View>
                </View>
                <GrainButton label={t('priseEnMain.lier')} onPress={finish} />
              </View>
            )}
          </Reanimated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {restoring && <BackupSheet mode="import" onClose={() => setRestoring(false)} />}
      {galleryOpen && (
        <MediaPicker
          single
          onPick={([picked]) => {
            setGalleryOpen(false);
            if (picked) setCropping(picked.uri);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}
      {cropping && <ProfilePhotoCropper uri={cropping} onDone={(uri) => setPhoto(uri)} onClose={() => setCropping(null)} />}
    </Reanimated.View>
  );
}

const CORNER = 28;
const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  flex: { flex: 1 },
  dots: { flexDirection: 'row', gap: 6, paddingHorizontal: 28 },
  dot: { height: 4, borderRadius: 2 },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 24 },
  block: { flex: 1, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingVertical: 24 },
  centerText: { alignItems: 'center', gap: 10 },
  brand: { fontSize: 32, fontWeight: '700', letterSpacing: -1, color: colors.text, textAlign: 'center' },
  lead: { fontSize: 16, lineHeight: 24, color: fixed.cardTextSoft, textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, color: colors.text, textAlign: 'center' },
  text: { fontSize: 15, lineHeight: 23, color: fixed.cardTextSoft },
  spacer: { flex: 1, minHeight: spacing.lg },
  rows: { gap: 10 },
  rowText: { fontSize: 13, color: colors.textMuted },
  advice: { padding: spacing.md, borderRadius: 16, backgroundColor: fixed.card, gap: 2 },
  adviceTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  photo: { alignSelf: 'center', marginTop: 8 },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: fixed.grainButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { height: 52, borderRadius: 16, backgroundColor: fixed.card, paddingHorizontal: spacing.md, fontSize: 16, color: colors.text },
  pressed: { opacity: 0.6 },
  qr: { width: 190, height: 190, borderRadius: 28, backgroundColor: fixed.card, overflow: 'hidden' },
  qrGrid: { position: 'absolute', top: 28, left: 28, right: 28, bottom: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  qrCell: { width: '12.2%', aspectRatio: 1, borderRadius: 3 },
  qrOn: { backgroundColor: colors.text },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: fixed.lilac },
  tl: { left: 14, top: 14, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 8 },
  tr: { right: 14, top: 14, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 8 },
  bl: { left: 14, bottom: 14, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 8 },
  br: { right: 14, bottom: 14, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 8 },
  scanLine: { position: 'absolute', left: 20, right: 20, top: 20, height: 2, backgroundColor: fixed.lilac },
}));
