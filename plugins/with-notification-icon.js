const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Icône de la barre d'état de Nébula : le lys d'un seul tenant (src/components/Lily.tsx), en blanc sur
// transparent, sur 22 des 24 points de largeur, centré. Le nom du fichier reste ic_stat_pear (config.ts).
const lilyPaths = (projectRoot) => {
  const lily = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'Lily.tsx'), 'utf8');
  return ['PETAL_LEFT', 'PETAL_RIGHT', 'STAMENS', 'HEART', 'STEM'].map((name) => lily.match(new RegExp(`const ${name} = '([^']+)'`))[1]);
};

// Le lys est dessiné dans la boîte « 4 10 92 88 ».
const SCALE = 22 / 92;
const TX = (24 - 92 * SCALE) / 2 - 4 * SCALE;
const TY = (24 - 88 * SCALE) / 2 - 10 * SCALE;

const xml = (PATHS) => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <group android:scaleX="${SCALE.toFixed(4)}" android:scaleY="${SCALE.toFixed(4)}" android:translateX="${TX.toFixed(3)}" android:translateY="${TY.toFixed(3)}">
${PATHS.map((d) => `        <path android:fillColor="#FFFFFFFF" android:pathData="${d}" />`).join('\n')}
    </group>
</vector>
`;

module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    (result) => {
      const directory = path.join(result.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'ic_stat_pear.xml'), xml(lilyPaths(result.modRequest.projectRoot)));
      return result;
    },
  ]);
