import { Children, Fragment, isValidElement, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';

import { createStyles, fixed, spacing, useColors } from '../theme';

// Un groupe de réglages, comme la planche « Réglages » : un petit titre en capitales, puis une carte
// #161618 aux coins de 18, lignes de 52 points séparées par un filet #222226 sur toute la largeur, icône
// lilas dans un rond sombre (planche « Nos dates »). Sert au Profil et à toutes les pages de réglages.
export function SettingsGroup({ title, children, before }: { title: string; children?: ReactNode; before?: ReactNode }) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {before}
      {rows.length > 0 && (
        <View style={styles.card}>
          {rows.map((row, index) => (
            <Fragment key={row.key ?? index}>
              {index > 0 && <View style={styles.separator} />}
              {row}
            </Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

type RowProps = {
  icon: LucideIcon;
  label: string;
  // Sous le libellé (explication, version…).
  detail?: string | null;
  // À droite, en gris (valeur choisie).
  value?: string | null;
  onPress?: () => void;
  // Par défaut, une ligne qui ouvre quelque chose a une flèche.
  chevron?: boolean;
  // À droite, à la place de la flèche (interrupteur).
  right?: ReactNode;
};

export function SettingRow({ icon: Icon, label, detail, value, onPress, chevron = !!onPress, right }: RowProps) {
  const colors = useColors();
  const styles = useStyles();
  const content = (
    <>
      <View style={styles.icon}>
        <Icon size={18} color={fixed.lilac} strokeWidth={1.8} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {!!detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
      {!!value && <Text style={styles.value}>{value}</Text>}
      {right}
      {chevron && <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  group: {
    gap: spacing.sm,
  },
  title: {
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  card: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  pressed: {
    backgroundColor: colors.elevatedActive,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: fixed.thumbFace,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    color: colors.text,
  },
  detail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  value: {
    fontSize: 14,
    color: colors.textMuted,
  },
}));
