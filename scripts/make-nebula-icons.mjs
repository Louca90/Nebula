// Génère les icônes de Nébula : le lys blanc d'un seul tenant (src/components/Lily.tsx) sur le fond
// « Soie » à grain (planche « Fonds » : Soie sert au mode éphémère et à l'icône).
// Usage : node scripts/make-nebula-icons.mjs   (après make-backgrounds.mjs ; écrit assets/*.png, avec sharp)
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const lilySource = readFileSync(join(root, 'src', 'components', 'Lily.tsx'), 'utf8');
const PATHS = ['PETAL_LEFT', 'PETAL_RIGHT', 'STAMENS', 'HEART', 'STEM'].map((name) => lilySource.match(new RegExp(`const ${name} = '([^']+)'`))[1]);

// Le lys dans un carré de `size`, sa largeur à `ratio` du carré, centré.
function lilySvg(size, ratio, color) {
  const scale = (size * ratio) / 92;
  const tx = (size - 92 * scale) / 2 - 4 * scale;
  const ty = (size - 88 * scale) / 2 - 10 * scale;
  const paths = PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g transform="translate(${tx} ${ty}) scale(${scale})">${paths}</g></svg>`);
}

const SIZE = 1024;
// Le carré du milieu du fond Soie : sa bande de lumière en diagonale.
const soie = await sharp(join(assets, 'backgrounds', 'soie.webp')).extract({ left: 0, top: 560, width: 1080, height: 1080 }).resize(SIZE, SIZE).png().toBuffer();

await sharp(soie).composite([{ input: lilySvg(SIZE, 0.56, '#F2F2F0') }]).png().toFile(join(assets, 'icon.png'));
await sharp(soie).png().toFile(join(assets, 'android-icon-background.png'));
// Icône adaptative : le lys reste dans la zone sûre (66 % du carré).
await sharp(lilySvg(SIZE, 0.42, '#F2F2F0')).png().toFile(join(assets, 'android-icon-foreground.png'));
await sharp(lilySvg(SIZE, 0.42, '#FFFFFF')).png().toFile(join(assets, 'android-icon-monochrome.png'));
await sharp(lilySvg(SIZE, 0.5, '#F2F2F0')).png().toFile(join(assets, 'splash-icon.png'));
await sharp(join(assets, 'icon.png')).resize(48, 48).png().toFile(join(assets, 'favicon.png'));
console.log('icônes Nébula écrites');
