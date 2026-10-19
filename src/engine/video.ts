// Nœuds « Vidéo » : publication réelle sur les réseaux sociaux.
// Chaque fonction parle à l'API officielle de la plateforme et échoue avec un message
// français explicite si les identifiants manquent ou si la plateforme refuse.

import type { FlowNode, Item } from '../types';
import { resolveDeep, type ExprContext } from './expressions';
import {
  NO_RELAY, fail, hasRelay, relayFetch, videoChunk, videoFetch, videoMultipart, videoRelease, videoRelated,
  type VideoMeta,
} from './relay';

export const VIDEO_TYPES = new Set([
  'videoYoutube', 'videoMastodon', 'videoBluesky', 'videoX', 'videoInstagram', 'videoFacebook', 'videoTiktok',
]);

const GRAPH_VERSION = 'v26.0';
const MB = 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveParams(node: FlowNode, ctx: ExprContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.data.params ?? {})) out[k] = resolveDeep(v, ctx);
  return out;
}

const str = (v: unknown) => String(v ?? '').trim();

function need(value: string, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function hostFromDomain(raw: string, label: string): string {
  const cleaned = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) {
    throw new Error(`${label} invalide — indiquez le domaine seul, sans https ni slash (ex. « mastodon.social »).`);
  }
  return cleaned;
}

function parse(body: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(body) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function formUrlEncoded(fields: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '') p.set(k, v);
  return p.toString();
}

const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const JSONH = { 'Content-Type': 'application/json' };

// Champs obligatoires par réseau. Vérifiés AVANT tout téléchargement ou appel réseau :
// une vidéo de 200 Mo ne doit pas être récupérée pour un jeton oublié.
const REQUIRED: Record<string, Array<[string, string]>> = {
  videoYoutube: [
    ['accessToken', 'Jeton d’accès YouTube manquant — l’upload exige un OAuth 2.0 avec le scope « youtube.upload » (Google Cloud → identifiants OAuth 2.0, ou OAuth Playground pour un test rapide).'],
    ['title', 'Titre de la vidéo manquant.'],
  ],
  videoMastodon: [
    ['instance', 'Instance Mastodon manquante — ex. « mastodon.social ».'],
    ['accessToken', 'Jeton d’accès manquant — Mastodon → Préférences → Développement → applications → « Generer un jeton » (scopes write:media, write:statuses).'],
  ],
  videoBluesky: [
    ['identifier', 'Identifiant Bluesky manquant — ex. « monnom.bsky.social ».'],
    ['appPassword', 'Mot de passe d’application manquant — Bluesky → Paramètres → Sécurité → « Mots de passe d’application » (jamais le mot de passe principal).'],
  ],
  videoX: [
    ['accessToken', 'Jeton d’accès X manquant — developer.x.com → votre app → « User access token » (scopes media.write et tweet.write). Un simple Bearer applicatif ne suffit pas.'],
    ['text', 'Texte du post manquant.'],
  ],
  videoInstagram: [
    ['igUserId', 'ID du compte Instagram manquant — Graph API Explorer → votre compte → « Instagram Business Account » (compte professionnel lié à une Page).'],
    ['accessToken', 'Jeton d’accès Meta manquant — votre app doit avoir instagram_basic et instagram_content_publish ; en « Development Mode », seuls les comptes ayant un rôle sur l’app publient.'],
  ],
  videoFacebook: [
    ['pageId', 'ID de la Page Facebook manquant — Page → À propos → « Identifiant de la Page ».'],
    ['accessToken', 'Jeton d’accès de la Page manquant — Graph API Explorer → votre app puis la Page (permissions publish_video, pages_manage_metadata).'],
  ],
  videoTiktok: [
    ['accessToken', 'Jeton d’accès TikTok manquant — developers.tiktok.com → votre app → « Debug Access Token » (scope video.publish).'],
    ['title', 'Titre manquant (TikTok l’affiche en description).'],
  ],
};

function preflight(type: string, p: Record<string, unknown>): void {
  for (const [key, message] of REQUIRED[type] ?? []) need(str(p[key]), message);
}

// ─────────────────────────────── YouTube ───────────────────────────────

async function publishYoutube(p: Record<string, unknown>, meta: VideoMeta): Promise<Item> {
  const token = str(p.accessToken);
  const snippet: Record<string, unknown> = {
    title: str(p.title),
    description: str(p.description),
  };
  const tags = str(p.tags).split(/[,\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 30);
  if (tags.length) snippet.tags = tags;
  snippet.categoryId = str(p.categoryId) || '22';
  const body = JSON.stringify({
    snippet,
    status: { privacyStatus: str(p.privacy) || 'private', selfDeclaredMadeForKids: p.madeForKids === true },
  });
  // Google ignore désormais `access_token` en query string : seul l'en-tête compte.
  const url = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status';
  const r = await videoRelated({
    id: meta.id,
    url,
    headers: { Authorization: `Bearer ${token}` },
    parts: [{ contentType: 'application/json; charset=UTF-8', body }],
    fileType: meta.contentType,
  });
  const json = parse(r.body);
  if (r.status === 0 || r.status >= 400) {
    // Un multipart mal formé renvoie du text/plain, pas du JSON.
    const msg = str((parse(r.body)?.error as Record<string, unknown> | undefined)?.message) || r.body.slice(0, 200);
    throw new Error(`YouTube ${r.status || 'réseau'} — ${msg}`);
  }
  const id = str(json?.id);
  return { plateforme: 'YouTube', videoId: id, url: id ? `https://youtu.be/${id}` : null, taille: meta.size };
}

// ─────────────────────────────── Mastodon ───────────────────────────────

// Mastodon renvoie toujours { "error": "phrase humaine" }, sans code machine.
function mastodonError(status: number, body: string, step: string): Error {
  const raw = str(parse(body)?.error) || body.slice(0, 180) || 'réponse vide';
  const hint = /outside the authorized scopes/i.test(raw) ? ' — le jeton doit cocher write:media et write:statuses.'
    : /token is invalid|not authenticated/i.test(raw) ? ' — jeton invalide ou révoqué : régénérez-le sur l’instance.'
    : /content type is invalid|file is invalid/i.test(raw) ? ' — format refusé : MP4 (H.264), MOV ou WebM.'
    : /too many requests/i.test(raw) ? ' — quota atteint (30 envois par 30 minutes), patientez.'
    : /already attached|not finished processing/i.test(raw) ? ' — média déjà publié ou non encore traité : relancez le flux.'
    : '';
  return new Error(`Mastodon ${status || 'réseau'} (${step}) — ${raw}${hint}`);
}

async function publishMastodon(p: Record<string, unknown>, meta: VideoMeta): Promise<Item> {
  const host = hostFromDomain(str(p.instance), 'Instance');
  const api = `https://${host}`;
  const H = { Authorization: `Bearer ${str(p.accessToken)}` };

  // Chaque instance publie ses propres limites : on les lit avant d'envoyer le fichier.
  const inst = parse((await netFetch(`${api}/api/v2/instance`)).body);
  const cfg = ((inst?.configuration as Record<string, unknown> | undefined)?.media_attachments ?? {}) as Record<string, unknown>;
  const declared = Number(cfg.video_size_limit ?? 0);
  // Les nginx de référence coupent à 99 Mio : le cadre multipart doit rester sous ce seuil.
  const max = Math.min(declared > 0 ? declared : 99 * MB, 95 * MB);
  if (meta.size > max) {
    throw new Error(`Vidéo de ${(meta.size / MB).toFixed(1)} Mo : l’instance ${host} accepte ${(max / MB).toFixed(0)} Mo. Transcodez en 720p / 1300 kbps (MP4).`);
  }

  const up = await videoMultipart({
    id: meta.id, url: `${api}/api/v2/media`, headers: H,
    fileField: 'file', fields: { description: str(p.altText) || undefined },
  });
  const upJson = parse(up.body);
  const mediaId = str(upJson?.id);
  if (up.status === 0 || up.status >= 400 || !mediaId) throw mastodonError(up.status, up.body, 'envoi de la vidéo');

  // Réponse 202 : l'encodage tourne en arrière-plan. Poster avant la fin vaut un 422.
  let ready = up.status === 200 && str(upJson?.url) !== '';
  for (let i = 0; !ready && i < 40; i++) {
    await sleep(2000);
    const st = await netFetch(`${api}/api/v1/media/${mediaId}`, { headers: H });
    if (st.status === 206) continue; // contenu partiel : l'encodage n'est pas fini
    if (st.status === 0 || st.status >= 400) throw mastodonError(st.status, st.body, 'encodage de la vidéo');
    ready = str(parse(st.body)?.url) !== '';
  }
  if (!ready) throw new Error(`Mastodon (${host}) n’a pas terminé l’encodage de la vidéo en 80 s — réessayez un peu plus tard ou avec un fichier plus court.`);

  const post = await netFetch(`${api}/api/v1/statuses`, {
    method: 'POST',
    headers: { ...H, ...FORM },
    body: formUrlEncoded({ status: str(p.text), 'media_ids[]': mediaId, visibility: str(p.visibility) || 'public' }),
  });
  const pj = parse(post.body);
  if (post.status === 0 || post.status >= 400 || !str(pj?.id)) throw mastodonError(post.status, post.body, 'publication');
  return { plateforme: 'Mastodon', instance: host, publicationId: str(pj?.id), url: str(pj?.url) || null, mediaId, taille: meta.size };
}

// ─────────────────────────────── Bluesky ───────────────────────────────

// XRPC : { "error": "NomMachine", "message": "texte" } — le nom porte la cause.
function bskyError(status: number, body: string, step: string): Error {
  const j = parse(body);
  const name = str(j?.error);
  const msg = str(j?.message) || body.slice(0, 160) || 'réponse vide';
  const hint = name === 'AuthenticationRequired' ? ' — identifiant ou mot de passe d’application incorrect (le mot de passe principal ne suffit pas).'
    : name === 'AuthFactorTokenRequired' ? ' — le compte a la 2FA : créez un mot de passe d’application plutôt que de rejouer un code.'
    : name === 'AccountTakedown' ? ' — compte suspendu par Bluesky.'
    : name === 'PayloadTooLarge' ? ' — fichier trop lourd pour l’hébergeur (blobUploadLimit).'
    : name === 'InvalidRequest' ? ' — enregistrement refusé : Bluesky n’accepte que du MP4 H.264.'
    : status === 429 ? ' — trop de requêtes, patientez quelques minutes.' : '';
  return new Error(`Bluesky ${status || 'réseau'} (${step}) — ${msg}${hint}`);
}

async function publishBluesky(p: Record<string, unknown>, meta: VideoMeta): Promise<Item> {
  const host = hostFromDomain(str(p.pds) || 'bsky.social', 'Hébergeur');
  const session = await netFetch(`https://${host}/xrpc/com.atproto.server.createSession`, {
    method: 'POST', headers: JSONH,
    body: JSON.stringify({ identifier: str(p.identifier), password: str(p.appPassword) }),
  });
  const sj = parse(session.body);
  const jwt = str(sj?.accessJwt);
  const did = str(sj?.did);
  if (session.status === 0 || session.status >= 400 || !jwt || !did) throw bskyError(session.status, session.body, 'connexion');
  const H = { Authorization: `Bearer ${jwt}` };

  // bsky.social n'est qu'une entrée : les écritures doivent viser le PDS du compte.
  const services = ((sj?.didDoc as Record<string, unknown> | undefined)?.service ?? []) as Record<string, unknown>[];
  const endpoint = str(services.find((s) => str(s.type) === 'AtprotoPersonalDataServer')?.serviceEndpoint).replace(/\/+$/, '');
  const pdsUrl = /^https:\/\//i.test(endpoint) ? endpoint : `https://${host}`;

  // Limite d'upload réelle du PDS (5 Mo par défaut sur un serveur auto-hébergé).
  const desc = parse((await netFetch(`${pdsUrl}/xrpc/com.atproto.server.describeServer`)).body);
  const limit = Number(desc?.blobUploadLimit ?? 0);
  if (limit > 0 && meta.size > limit) {
    throw new Error(`Vidéo de ${(meta.size / MB).toFixed(1)} Mo : ${pdsUrl.replace(/^https:\/\//, '')} accepte ${(limit / MB).toFixed(1)} Mo par fichier.`);
  }

  // uploadBlob attend les octets bruts du MP4 — pas de multipart, pas de base64.
  const up = await videoChunk({
    id: meta.id,
    url: `${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`,
    method: 'POST',
    headers: { ...H, 'Content-Type': 'video/mp4' },
    start: 0,
    end: meta.size - 1,
    contentRange: false,
  });
  const blob = (parse(up.body)?.blob ?? null) as Record<string, unknown> | null;
  if (up.status === 0 || up.status >= 400 || !blob) throw bskyError(up.status, up.body, 'envoi de la vidéo');
  // Le PDS renifle le contenu : un MIME final autre que MP4 serait refusé à la publication.
  const mime = str(blob.mimeType);
  if (mime && mime !== 'video/mp4') {
    throw new Error(`Bluesky n’accepte que du MP4 : le fichier a été reconnu comme « ${mime} ». Réencodez-le en H.264/AAC puis relancez le flux.`);
  }

  const record = await netFetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST', headers: { ...H, ...JSONH },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: str(p.text),
        createdAt: new Date().toISOString(),
        embed: { $type: 'app.bsky.embed.video', video: blob, alt: str(p.altText) || undefined },
      },
    }),
  });
  const rj = parse(record.body);
  const uri = str(rj?.uri);
  if (record.status === 0 || record.status >= 400 || !uri) throw bskyError(record.status, record.body, 'publication');
  const handle = str(sj?.handle) || str(p.identifier);
  return { plateforme: 'Bluesky', did, uri, url: `https://bsky.app/profile/${handle}/post/${uri.split('/').pop()}`, taille: meta.size };
}

// ─────────────────────────────── X (Twitter) ───────────────────────────────

// X répond en problem+JSON (RFC 7807) : { title, detail, status } ou { errors: [{ message }] }.
function xError(status: number, body: string, step: string): Error {
  const j = parse(body);
  const first = (j?.errors as Record<string, unknown>[] | undefined)?.[0];
  const msg = str(j?.detail) || str(first?.message) || body.slice(0, 180) || 'réponse vide';
  return new Error(`X ${status || 'réseau'} (${step}) — ${msg}`);
}

async function publishX(p: Record<string, unknown>, meta: VideoMeta): Promise<Item> {
  const token = str(p.accessToken);
  const text = str(p.text);
  // X n'accepte que quelques conteneurs explicites.
  const mediaType = /^video\/(mp4|webm|quicktime|mp2t)$/.test(meta.contentType) ? meta.contentType : 'video/mp4';

  const init = await relayFetch('https://api.x.com/2/media/upload/initialize', {
    method: 'POST',
    headers: { ...JSONH, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ media_type: mediaType, total_bytes: meta.size, media_category: 'tweet_video' }),
  });
  const mediaId = str((parse(init.body)?.data as Record<string, unknown> | undefined)?.id);
  if (init.status === 0 || init.status >= 400 || !mediaId) throw xError(init.status, init.body, 'initialisation');

  // Protocole v2 : un segment par requête multipart (≤ 5 Mo), numéroté, plus de Content-Range.
  const CHUNK = 5 * 1024 * 1024;
  for (let start = 0, seg = 0; start < meta.size; start += CHUNK, seg++) {
    const r = await videoMultipart({
      id: meta.id,
      url: `https://api.x.com/2/media/upload/${mediaId}/append`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      fields: { segment_index: String(seg) },
      fileField: 'media',
      fileName: `segment${seg}`,
      fileType: 'application/octet-stream',
      start,
      end: Math.min(start + CHUNK - 1, meta.size - 1),
    });
    if (r.status === 0 || r.status >= 400) throw xError(r.status, r.body, `envoi du segment ${seg + 1}`);
  }

  const fin = await relayFetch(`https://api.x.com/2/media/upload/${mediaId}/finalize`, {
    method: 'POST', headers: { ...JSONH, Authorization: `Bearer ${token}` }, body: '{}',
  });
  if (fin.status === 0 || fin.status >= 400) throw xError(fin.status, fin.body, 'finalisation');
  let proc = (parse(fin.body)?.data as Record<string, unknown> | undefined)?.processing_info as Record<string, unknown> | undefined;
  for (let i = 0; proc && ['pending', 'in_progress'].includes(str(proc.state)); i++) {
    if (i > 30) throw new Error('X n’a pas terminé le traitement de la vidéo — réessayez dans un moment.');
    await sleep(Math.max(1, Number(proc?.check_after_secs ?? 1)) * 1000);
    const st = await relayFetch(`https://api.x.com/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    proc = (parse(st.body)?.data as Record<string, unknown> | undefined)?.processing_info as Record<string, unknown> | undefined;
  }
  if (str(proc?.state) === 'failed') {
    throw new Error(`X a rejeté le traitement de la vidéo — ${str(proc?.message) || 'format ou durée non supporté'}.`);
  }

  const post = await relayFetch('https://api.x.com/2/tweets', {
    method: 'POST', headers: { ...JSONH, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  });
  const pid = str((parse(post.body)?.data as Record<string, unknown> | undefined)?.id);
  if (post.status === 0 || post.status >= 400 || !pid) throw xError(post.status, post.body, 'publication');
  return { plateforme: 'X', publicationId: pid, mediaId, url: `https://x.com/i/web/status/${pid}`, taille: meta.size };
}

// ──────────────────────── Instagram / Facebook (Meta) ────────────────────────

function metaError(status: number, body: string): Error {
  const j = parse(body);
  const err = j?.error as Record<string, unknown> | undefined;
  const code = str(err?.code);
  const hint: Record<string, string> = {
    '4': 'trop de requêtes — réessayez plus tard',
    '32': 'URL de la page ou du compte introuvable',
    '100': 'paramètre invalide ou manquant',
    '102': 'session invalide — reconnectez l’application',
    '190': 'jeton expiré ou invalide',
    '200': 'permission manquante sur l’application Meta',
    '210': 'l’utilisateur n’est pas autorisé à publier sur cette Page',
    '368': 'action bloquée temporairement par Meta',
    '382': 'publication trop rapprochée (minimum 15 minutes entre deux Reels)',
    '389': 'l’URL de la vidéo n’est pas récupérable par Meta',
    '6000': 'aucune publication possible pour ce compte',
    '6001': 'compte Instagram non lié à une Page, ou lien perdu',
  };
  return new Error(`Meta ${status || 'réseau'} — ${str(err?.message) || body.slice(0, 180)}${code ? ` [code ${code}${hint[code] ? ` : ${hint[code]}` : ''}]` : ''}`);
}

// Mastodon et Bluesky exposent Access-Control-Allow-Origin: * : l'appel part du navigateur,
// le relais ne sert que de repli (CSP stricte, réseau capricieux). Les octets, eux, passent toujours par le relais.
async function netFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; body: string }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') throw new Error('Délai dépassé en appelant le réseau (30 s).');
    if (await hasRelay()) return relayFetch(url, init);
    throw new Error('Réseau injoignable depuis le navigateur et le relais local est arrêté — lancez « npm start » dans le dossier Fluxia.');
  }
}

async function graphCall(endpoint: string, fields: Record<string, string | undefined>): Promise<Record<string, unknown> | null> {
  const r = await netFetch(endpoint, { method: 'POST', headers: FORM, body: formUrlEncoded(fields) });
  if (r.status === 0 || r.status >= 400) throw metaError(r.status, r.body);
  return parse(r.body);
}

async function publishInstagram(p: Record<string, unknown>, videoUrl: string): Promise<Item> {
  const igUser = str(p.igUserId);
  const token = str(p.accessToken);
  const container = await graphCall(`https://graph.facebook.com/${GRAPH_VERSION}/${igUser}/media`, {
    access_token: token, media_type: 'REELS', video_url: videoUrl,
    caption: str(p.caption) || undefined, share_to_feed: p.shareToFeed === false ? 'false' : 'true',
  });
  const cid = str(container?.id);
  // Meta répond 200 même si l'URL est privée : le contrôle se fait au polling.
  if (!cid) throw new Error('Meta n’a pas créé le conteneur Reels — vérifiez que l’URL de la vidéo est bien publique.');
  let state = '';
  for (let i = 0; i < 40; i++) {
    const st = await netFetch(`https://graph.facebook.com/${GRAPH_VERSION}/${cid}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    state = str(parse(st.body)?.status_code);
    if (state === 'FINISHED' || state === 'PUBLISHED') break;
    if (state === 'ERROR') throw new Error('Meta n’a pas réussi à récupérer la vidéo (status_code = ERROR) — l’URL doit être en HTTPS, sans redirection, et joignable depuis leurs serveurs.');
    if (state === 'EXPIRED') throw new Error('Le conteneur Reels a expiré chez Meta — relancez le flux.');
    await sleep(3000);
  }
  if (state !== 'FINISHED' && state !== 'PUBLISHED') throw new Error('Délai dépassé pendant le traitement du Reel par Meta (2 min) — réessayez dans un moment.');
  const pub = await graphCall(`https://graph.facebook.com/${GRAPH_VERSION}/${igUser}/media_publish`, {
    access_token: token, media_fetched_from_id: cid,
  });
  const pid = str(pub?.id);
  const perm = parse((await netFetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pid}?fields=permalink&access_token=${encodeURIComponent(token)}`)).body);
  return { plateforme: 'Instagram', containerId: cid, publicationId: pid, url: str(perm?.permalink) || null };
}

async function publishFacebook(p: Record<string, unknown>, videoUrl: string): Promise<Item> {
  const pageId = str(p.pageId);
  const token = str(p.accessToken);
  // `upload_url` sert au découpage manuel ; pour donner une URL à Meta c'est `file_url`.
  const res = await graphCall(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/videos`, {
    access_token: token, file_url: videoUrl,
    title: str(p.title), description: str(p.description) || undefined,
  });
  const vid = str(res?.id);
  return { plateforme: 'Facebook', videoId: vid, url: vid ? `https://www.facebook.com/watch/?v=${vid}` : null };
}

// ─────────────────────────────── TikTok ───────────────────────────────

function tiktokHint(code: string): string {
  const map: Record<string, string> = {
    missing_param: 'paramètre manquant',
    invalid_param: 'paramètre invalide — un privacy_level autre que SELF_ONLY exige une app auditée par TikTok',
    api_name_mismatch: 'nom d’API incorrect',
    endpoint_url_mismatch: 'URL d’API incorrecte',
    rate_limit_exceeded: 'quota horaire dépassé — réessayez plus tard',
    internal_error_system: 'erreur interne TikTok, réessayez',
    internal_error_service: 'service TikTok indisponible, réessayez',
    service_unavailable: 'service TikTok indisponible',
  };
  return map[code] ? ` — ${map[code]}` : '';
}

function tiktokFailReasonHint(reason: string): string {
  const map: Record<string, string> = {
    video_pull_failed: 'TikTok n’a pas pu télécharger l’URL. En PULL_FROM_URL, le domaine doit être déclaré et vérifié dans votre app (Developer Portal → « Domain Verification » / URL Prefix), sans redirection.',
    video_pull_timeout: 'Téléchargement trop long : la vidéo doit rester accessible en HTTPS pendant toute la publication.',
    file_format_failure: 'conteneur refusé — MP4 ou WebM',
    file_length_failure: 'durée hors limites (15 s à 10 min selon les droits de l’app)',
    file_size_failure: 'poids hors limites (jusqu’à 4 GB avec les droits Complete Content Posting)',
    unknown_input_method: 'méthode de source inconnue — source doit valoir PULL_FROM_URL ou FILE_UPLOAD',
    invalid_session: 'session expirée — régénérez le jeton (scope video.publish)',
    missing_post_info: 'post_info manquant — titre ou privacy_level vide',
    api_rpm_limit_exceeded: 'trop de requêtes par minute',
    system_error: 'erreur interne TikTok, réessayez dans un moment',
  };
  return map[reason] ?? 'vérifiez le format, la durée et l’accessibilité publique de la vidéo.';
}

async function publishTiktok(p: Record<string, unknown>, videoUrl: string): Promise<Item> {
  const token = str(p.accessToken);
  const title = str(p.title);
  const res = await relayFetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { ...JSONH, Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      post_info: {
        title,
        privacy_level: str(p.privacy) || 'SELF_ONLY',
        disable_comment: p.allowComments === false,
        disable_duet: p.allowDuet !== true,
        disable_stitch: p.allowStitch !== true,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl, video_cover_url: str(p.coverUrl) || undefined },
    }),
  });
  const j = parse(res.body);
  const err = j?.error as Record<string, unknown> | undefined;
  const errCode = str(err?.code);
  // TikTok peut répondre 200 avec un code d'erreur dans le corps.
  if (res.status === 0 || res.status >= 400 || (errCode && errCode.toLowerCase() !== 'ok')) {
    fail('TikTok', { status: res.status, body: `${str(err?.message) || res.body}${tiktokHint(errCode)}` });
  }
  const publishId = str((j?.data as Record<string, unknown> | undefined)?.publish_id);
  if (!publishId) throw new Error(`TikTok a refusé la publication — ${str(err?.message) || res.body.slice(0, 160)}`);

  let status = '';
  let failReason = '';
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const st = await relayFetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST', headers: { ...JSONH, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = (parse(st.body)?.data ?? {}) as Record<string, unknown>;
    status = str(data.status);
    failReason = str(data.fail_reason);
    if (status === 'FAILED') {
      throw new Error(`TikTok a rejeté la vidéo (${failReason || 'FAILED'}) — ${tiktokFailReasonHint(failReason)}`);
    }
    if (status === 'PUBLISH_COMPLETE') {
      // Le champ s'écrit bien « publicaly » chez TikTok : inutile de corriger leur faute.
      const ids = (data.publicaly_available_post_id ?? data.publically_available_post_id) as unknown[];
      const postId = str(Array.isArray(ids) ? ids[0] : ids);
      return { plateforme: 'TikTok', publishId, postId: postId || null, url: null, statut: 'PUBLISH_COMPLETE' };
    }
    if (status === 'SEND_TO_USER_INBOX') {
      return { plateforme: 'TikTok', publishId, url: null, statut: status, note: 'TikTok a déposé la publication dans la boîte de l’utilisateur : elle doit être validée dans l’appli.' };
    }
  }
  return { plateforme: 'TikTok', publishId, url: null, statut: status || 'UNKNOWN', note: 'TikTok traite encore la vidéo (2 min) — vérifiez le statut dans l’application.' };
}

// ─────────────────────────────── Point d'entrée ───────────────────────────────

export async function runVideoNode(node: FlowNode, input: Item[], ctx: ExprContext): Promise<Item[][] | null> {
  const type = node.data.defType;
  if (!VIDEO_TYPES.has(type)) return null;
  if (!(await hasRelay())) throw new Error(NO_RELAY);

  const out: Item[] = [];
  for (let i = 0; i < input.length; i++) {
    const c: ExprContext = { ...ctx, json: input[i], index: i };
    const p = resolveParams(node, c);
    const videoUrl = need(str(p.videoUrl), 'URL de la vidéo manquante — reliez un nœud qui la fournit, ou écrivez {{ $json.video }}.');
    if (!/^https?:\/\//i.test(videoUrl)) throw new Error(`URL de vidéo invalide : « ${videoUrl.slice(0, 80)} » — http(s) requis.`);
    preflight(type, p);

    // Ces trois réseaux remettent simplement l'URL à leurs serveurs : pas besoin de récupérer les octets.
    if (type === 'videoInstagram') { out.push({ ...input[i], publication: await publishInstagram(p, videoUrl) }); continue; }
    if (type === 'videoFacebook') { out.push({ ...input[i], publication: await publishFacebook(p, videoUrl) }); continue; }
    if (type === 'videoTiktok') { out.push({ ...input[i], publication: await publishTiktok(p, videoUrl) }); continue; }

    const meta = await videoFetch(videoUrl);
    try {
      const result =
        type === 'videoYoutube' ? await publishYoutube(p, meta)
        : type === 'videoMastodon' ? await publishMastodon(p, meta)
        : type === 'videoBluesky' ? await publishBluesky(p, meta)
        : await publishX(p, meta);
      out.push({ ...input[i], publication: result });
    } finally {
      videoRelease(meta.id);
    }
  }
  return [out];
}
