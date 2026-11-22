import { ComponentType, Ref } from 'react';
import { ViewProps } from 'react-native';
import { requireNativeView } from 'expo';

// Le flou en direct de la barre des onglets de Nébula (Android 12 et plus ; sinon une couleur pleine).
// NebulaBlurTarget enveloppe ce qui passe sous la barre ; NebulaBlurView, posée dans la barre, le rejoue
// flouté puis saturé, voilé, avec un filet intérieur. targetId : le numéro natif de la cible (findNodeHandle).
export type NebulaBlurViewProps = ViewProps & {
  targetId?: number | null;
  // Écart type du flou, en points : le « 60px » de backdrop-filter: blur(60px).
  blurRadius?: number;
  // 1 = couleurs inchangées ; 1.8 = saturate(180%).
  saturation?: number;
  tint?: string;
  fallbackColor?: string;
  edgeColor?: string;
  edgeWidth?: number;
  cornerRadius?: number;
};

export const NebulaBlurView = requireNativeView<NebulaBlurViewProps>('NebulaBlur', 'NebulaBlurView') as ComponentType<NebulaBlurViewProps>;

export const NebulaBlurTarget = requireNativeView<ViewProps>('NebulaBlur', 'NebulaBlurTarget') as unknown as ComponentType<ViewProps & { ref?: Ref<unknown> }>;
