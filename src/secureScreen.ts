import { addScreenCaptureListener, setSecureWindow } from '../modules/pear-native';
import { getSetting, setSetting } from './chat/database';
import { showDialog } from './components/dialog';
import { t } from './i18n';
import { log } from './log';

// Nébula : captures d'écran bloquées par défaut (FLAG_SECURE), autorisables dans Profil → Confidentialité.
// Une photo ou une vidéo à vue unique les bloque toujours le temps de son affichage : c'est la promesse
// faite à l'autre. Quand une capture est bloquée (Android 14+ le signale), l'app propose de les autoriser.
const SETTING = 'allow_screenshots';
let holds = 0;
let allowed: boolean | null = null;

export function screenshotsAllowed(): boolean {
  if (allowed !== null) return allowed;
  try {
    allowed = getSetting(SETTING) === '1';
    return allowed;
  } catch {
    // Base pas encore ouverte : bloqué en attendant, relu au prochain appel.
    return false;
  }
}

export function applySecureScreen() {
  const secure = !__DEV__ && (holds > 0 || !screenshotsAllowed());
  setSecureWindow(secure).catch((e) => log.warn('fenêtre protégée', e));
}

export function setScreenshotsAllowed(value: boolean) {
  allowed = value;
  setSetting(SETTING, value ? '1' : null);
  applySecureScreen();
}

// Bloque les captures le temps d'afficher un média à vue unique ; rend la fonction qui relâche.
export function holdSecureScreen() {
  holds += 1;
  applySecureScreen();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    applySecureScreen();
  };
}

let asking = false;

// Au lancement : applique le réglage et écoute les captures bloquées.
export function startSecureScreen() {
  applySecureScreen();
  const subscription = addScreenCaptureListener(({ blocked }) => {
    // Bloquée par une vue unique : pas de proposition, c'est voulu.
    if (!blocked || holds > 0 || asking) return;
    asking = true;
    // Fenêtre fermée sans choisir (appui à côté) : on pourra redemander à la capture suivante.
    setTimeout(() => {
      asking = false;
    }, 15000);
    showDialog(t('captures.bloqueeTitre'), t('captures.bloqueeTexte'), [
      {
        label: t('captures.autoriser'),
        onPress: () => {
          asking = false;
          setScreenshotsAllowed(true);
        },
      },
      {
        label: t('commun.annuler'),
        style: 'cancel',
        onPress: () => {
          asking = false;
        },
      },
    ]);
  });
  return () => subscription.remove();
}
