const { withAndroidManifest } = require('expo/config-plugins');

// Nébula : coupe EmojiCompat (androidx.emoji2, embarqué par AppCompat et lancé tout seul par
// androidx.startup). Quand la police du téléphone n'a pas un emoji, EmojiCompat le dessine avec sa
// propre police, mais React Native mesure le texte avec celle du système : le texte est dessiné plus
// large que mesuré, et le dernier emoji passe à la ligne, hors de la bulle (« 3 emojis, 2 affichés »).
// Voir react/react-native#59850 et #57995. Sans EmojiCompat, mesure et dessin utilisent la même police.
module.exports = (config) =>
  withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.provider = app.provider ?? [];
    let provider = app.provider.find((item) => item.$['android:name'] === 'androidx.startup.InitializationProvider');
    if (!provider) {
      provider = {
        $: {
          'android:name': 'androidx.startup.InitializationProvider',
          'android:authorities': '${applicationId}.androidx-startup',
          'android:exported': 'false',
          'tools:node': 'merge',
        },
      };
      app.provider.push(provider);
    }
    const initializer = 'androidx.emoji2.text.EmojiCompatInitializer';
    provider['meta-data'] = (provider['meta-data'] ?? []).filter((item) => item.$['android:name'] !== initializer);
    provider['meta-data'].push({ $: { 'android:name': initializer, 'tools:node': 'remove' } });
    return result;
  });
