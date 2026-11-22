// Rend les fonds à grain de Nébula avec le moteur des planches (Chromium, via Edge sans fenêtre) : même
// SVG, même flou, même grain que le canvas, calculés directement en 1080 px de large.
// Usage : node scripts/render-backgrounds.mjs <dossier des planches .dc.html>
// Écrit assets/backgrounds/*.webp. Le SVG de chaque fond est pris tel quel dans sa planche.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import process from 'node:process';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'backgrounds');
const boards = process.argv[2];
if (!boards) throw new Error('Donne le dossier des planches (project/ du canvas).');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const WIDTH = 390;
const HEIGHT = 844;
const PX_W = 1080;
const PX_H = Math.round((HEIGHT * PX_W) / WIDTH);
const GRAIN_SCALE = 2;

// Le fond plein écran (390 × 844) d'une planche.
function backgroundOf(file) {
  const source = readFileSync(join(boards, file), 'utf8');
  const start = source.indexOf(`<svg aria-hidden="true" width="${WIDTH}" height="${HEIGHT}"`);
  if (start < 0) throw new Error(`Pas de fond plein écran dans ${file}`);
  return source.slice(start, source.indexOf('</svg>', start) + 6);
}

// Spot n'existe qu'en vignette (132 × 290) sur la planche Fonds : agrandi à l'identique, flou et grain
// aux valeurs des fonds pleine taille.
function spot() {
  return `<svg aria-hidden="true" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" style="position: absolute; left: 0; top: 0"><defs><filter id="fspot" filterUnits="userSpaceOnUse" x="-114" y="-114" width="618" height="1072" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="38.0" edgeMode="duplicate" result="soft0"></feGaussianBlur><feFlood flood-color="#07050D" result="base"></feFlood><feComposite in="soft0" in2="base" operator="over" result="soft"></feComposite><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" seed="7" result="t"></feTurbulence><feColorMatrix in="t" type="saturate" values="0" result="g"></feColorMatrix><feComponentTransfer in="g" result="gc"><feFuncR type="linear" slope="2.2" intercept="-0.6"></feFuncR><feFuncG type="linear" slope="2.2" intercept="-0.6"></feFuncG><feFuncB type="linear" slope="2.2" intercept="-0.6"></feFuncB><feFuncA type="linear" slope="0" intercept="0.55"></feFuncA></feComponentTransfer><feBlend in="gc" in2="soft" mode="overlay" result="mix"></feBlend></filter></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="#07050D"></rect><g filter="url(#fspot)"><rect x="-114" y="-114" width="618" height="1072" fill="#050409"></rect><g><radialGradient id="aspot" cx=".5" cy=".15" r=".75"><stop offset="0" stop-color="#9C72FF"></stop><stop offset=".45" stop-color="#4A22A8" stop-opacity=".9"></stop><stop offset="1" stop-color="#050409" stop-opacity="0"></stop></radialGradient><ellipse cx="195" cy="16.9" rx="468" ry="506.4" fill="url(#aspot)"></ellipse></g></g></svg>`;
}

const SOURCES = {
  horizon: () => backgroundOf('LysAccueil.dc.html'),
  amethyste: () => backgroundOf('LysBienvenue.dc.html'),
  aube: () => backgroundOf('LysConversation.dc.html'),
  soie: () => backgroundOf('LysEphemere.dc.html'),
  spot,
};

const work = join(tmpdir(), 'nebula-fonds');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(out, { recursive: true });
for (const [kind, svgOf] of Object.entries(SOURCES)) {
  const page = join(work, `${kind}.html`);
  const png = join(work, `${kind}.png`);
  // Le SVG garde sa boîte 390 × 844 mais est dessiné directement en 1080 px de large : le filtre (flou,
  // grain) est calculé à la résolution du téléphone, au lieu d'être agrandi (grain en petits carrés).
  const svg = svgOf()
    .replace('z-index: -1; ', '')
    .replace('pointer-events: none', '')
    .replace(`width="${WIDTH}" height="${HEIGHT}"`, `width="${PX_W}" height="${PX_H}"`)
    // Sur le canvas, une tache de grain fait 1 à 1,5 pixel d'écran ; sur un téléphone 2,77 fois plus dense,
    // la même fréquence donnerait des taches de 3 pixels, grossières. Fréquence doublée : le grain fin des planches.
    .replace('baseFrequency="0.9"', `baseFrequency="${0.9 * GRAIN_SCALE}"`);
  writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${PX_W}px;height:${PX_H}px;overflow:hidden;background:#000}</style></head><body>${svg}</body></html>`);
  execFileSync(EDGE, ['--headless=new', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=1', `--window-size=${PX_W},${PX_H}`, `--screenshot=${png}`, `file:///${page.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  // Qualité haute : le grain est fin, une compression forte le transforme en taches.
  await sharp(png).resize(PX_W, PX_H).webp({ quality: 94 }).toFile(join(out, `${kind}.webp`));
  console.log(kind);
}
