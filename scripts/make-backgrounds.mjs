// Génère les fonds violets à grain de Nébula (planche « Fonds violets à grain ») en WebP, grain compris.
// Usage : node scripts/make-backgrounds.mjs   (écrit assets/backgrounds/*.webp, avec sharp)
// Même SVG que les planches : formes en dégradé, gros flou, puis grain gris en incrustation.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Buffer } from 'node:buffer';

import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'backgrounds');
const WIDTH = 1080;
const HEIGHT = 2340;

function background(kind, W, H) {
  const id = kind;
  // Les planches font 390 px de large : flou et grain suivent l'échelle pour garder le même rendu.
  const k = W / 390;
  const sx = W / 390, sy = H / 844;
  const shapes = {
    horizon: { base: '#0A0716', inner: '#08060F', g: `<linearGradient id="a${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D0A22"></stop><stop offset=".5" stop-color="#07050F"></stop><stop offset="1" stop-color="#1A0B45"></stop></linearGradient><rect x="${-195 * sx}" y="${-253 * sy}" width="${780 * sx}" height="${1350 * sy}" fill="url(#a${id})"></rect><ellipse cx="${273 * sx}" cy="${810 * sy}" rx="${409 * sx}" ry="${270 * sy}" fill="#7A45FF"></ellipse><ellipse cx="${390 * sx}" cy="${726 * sy}" rx="${125 * sx}" ry="${110 * sy}" fill="#C85AF5"></ellipse><ellipse cx="${140 * sx}" cy="${886 * sy}" rx="${359 * sx}" ry="${228 * sy}" fill="#06040D"></ellipse>` },
    spot: { base: '#07050D', inner: '#050409', g: `<radialGradient id="a${id}" cx=".5" cy=".15" r=".75"><stop offset="0" stop-color="#9C72FF"></stop><stop offset=".45" stop-color="#4A22A8" stop-opacity=".9"></stop><stop offset="1" stop-color="#050409" stop-opacity="0"></stop></radialGradient><ellipse cx="${195 * sx}" cy="${17 * sy}" rx="${468 * sx}" ry="${506 * sy}" fill="url(#a${id})"></ellipse>` },
    amethyste: { base: '#1E0E52', inner: '#120830', g: `<linearGradient id="a${id}" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#7B4DFF"></stop><stop offset=".4" stop-color="#4B23B8"></stop><stop offset=".75" stop-color="#160A3A"></stop><stop offset="1" stop-color="#060410"></stop></linearGradient><rect x="${-195 * sx}" y="${-253 * sy}" width="${780 * sx}" height="${1350 * sy}" fill="url(#a${id})"></rect><ellipse cx="${58 * sx}" cy="${101 * sy}" rx="${195 * sx}" ry="${152 * sy}" fill="#9D7BFF" opacity=".55"></ellipse><ellipse cx="${370 * sx}" cy="${757 * sy}" rx="${175 * sx}" ry="${169 * sy}" fill="#03020A" opacity=".9"></ellipse>` },
    aube: { base: '#05040A', inner: '#05040A', g: `<linearGradient id="a${id}" x1="1" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#6D28D9" stop-opacity="0"></stop><stop offset=".46" stop-color="#4C1D95"></stop><stop offset=".52" stop-color="#8B5CF6"></stop><stop offset=".6" stop-color="#2E1065"></stop><stop offset="1" stop-color="#05030A" stop-opacity="0"></stop></linearGradient><path d="M${507 * sx} ${591 * sy} C${331.5 * sx} ${472.6 * sy} ${195 * sx} ${506.4 * sy} ${-117 * sx} ${337.6 * sy} L${-117 * sx} ${725.8 * sy} C${156 * sx} ${810.2 * sy} ${312 * sx} ${759.6 * sy} ${507 * sx} ${844 * sy} Z" fill="url(#a${id})" opacity=".85"></path><ellipse cx="${409.5 * sx}" cy="${67.5 * sy}" rx="${175.5 * sx}" ry="${84.4 * sy}" fill="#3B1A7A" opacity=".55"></ellipse>` },
    soie: { base: '#05040A', inner: '#040307', g: `<linearGradient id="a${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#7C3AED" stop-opacity="0"></stop><stop offset=".44" stop-color="#5B21B6"></stop><stop offset=".5" stop-color="#A67BFF"></stop><stop offset=".58" stop-color="#3B167E"></stop><stop offset="1" stop-color="#05030A" stop-opacity="0"></stop></linearGradient><path d="M${-117 * sx} ${523 * sy} C${58 * sx} ${338 * sy} ${195 * sx} ${355 * sy} ${507 * sx} ${84 * sy} L${507 * sx} ${523 * sy} C${234 * sx} ${591 * sy} ${78 * sx} ${675 * sy} ${-117 * sx} ${802 * sy} Z" fill="url(#a${id})"></path><ellipse cx="${-19 * sx}" cy="${557 * sy}" rx="${136 * sx}" ry="${101 * sy}" fill="#6D28D9" opacity=".7"></ellipse>` },
  }[kind];
  const m = Math.round(114 * k);
  return `<svg aria-hidden="true" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none"><defs><filter id="f${id}" filterUnits="userSpaceOnUse" x="-${m}" y="-${m}" width="${W + 2 * m}" height="${H + 2 * m}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${(38 * k).toFixed(1)}" edgeMode="duplicate" result="soft0"></feGaussianBlur><feFlood flood-color="${shapes.base}" result="base"></feFlood><feComposite in="soft0" in2="base" operator="over" result="soft"></feComposite><feTurbulence type="fractalNoise" baseFrequency="${(0.9 / k).toFixed(3)}" numOctaves="3" stitchTiles="stitch" seed="7" result="t"></feTurbulence><feColorMatrix in="t" type="saturate" values="0" result="g"></feColorMatrix><feComponentTransfer in="g" result="gc"><feFuncR type="linear" slope="2.2" intercept="-0.6"></feFuncR><feFuncG type="linear" slope="2.2" intercept="-0.6"></feFuncG><feFuncB type="linear" slope="2.2" intercept="-0.6"></feFuncB><feFuncA type="linear" slope="0" intercept="0.55"></feFuncA></feComponentTransfer><feBlend in="gc" in2="soft" mode="overlay" result="mix"></feBlend></filter></defs><rect width="${W}" height="${H}" fill="${shapes.base}"></rect><g filter="url(#f${id})"><rect x="-${m}" y="-${m}" width="${W + 2 * m}" height="${H + 2 * m}" fill="${shapes.inner}"></rect><g>${shapes.g}</g></g></svg>`;
}


mkdirSync(out, { recursive: true });
for (const kind of ['horizon', 'spot', 'amethyste', 'soie', 'aube']) {
  const svg = background(kind, WIDTH, HEIGHT).replace('<svg aria-hidden="true"', '<svg xmlns="http://www.w3.org/2000/svg"');
  await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(join(out, kind + '.webp'));
  console.log(kind);
}

// Grain seul, en tuile, posé en incrustation sur les boutons Grain et Fumé (planche « Boutons »).
const GRAIN = 256;
const grain = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAIN}" height="${GRAIN}"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".33" numOctaves="3" stitchTiles="stitch"></feTurbulence><feColorMatrix type="saturate" values="0"></feColorMatrix></filter><rect width="100%" height="100%" filter="url(#g)"></rect></svg>`;
await sharp(Buffer.from(grain)).webp({ quality: 80 }).toFile(join(out, 'grain.webp'));
console.log('grain');
