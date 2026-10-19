// Client du relais local optionnel (server.mjs).
// Le navigateur ne peut pas joindre certaines API (CORS) ni lire les octets d'une vidéo
// distante : ces appels passent alors par le relais, qui ne fait que transiter en local.

let relayProbe: Promise<boolean> | null = null;

export function hasRelay(): Promise<boolean> {
  if (!relayProbe) {
    relayProbe = fetch('/api/health', { signal: AbortSignal.timeout(1500) })
      .then((r) => r.ok)
      .catch(() => false);
  }
  return relayProbe;
}

export const NO_RELAY =
  'Publication impossible : le navigateur bloque l’appel (CORS). Lancez le relais local — « npm start » dans le dossier Fluxia — puis relancez le flux.';

async function relayJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(String(json?.error ?? `Relais ${res.status}`));
  if (!json) throw new Error('Réponse vide du relais.');
  return json;
}

export interface RelayResult {
  status: number;
  body: string;
}

export async function relayFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RelayResult> {
  const json = await relayJson<Partial<RelayResult> & { error?: string }>('/api/relay', { url, ...init });
  return { status: Number(json.status ?? 0), body: String(json.body ?? json.error ?? '') };
}

export interface VideoMeta {
  id: string;
  size: number;
  contentType: string;
  filename: string;
}

// Récupère la vidéo depuis son URL et la retient quelques minutes côté relais.
export async function videoFetch(url: string): Promise<VideoMeta> {
  const json = await relayJson<Partial<VideoMeta> & { ok?: boolean; error?: string }>('/api/video/fetch', { url });
  if (!json.ok || !json.id) throw new Error(String(json.error ?? 'Le relais n’a pas pu récupérer la vidéo.'));
  return {
    id: String(json.id),
    size: Number(json.size ?? 0),
    contentType: String(json.contentType ?? 'video/mp4'),
    filename: String(json.filename ?? 'video.mp4'),
  };
}

export function videoMultipart(call: {
  id: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  fields?: Record<string, string | undefined>;
  fileField?: string;
  fileName?: string;
  fileType?: string;
  start?: number;
  end?: number;
}): Promise<RelayResult> {
  return videoSend('/api/video/multipart', call);
}

export function videoRelated(call: {
  id: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  parts: { contentType: string; body: string }[];
  fileType?: string;
}): Promise<RelayResult> {
  return videoSend('/api/video/related', call);
}

export function videoChunk(call: {
  id: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  start: number;
  end: number;
  contentRange?: boolean;
}): Promise<RelayResult> {
  return videoSend('/api/video/chunk', call);
}

async function videoSend(path: string, call: Record<string, unknown>): Promise<RelayResult> {
  const json = await relayJson<Partial<RelayResult>>(path, call);
  return { status: Number(json.status ?? 0), body: String(json.body ?? '') };
}

export function videoRelease(id: string): void {
  void fetch('/api/video/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => { /* le relais purge de toute façon */ });
}

// Erreur lisible : le relais répond « Route inconnue » s'il tourne en version antérieure.
export function relayVersionError(r: RelayResult, feature: string): Error | null {
  if (r.status === 404 && /route inconnue/i.test(r.body)) {
    return new Error(`Relais trop ancien pour ${feature} — relancez « npm start » dans le dossier Fluxia.`);
  }
  return null;
}

export function fail(platform: string, r: RelayResult): never {
  throw new Error(`${platform} ${r.status || 'réseau'} — ${r.body.slice(0, 200)}`);
}
