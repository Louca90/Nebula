import { NetworkManager, OfflineManager } from '@maplibre/maplibre-react-native';

import { getSetting, setSetting } from '../chat/database';
import { log } from '../log';
import { insideRegion, regionBounds, RegionBounds } from './region';

// La carte de Pear est hors ligne (choix du 13 nov.) : une zone est téléchargée une seule fois, à la
// demande, puis gardée sur le téléphone. Le reste du temps, MapLibre n'a pas le droit d'aller sur le
// réseau : aucune tuile ne part chercher l'endroit qu'on regarde, rien ne fuit pendant l'utilisation.
// Pendant le téléchargement, le serveur de cartes (OpenFreeMap, sans compte ni clé) voit seulement
// quelle zone est demandée, une fois.

// « Positron » en clair, « Dark » en sombre : discrets, comme le reste de Pear. Les deux styles partagent
// les mêmes tuiles : la seconde zone ne télécharge presque que le style lui-même.
export const MAP_STYLES = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' };
export const mapStyleFor = (dark: boolean) => (dark ? MAP_STYLES.dark : MAP_STYLES.light);
const REGION_KEY = 'map_region';
// Jusqu'au zoom 14, les tuiles vectorielles gardent rues et noms ; au-delà, la carte agrandit le 14.
const MIN_ZOOM = 4;
const MAX_ZOOM = 14;
// Rayon de la zone autour de la position : une ville et ses environs.
export const REGION_RADIUS_KM = 25;

// packIds : une zone par style (clair, sombre). packId : ancien format (un seul style).
export type MapRegion = { packIds: string[]; bounds: RegionBounds; at: number };

// Nébula : la France entière, gardée aussi sur le téléphone, jusqu'au zoom 11 (villes, villages, routes
// principales et secondaires : environ 10 000 tuiles, quelques centaines de Mo). Au zoom 14 comme la zone
// détaillée, ce serait 600 000 tuiles et plusieurs Go : le détail rue par rue reste réservé aux zones
// autour de toi et autour de la position qu'elle te partage (téléchargées à la demande, voir plus bas).
export const FRANCE_BOUNDS: RegionBounds = [-5.3, 41.3, 9.7, 51.2];
const FRANCE_MAX_ZOOM = 11;
const FRANCE_KEY = 'map_france';
// Les zones détaillées ajoutées autour de sa position (en plus de la mienne), les plus récentes gardées.
const ZONES_KEY = 'map_zones';
const MAX_ZONES = 4;
// Une zone ajoutée autour d'elle : un peu plus petite que la mienne (le centre-ville et ses abords).
export const ZONE_RADIUS_KM = 15;
const ZONE_MIN_ZOOM = 10;

export type MapPack = { packIds: string[]; at: number };

// Plusieurs téléchargements peuvent se suivre (France, puis zone) : le réseau reste ouvert tant qu'il en
// reste un en cours.
let downloading = 0;
function openNetwork() {
  downloading += 1;
  NetworkManager.setConnected(true);
}
function closeNetwork() {
  downloading = Math.max(0, downloading - 1);
  if (downloading === 0) NetworkManager.setConnected(false);
}

// Par défaut, hors réseau : appelé au lancement de chaque carte.
export function keepMapOffline() {
  if (downloading > 0) return;
  try {
    NetworkManager.setConnected(false);
  } catch (e) {
    log.warn('carte', e);
  }
}

export function savedFrance(): MapPack | null {
  try {
    const value = JSON.parse(getSetting(FRANCE_KEY) ?? 'null') as MapPack | null;
    return value && Array.isArray(value.packIds) && value.packIds.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function savedZones(): MapRegion[] {
  try {
    const value = JSON.parse(getSetting(ZONES_KEY) ?? '[]') as MapRegion[];
    return Array.isArray(value) ? value.filter((zone) => Array.isArray(zone?.bounds) && Array.isArray(zone?.packIds)) : [];
  } catch {
    return [];
  }
}

// Un point montrable sur la carte hors ligne : dans une zone détaillée, ou en France si elle est gardée.
export function isMapped(point: { latitude: number; longitude: number }): boolean {
  const region = savedRegion();
  if (region && insideRegion(region.bounds, point)) return true;
  if (savedZones().some((zone) => insideRegion(zone.bounds, point))) return true;
  return !!savedFrance() && insideRegion(FRANCE_BOUNDS, point);
}

// Le détail rue par rue (zoom 14) est-il déjà là autour de ce point ?
export function hasDetailAt(point: { latitude: number; longitude: number }): boolean {
  const region = savedRegion();
  if (region && insideRegion(region.bounds, point)) return true;
  return savedZones().some((zone) => insideRegion(zone.bounds, point));
}

// Une carte est-elle déjà sur le téléphone (zone ou France) ?
export function hasOfflineMap() {
  return !!savedRegion() || !!savedFrance();
}

// Télécharge la France entière (zoom 4 à 11). Les tuiles sont communes aux deux styles : seul le sombre
// est téléchargé (Nébula n'a que lui).
export async function downloadFrance(onProgress: (fraction: number) => void): Promise<MapPack> {
  const previous = savedFrance();
  openNetwork();
  try {
    const id = await downloadPack(MAP_STYLES.dark, FRANCE_BOUNDS, onProgress, 4, FRANCE_MAX_ZOOM, 'nebula-france');
    const pack: MapPack = { packIds: [id], at: Date.now() };
    setSetting(FRANCE_KEY, JSON.stringify(pack));
    for (const old of previous?.packIds ?? []) if (old !== id) OfflineManager.deletePack(old).catch((e) => log.warn('carte', e));
    return pack;
  } finally {
    closeNetwork();
  }
}

// Ajoute le détail rue par rue autour d'un point (sa position partagée, hors de ma zone). Seule la zone
// est demandée au serveur de cartes, une fois. Les plus anciennes zones ajoutées sont effacées au-delà de 4.
export async function downloadZoneAround(center: { latitude: number; longitude: number }, onProgress: (fraction: number) => void): Promise<MapRegion> {
  const bounds = regionBounds(center, ZONE_RADIUS_KM);
  openNetwork();
  try {
    const id = await downloadPack(MAP_STYLES.dark, bounds, onProgress, ZONE_MIN_ZOOM, MAX_ZOOM, 'nebula-zone');
    const zone: MapRegion = { packIds: [id], bounds, at: Date.now() };
    const zones = [zone, ...savedZones()];
    for (const old of zones.slice(MAX_ZONES)) for (const packId of old.packIds) OfflineManager.deletePack(packId).catch((e) => log.warn('carte', e));
    setSetting(ZONES_KEY, JSON.stringify(zones.slice(0, MAX_ZONES)));
    return zone;
  } finally {
    closeNetwork();
  }
}

export function savedRegion(): MapRegion | null {
  try {
    const value = JSON.parse(getSetting(REGION_KEY) ?? 'null') as (MapRegion & { packId?: string }) | null;
    if (!value || !Array.isArray(value.bounds)) return null;
    const packIds = Array.isArray(value.packIds) ? value.packIds : typeof value.packId === 'string' ? [value.packId] : [];
    return packIds.length > 0 ? { packIds, bounds: value.bounds, at: value.at } : null;
  } catch {
    return null;
  }
}

// Télécharge la zone autour de `center` (rayon REGION_RADIUS_KM). `onProgress` reçoit 0 à 1. La zone
// précédente est effacée une fois la nouvelle complète.
export async function downloadRegion(center: { latitude: number; longitude: number }, onProgress: (fraction: number) => void): Promise<MapRegion> {
  const bounds = regionBounds(center, REGION_RADIUS_KM);
  const previous = savedRegion();
  openNetwork();
  try {
    const styles = [MAP_STYLES.light, MAP_STYLES.dark];
    const packIds: string[] = [];
    for (const [index, mapStyle] of styles.entries()) {
      // Le premier style compte pour 90 % (il apporte les tuiles), le second pour le reste.
      const from = index === 0 ? 0 : 0.9;
      const span = index === 0 ? 0.9 : 0.1;
      packIds.push(await downloadPack(mapStyle, bounds, (fraction) => onProgress(from + fraction * span)));
    }
    const region: MapRegion = { packIds, bounds, at: Date.now() };
    setSetting(REGION_KEY, JSON.stringify(region));
    for (const id of previous?.packIds ?? []) if (!packIds.includes(id)) OfflineManager.deletePack(id).catch((e) => log.warn('carte', e));
    return region;
  } finally {
    closeNetwork();
  }
}

function downloadPack(mapStyle: string, bounds: RegionBounds, onProgress: (fraction: number) => void, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM, name = 'pear'): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    OfflineManager.createPack(
      { mapStyle, bounds, minZoom, maxZoom, metadata: { name } },
      (pack, status) => {
        onProgress(Math.min(1, status.percentage / 100));
        if (status.state === 'complete' && !settled) {
          settled = true;
          resolve(pack.id);
        }
      },
      (_pack, error) => {
        if (settled) return;
        settled = true;
        reject(new Error(error.message));
      },
    ).catch((e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
  });
}
export async function deleteRegion() {
  const region = savedRegion();
  const france = savedFrance();
  const zones = savedZones();
  setSetting(REGION_KEY, null);
  setSetting(FRANCE_KEY, null);
  setSetting(ZONES_KEY, null);
  const ids = [...(region?.packIds ?? []), ...(france?.packIds ?? []), ...zones.flatMap((zone) => zone.packIds)];
  for (const id of ids) await OfflineManager.deletePack(id).catch((e) => log.warn('carte', e));
}
