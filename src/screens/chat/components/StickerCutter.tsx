import { ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, findNodeHandle, Image, Modal, PanResponder, PixelRatio, Pressable, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import Svg, { ClipPath, Defs, Image as SvgImage, Path } from 'react-native-svg';
import { RotateCcw, X } from 'lucide-react-native';

import { captureView, cropImage, nativeImageSize } from '../../../../modules/pear-native';
import { addSticker, Sticker } from '../../../chat/stickers';
import { Bounds, captureScale, clampPoint, fitInside, isUsableOutline, outlineBounds, outlinePath } from '../../../chat/stickerShape';
import { addPoint } from '../../../components/editor/drawing';
import { useInsets } from '../../../components/ui';
import { showDialog } from '../../../components/dialog';
import { haptics } from '../../../haptics';
import { t } from '../../../i18n';
import { log } from '../../../log';
import { Backdrop, GrainButton } from '../../../components/nebula';
import { createStyles, fixed, spacing, useColors } from '../../../theme';

// La photo est d'abord remise droite et réduite : ce qu'on découpe est ce qu'on voit.
const WORK_SIZE = 1600;
const WORK_QUALITY = 92;

type Photo = { uri: string; width: number; height: number };

async function prepare(uri: string): Promise<Photo> {
  const straight = new File(Paths.cache, `sticker-source-${Date.now()}.jpg`).uri;
  const source = await cropImage(uri, straight, { x: 0, y: 0, width: 1, height: 1 }, 0, WORK_SIZE, WORK_QUALITY).catch((e) => {
    log.warn('sticker', e);
    return uri;
  });
  const size = source === uri && nativeImageSize ? await nativeImageSize(uri) : await Image.getSize(source);
  return { uri: source, ...size };
}

// Découpe d'un sticker au doigt (lot 4.9) : on entoure ce qu'on veut garder, le reste s'assombrit. Le
// sticker est le contenu du contour, sur fond transparent, enregistré sur ce téléphone.
export function StickerCutter({ sourceUri, onDone, onClose }: { sourceUri: string; onDone: (sticker: Sticker) => void; onClose: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const { top, bottom } = useInsets();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [points, setPoints] = useState<number[]>([]);
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState<Bounds | null>(null);
  const [loaded, setLoaded] = useState(false);
  const capture = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    let cancelled = false;
    prepare(sourceUri)
      .then((ready) => {
        if (!cancelled) setPhoto(ready);
      })
      .catch((e) => {
        showDialog(t('stickers.photoIllisible'), String(e));
        onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [sourceUri]);

  const frame = photo && area ? fitInside(photo, area) : null;

  // Le PanResponder est créé une fois : il relit le cadre et l'état à chaque geste.
  const latest = useRef({ frame, saving });
  latest.current = { frame, saving };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!latest.current.frame && !latest.current.saving,
      onMoveShouldSetPanResponder: () => !!latest.current.frame && !latest.current.saving,
      onPanResponderGrant: (event) => {
        const { frame: current } = latest.current;
        if (!current) return;
        const { locationX, locationY } = event.nativeEvent;
        setClosed(false);
        setPoints(clampPoint(locationX, locationY, current.width, current.height));
      },
      onPanResponderMove: (event) => {
        const { frame: current } = latest.current;
        if (!current) return;
        const [x, y] = clampPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, current.width, current.height);
        setPoints((previous) => addPoint(previous, x, y));
      },
      onPanResponderRelease: () => {
        setClosed(true);
        haptics.select();
      },
      onPanResponderTerminate: () => setClosed(true),
    }),
  ).current.panHandlers;

  const usable = closed && isUsableOutline(points);
  const outline = outlinePath(points);

  // Enregistrement : le contenu du contour est redessiné seul, dans une vue à sa taille, puis capturé
  // en PNG (fond transparent) une fois l'image chargée et dessinée.
  const save = () => {
    const bounds = outlineBounds(points);
    if (!bounds || !usable) return;
    setLoaded(false);
    setSaving(bounds);
  };
  useEffect(() => {
    if (!saving || !loaded) return;
    let cancelled = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const tag = findNodeHandle(capture.current);
        if (cancelled || !tag) return;
        const output = new File(Paths.cache, `sticker-${Date.now()}.png`).uri;
        captureView(tag, output, captureScale(saving, PixelRatio.get()))
          .then((uri) => {
            haptics.success();
            onDone(addSticker(uri));
          })
          .catch((e) => {
            setSaving(null);
            showDialog(t('stickers.echec'), String(e));
          });
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [saving, loaded]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.screen}>
        {/* Nébula : le fond Améthyste à grain des planches, comme les autres pages pleines. */}
        <Backdrop kind="amethyste" />
        <View style={[styles.content, { paddingTop: top + spacing.sm, paddingBottom: bottom + spacing.md }]}>
          <View style={styles.bar}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('commun.fermer')} hitSlop={6} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
              <X size={22} color={colors.text} strokeWidth={1.8} />
            </Pressable>
            <View style={styles.titles}>
              <Text style={styles.title}>{t('stickers.nouveau')}</Text>
              <Text style={styles.hint} numberOfLines={2}>
                {usable ? t('stickers.pret') : t('stickers.entourer')}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setPoints([]);
                setClosed(false);
              }}
              disabled={points.length === 0}
              accessibilityRole="button"
              accessibilityLabel={t('stickers.recommencer')}
              hitSlop={6}
              style={({ pressed }) => [styles.round, points.length === 0 && styles.roundOff, pressed && styles.pressed]}
            >
              <RotateCcw size={20} color={colors.text} strokeWidth={1.8} />
            </Pressable>
          </View>
          <View style={styles.area} onLayout={(event) => setArea({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
            {photo && frame ? (
              <View style={[styles.photo, { left: frame.left, top: frame.top, width: frame.width, height: frame.height }]} {...pan}>
                <Image source={{ uri: photo.uri }} style={{ width: frame.width, height: frame.height }} />
                <Svg pointerEvents="none" width={frame.width} height={frame.height} style={StyleSheet.absoluteFill}>
                  {/* Contour fermé : tout ce qui est dehors s'assombrit (remplissage pair-impair). */}
                  {usable && <Path d={`M0 0H${frame.width}V${frame.height}H0Z ${outline}`} fill={fixed.stickerDim} fillRule="evenodd" />}
                  {points.length >= 4 && (
                    <Path
                      d={closed ? outline : `M${points[0]} ${points[1]} ${points.slice(2).reduce((d, value, index) => d + (index % 2 === 0 ? ` L${value}` : ` ${value}`), '')}`}
                      fill="none"
                      stroke={fixed.lilac}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </Svg>
              </View>
            ) : (
              <ActivityIndicator color={fixed.lilac} />
            )}
            {/* La copie à capturer : seulement le contenu du contour, à la taille de son cadre. Invisible. */}
            {photo && frame && saving && (
              <View ref={capture} collapsable={false} pointerEvents="none" style={[styles.capture, { width: saving.width, height: saving.height }]}>
                <Svg width={saving.width} height={saving.height}>
                  <Defs>
                    <ClipPath id="cut">
                      <Path d={outlinePath(points, -saving.x, -saving.y)} />
                    </ClipPath>
                  </Defs>
                  <SvgImage href={{ uri: photo.uri }} x={-saving.x} y={-saving.y} width={frame.width} height={frame.height} preserveAspectRatio="none" clipPath="url(#cut)" onLoad={() => setLoaded(true)} />
                </Svg>
              </View>
            )}
          </View>
          <GrainButton label={saving ? t('stickers.enCours') : t('stickers.creer')} onPress={save} disabled={!usable || !!saving} style={styles.create} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: fixed.smokeButton,
    borderWidth: 1,
    borderColor: fixed.smokeEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundOff: {
    opacity: 0.4,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  titles: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: fixed.cardTextSoft,
  },
  area: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    position: 'absolute',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: fixed.card,
  },
  capture: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  create: {
    marginHorizontal: 16,
  },
}));
