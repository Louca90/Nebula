import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { enterUp } from '../motion';

import { createStyles, fixed, motion, spacing, useColors } from '../theme';
import { GrainButton } from './nebula';
import { LilyMark } from './Lily';

// Une liste vide : le lys, une phrase et, si on le donne, un titre et une action claire, en fondu.
// compact : dans une carte ou une feuille (lys plus petit, moins de marge).
export function EmptyState({ label, title, action, onAction, compact }: { label: string; title?: string; action?: string; onAction?: () => void; compact?: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Reanimated.View entering={enterUp(8, motion.small)} style={[styles.empty, compact && styles.compact]}>
      <LilyMark height={compact ? 40 : 56} color={fixed.lilac} />
      {!!title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.label}>{label}</Text>
      {!!action && onAction && <GrainButton label={action} variant="smoke" onPress={onAction} style={styles.action} />}
    </Reanimated.View>
  );
}

const useStyles = createStyles((colors) => ({
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg * 2,
  },
  compact: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
}));
