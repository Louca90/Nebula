import { NetworkManager, OfflineManager } from '@maplibre/maplibre-react-native';

import { getSetting, setSetting } from '../chat/database';
import { clearMapDownload, showMapDownload } from '../chat/notifications';
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
    )
      .then((pack) => notePack(pack.id))
      .catch((e) => {
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

// --- Nébula : téléchargements suivis par toute l'app ---
// Un téléchargement ne dépend plus de l'écran Carte : il continue quand on change d'onglet ou qu'on quitte
// l'app (une notification de premier plan garde le processus en vie), et l'écran retrouve sa barre en
// revenant. Coupé (app tuée, réseau perdu), il est relancé au retour : les tuiles déjà reçues sont
// gardées par MapLibre et ne sont pas redemandées. Les morceaux de packs interrompus sont effacés à la fin.

type Point = { latitude: number; longitude: number };
export type MapDownloads = { region: number | null; france: number | null; zone: { name: string; progress: number } | null };
type Pending = { region?: { center: Point }; france?: true; zone?: { center: Point; name: string }; stale?: string[] };

const PENDING_KEY = 'map_pending';
let downloads: MapDownloads = { region: null, france: null, zone: null };
const downloadListeners = new Set<() => void>();
const running = new Map<keyof MapDownloads, Promise<unknown>>();

function setDownloads(change: Partial<MapDownloads>) {
  downloads = { ...downloads, ...change };
  downloadListeners.forEach((listener) => listener());
  const active = [downloads.region, downloads.france, downloads.zone?.progress].filter((value): value is number => value !== null && value !== undefined);
  if (active.length > 0) showMapDownload(Math.min(...active)).catch((e) => log.warn('carte', e));
  else clearMapDownload().catch((e) => log.warn('carte', e));
}

export function subscribeMapDownloads(listener: () => void) {
  downloadListeners.add(listener);
  return () => {
    downloadListeners.delete(listener);
  };
}

export function getMapDownloads() {
  return downloads;
}

function readPending(): Pending {
  try {
    return (JSON.parse(getSetting(PENDING_KEY) ?? '{}') as Pending) ?? {};
  } catch {
    return {};
  }
}

function writePending(change: (pending: Pending) => Pending) {
  const next = change(readPending());
  const empty = !next.region && !next.france && !next.zone;
  setSetting(PENDING_KEY, empty && !next.stale?.length ? null : JSON.stringify(next));
}

// Les packs créés pendant un téléchargement : gardés pour effacer les restes d'un téléchargement coupé.
function notePack(id: string) {
  writePending((pending) => ({ ...pending, stale: [...(pending.stale ?? []), id] }));
}

// Une fois tout fini, les packs inachevés qui ne servent à rien sont effacés.
function cleanStale() {
  const pending = readPending();
  if (pending.region || pending.france || pending.zone) return;
  const kept = new Set([...(savedRegion()?.packIds ?? []), ...(savedFrance()?.packIds ?? []), ...savedZones().flatMap((zone) => zone.packIds)]);
  for (const id of pending.stale ?? []) if (!kept.has(id)) OfflineManager.deletePack(id).catch((e) => log.warn('carte', e));
  setSetting(PENDING_KEY, null);
}

function track<T>(kind: keyof MapDownloads, task: () => Promise<T>): Promise<T> {
  const existing = running.get(kind);
  if (existing) return existing as Promise<T>;
  const promise = task().finally(() => {
    running.delete(kind);
    setDownloads({ [kind]: null } as Partial<MapDownloads>);
    cleanStale();
  });
  running.set(kind, promise);
  return promise;
}

export function startRegionDownload(center: Point): Promise<MapRegion> {
  writePending((pending) => ({ ...pending, region: { center } }));
  setDownloads({ region: 0 });
  return track('region', async () => {
    const region = await downloadRegion(center, (fraction) => setDownloads({ region: fraction }));
    writePending(({ region: _done, ...rest }) => rest);
    return region;
  });
}

export function startFranceDownload(): Promise<MapPack> {
  writePending((pending) => ({ ...pending, france: true }));
  setDownloads({ france: 0 });
  return track('france', async () => {
    const pack = await downloadFrance((fraction) => setDownloads({ france: fraction }));
    writePending(({ france: _done, ...rest }) => rest);
    return pack;
  });
}

export function startZoneDownload(center: Point, name: string): Promise<MapRegion> {
  writePending((pending) => ({ ...pending, zone: { center, name } }));
  setDownloads({ zone: { name, progress: 0 } });
  return track('zone', async () => {
    const zone = await downloadZoneAround(center, (fraction) => setDownloads({ zone: { name, progress: fraction } }));
    writePending(({ zone: _done, ...rest }) => rest);
    return zone;
  });
}

// Au lancement et au retour dans l'app : les téléchargements coupés reprennent.
export function resumeMapDownloads() {
  const pending = readPending();
  const retry = (promise: Promise<unknown>) => promise.catch((e) => log.warn('carte', e));
  if (pending.region && !running.has('region')) retry(startRegionDownload(pending.region.center));
  if (pending.france && !running.has('france')) retry(startFranceDownload());
  if (pending.zone && !running.has('zone')) retry(startZoneDownload(pending.zone.center, pending.zone.name));
}
