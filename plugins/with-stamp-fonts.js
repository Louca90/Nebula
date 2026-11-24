const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Les polices des marques de l'éditeur (heure, date, lieu…) : copiées dans assets/fonts de l'app Android,
// où React Native et react-native-svg les trouvent par leur nom de famille (le nom du fichier).
// Instrument Serif, Space Grotesk, DM Mono et Caveat, sous licence SIL Open Font License 1.1.
module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    (result) => {
      const source = path.join(result.modRequest.projectRoot, 'assets', 'fonts');
      const target = path.join(result.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets', 'fonts');
      fs.mkdirSync(target, { recursive: true });
      for (const file of fs.readdirSync(source).filter((name) => name.endsWith('.ttf'))) {
        fs.copyFileSync(path.join(source, file), path.join(target, file));
      }
      return result;
    },
  ]);
