import { BatteryLow, CloudRain, Flame, Heart, Leaf, Sparkles, Sun, Thermometer, Zap, type LucideIcon } from 'lucide-react-native';

import type { MoodId } from '../couple/mood';

// Nébula : chaque humeur a son icône au trait, du même jeu que le reste de l'app (pas d'émoji).
const ICONS: Record<MoodId, LucideIcon> = {
  radieuse: Sparkles,
  bien: Sun,
  calme: Leaf,
  fatiguee: BatteryLow,
  triste: CloudRain,
  stressee: Zap,
  enervee: Flame,
  malade: Thermometer,
  amoureuse: Heart,
};

export function MoodIcon({ mood, size, color }: { mood: MoodId; size: number; color: string }) {
  const Icon = ICONS[mood];
  return <Icon size={size} color={color} strokeWidth={1.8} />;
}
