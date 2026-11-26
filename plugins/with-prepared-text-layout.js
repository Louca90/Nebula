const { withMainApplication } = require('expo/config-plugins');

// Nébula : le dernier emoji d'un message disparaissait (« 4 emojis, 3 affichés »), surtout dans nos
// propres bulles. Depuis Android 15, une app qui vise l'API 35 ou plus voit TextView calculer sa
// largeur sur le dessin des caractères (useBoundsForWidth), un peu plus large pour les emojis, alors que
// React Native mesure le texte sur leur avance : à l'affichage, le dernier emoji ne tient plus sur la
// ligne et passe dessous, hors de la bulle. Le drapeau enablePreparedTextLayout de React Native fait
// dessiner le texte avec exactement la mise en page mesurée (PreparedLayoutTextView) : plus d'écart.
// Seulement à partir d'Android 15 (là où le décalage existe) et en version stable de React Native.
const IMPORTS = [
  'import android.os.Build',
  'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
  'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
];

const OVERRIDE = `
    // Nébula : texte dessiné avec la mise en page mesurée (voir plugins/with-prepared-text-layout.js).
    if (Build.VERSION.SDK_INT >= 35 && DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE) {
      val accessed = ReactNativeFeatureFlags.dangerouslyForceOverride(object : ReactNativeNewArchitectureFeatureFlagsDefaults() {
        override fun enablePreparedTextLayout(): Boolean = true
      })
      if (!accessed.isNullOrEmpty()) android.util.Log.w("Nebula", "Drapeaux lus avant le réglage : $accessed")
    }`;

module.exports = (config) =>
  withMainApplication(config, (result) => {
    let source = result.modResults.contents;
    if (source.includes('enablePreparedTextLayout')) return result;
    if (!source.includes('loadReactNative(this)')) throw new Error('with-prepared-text-layout : loadReactNative(this) introuvable dans MainApplication');
    const missing = IMPORTS.filter((line) => !source.includes(line));
    source = source.replace(/^(package [^\n]+\n)/, `$1\n${missing.join('\n')}\n`);
    source = source.replace('loadReactNative(this)', `loadReactNative(this)${OVERRIDE}`);
    result.modResults.contents = source;
    return result;
  });
