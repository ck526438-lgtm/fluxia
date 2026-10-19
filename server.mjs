// FormatPro3 Workflow — relais local optionnel.
// Débloque les API qui refusent les appels navigateur (CORS) : Slack, Google Sheets, etc.
// Lancement : npm start  (ou PORT=5174 node server.mjs)
// Écoute uniquement sur 127.0.0.1 — aucun port exposé sur le réseau.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 5174);
const HOST = '127.0.0.1';
const MAX_BODY = 5 * 1024 * 1024;
const FETCH_TIMEOUT = 30_000;
const MAX_VIDEO = 200 * 1024 * 1024;
const VIDEO_FETCH_TIMEOUT = 180_000;
const UPLOAD_TIMEOUT = 300_000;
const VIDEO_TTL = 15 * 60 * 1000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Corps de requête trop volumineux (max 5 Mo)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function forward(url, { method = 'GET', headers = {}, body, timeout = FETCH_TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
    return { status: res.status, contentType: res.headers.get('content-type') ?? '', body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

const b64url = (input) => Buffer.from(input).toString('base64url');

// Échange un JWT signé (compte de service Google) contre un access token OAuth2.
async function googleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3000,
    iat: now,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  let signature;
  try {
    signature = signer.sign(privateKey.replace(/\\n/g, '\n'));
  } catch {
    throw new Error('Clé privée Google invalide — collez le champ « private_key » du fichier JSON du compte de service.');
  }
  const assertion = `${header}.${claims}.${signature.toString('base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`Google OAuth ${res.status} — ${json.error_description ?? json.error ?? 'réponse invalide'}`);
  }
  return json.access_token;
}

// ─── Vidéos : le relais récupère les octets puis les ré-expédie ───
// Un navigateur ne peut pas lire le contenu d'une URL vidéo arbitraire (CORS), et les
// API des réseaux l'acceptent encore moins : c'est donc ici que ça se passe.

const videoCache = new Map();

function videoCleanup() {
  const now = Date.now();
  for (const [id, v] of videoCache) if (v.expiresAt < now) videoCache.delete(id);
}
setInterval(videoCleanup, 60_000).unref();

function cachedVideo(id) {
  const v = videoCache.get(String(id));
  if (!v || v.expiresAt < Date.now()) {
    videoCache.delete(String(id));
    throw new Error('Vidéo expirée côté relais — relancez l’exécution du nœud.');
  }
  v.expiresAt = Date.now() + VIDEO_TTL;
  return v;
}

function filenameFromUrl(url) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
    return /^[\w. ()[-]{1,80}\.(mp4|mov|m4v|webm|avi|mkv|gif)$/i.test(name) ? name : 'video.mp4';
  } catch {
    return 'video.mp4';
  }
}

async function videoFetch(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VIDEO_FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur l’URL de la vidéo — vérifiez qu’elle est bien publique.`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_VIDEO) {
      throw new Error(`Vidéo trop lourde pour le relais : ${(declared / 1048576).toFixed(0)} Mo (max ${MAX_VIDEO / 1048576} Mo).`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length) throw new Error('La vidéo téléchargée fait 0 octet — l’URL ne pointe pas vers un fichier lisible.');
    const type = (res.headers.get('content-type') ?? '').split(';')[0] || 'video/mp4';
    // Garde-fou : une URL erronée renvoie souvent une page d'erreur HTML (status 200 quand même).
    if (type === 'text/html' || type === 'text/plain') {
      throw new Error(`L’URL ne renvoie pas une vidéo mais du ${type} — vérifiez le lien (il doit pointer directement sur le fichier .mp4/.mov/.webm…).`);
    }
    if (bytes.length > MAX_VIDEO) {
      throw new Error(`Vidéo trop lourde pour le relais : ${(bytes.length / 1048576).toFixed(0)} Mo (max ${MAX_VIDEO / 1048576} Mo).`);
    }
    videoCleanup();
    let held = 0;
    for (const v of videoCache.values()) held += v.bytes.length;
    if (held + bytes.length > MAX_VIDEO * 2) videoCache.clear();
    const entry = {
      bytes,
      contentType: type,
      filename: filenameFromUrl(url),
      expiresAt: Date.now() + VIDEO_TTL,
    };
    const id = crypto.randomUUID();
    videoCache.set(id, entry);
    return { id, size: bytes.length, contentType: type, filename: entry.filename };
  } finally {
    clearTimeout(timer);
  }
}

function multipartBody(boundary, fields, file) {
  const parts = [];
  for (const [name, value] of Object.entries(fields ?? {})) {
    if (value === undefined || value === null) continue;
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (file) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    ));
    parts.push(file.data, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'formatpro3-relais', version: 2, video: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/relay') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'JSON invalide' });
    }
    const target = String(payload?.url ?? '');
    if (!/^https?:\/\//i.test(target)) {
      return sendJson(res, 400, { error: 'URL invalide — http(s) requis' });
    }
    const method = String(payload?.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return sendJson(res, 400, { error: `Méthode non autorisée : ${method}` });
    }
    const headers = { ...(payload?.headers ?? {}) };
    delete headers.Host;
    delete headers.host;
    delete headers['content-length'];
    try {
      const out = await forward(target, { method, headers, body: payload?.body });
      return sendJson(res, 200, out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'échec réseau';
      return sendJson(res, 200, { status: 0, body: `Le relais n’a pas pu joindre la cible : ${msg}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/sheets-append') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'JSON invalide' });
    }
    const { clientEmail, privateKey, spreadsheetId, range, values } = payload ?? {};
    if (!clientEmail || !privateKey || !spreadsheetId || !range || !Array.isArray(values)) {
      return sendJson(res, 400, { error: 'Champs requis : clientEmail, privateKey, spreadsheetId, range, values' });
    }
    try {
      const token = await googleAccessToken(String(clientEmail), String(privateKey));
      const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(String(spreadsheetId))}/values/${encodeURIComponent(String(range))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const out = await forward(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 200, { status: 0, body: e instanceof Error ? e.message : 'échec Google Sheets' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/video/fetch') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'JSON invalide' });
    }
    const target = String(payload?.url ?? '');
    if (!/^https?:\/\//i.test(target)) return sendJson(res, 200, { ok: false, error: 'URL de vidéo invalide — http(s) requis.' });
    try {
      return sendJson(res, 200, { ok: true, ...(await videoFetch(target)) });
    } catch (e) {
      return sendJson(res, 200, { ok: false, error: e instanceof Error ? e.message : 'téléchargement impossible' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/video/multipart') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'JSON invalide' });
    }
    const target = String(payload?.url ?? '');
    if (!/^https?:\/\//i.test(target)) return sendJson(res, 200, { status: 0, body: 'URL cible invalide.' });
    try {
      const v = cachedVideo(payload?.id);
      // Tranche optionnelle : X envoie la vidéo segment par segment en multipart.
      let bytes = v.bytes;
      if (payload?.start !== undefined || payload?.end !== undefined) {
        const from = Math.max(0, Number(payload?.start ?? 0));
        const to = Math.min(v.bytes.length - 1, Number(payload?.end ?? v.bytes.length - 1));
        if (from > to) return sendJson(res, 200, { status: 0, body: 'Plage de tranches invalide.' });
        bytes = v.bytes.subarray(from, to + 1);
      }
      const boundary = `----FormatPro3${crypto.randomBytes(12).toString('hex')}`;
      const body = multipartBody(boundary, payload?.fields, {
        field: String(payload?.fileField ?? 'file'),
        filename: String(payload?.fileName ?? v.filename),
        type: String(payload?.fileType ?? v.contentType),
        data: bytes,
      });
      const out = await forward(target, {
        method: String(payload?.method ?? 'POST').toUpperCase(),
        headers: { ...(payload?.headers ?? {}), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
        timeout: UPLOAD_TIMEOUT,
      });
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 200, { status: 0, body: e instanceof Error ? e.message : 'échec upload' });
    }
  }

  // YouTube n'accepte pas du form-data : il veut un `multipart/related` dont la première
  // partie est le corps JSON et la seconde les octets de la vidéo.
  if (req.method === 'POST' && url.pathname === '/api/video/related') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'JSON invalide' });
    }
    const target = String(payload?.url ?? '');
    if (!/^https?:\/\//i.test(target)) return sendJson(res, 200, { status: 0, body: 'URL cible invalide.' });
    try {
      const v = cachedVideo(payload?.id);
      const boundary = `----FormatPro3${crypto.randomBytes(12).toString('hex')}`;
      const head = Buffer.concat(
        (Array.isArray(payload?.parts) ? payload.parts : []).map((p) => Buffer.from(
          `--${boundary}\r\nContent-Type: ${String(p?.contentType ?? 'application/json')}\r\n\r\n${String(p?.body ?? '')}\r\n`,
        )),
      );
      const fileHeader = Buffer.from(`--${boundary}\r\nContent-Type: ${String(payload?.fileType ?? v.contentType)}\r\n\r\n`);
      const body = Buffer.concat([head, fileHeader, v.bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      const out = await forward(target, {
        method: String(payload?.method ?? 'POST').toUpperCase(),
        headers: { ...(payload?.headers ?? {}), 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
        timeout: UPLOAD_TIMEOUT,
      });
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 200, { status: 0, body: e instanceof Error ? e.message : 'échec upload' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/video/chunk') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'JSON invalide' });
    }
    const target = String(payload?.url ?? '');
    if (!/^https?:\/\//i.test(target)) return sendJson(res, 200, { status: 0, body: 'URL cible invalide.' });
    try {
      const v = cachedVideo(payload?.id);
      const total = v.bytes.length;
      const from = Math.max(0, Number(payload?.start ?? 0));
      const to = Math.min(total - 1, Number(payload?.end ?? total - 1));
      if (from > to) return sendJson(res, 200, { status: 0, body: 'Plage de tranches invalide.' });
      const headers = { ...(payload?.headers ?? {}) };
      if (payload?.contentRange !== false) headers['Content-Range'] = `bytes ${from}-${to}/${total}`;
      const out = await forward(target, {
        method: String(payload?.method ?? 'PUT').toUpperCase(),
        headers,
        body: v.bytes.subarray(from, to + 1),
        timeout: UPLOAD_TIMEOUT,
      });
      return sendJson(res, 200, out);
    } catch (e) {
      return sendJson(res, 200, { status: 0, body: e instanceof Error ? e.message : 'échec upload' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/video/release') {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      payload = {};
    }
    videoCache.delete(String(payload?.id ?? ''));
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Route inconnue' });
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Interdit');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // Fallback SPA : toute route inconnue renvoie index.html.
      fs.readFile(path.join(DIST, 'index.html'), (err2, index) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end('Build introuvable — lancez « npm run build » puis relancez « npm start ».');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(index);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  void (async () => {
    try {
      if (req.url?.startsWith('/api/')) return await handleApi(req, res);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        return res.end();
      }
      return serveStatic(res, req.url ?? '/');
    } catch (e) {
      return sendJson(res, 500, { error: e instanceof Error ? e.message : 'Erreur interne' });
    }
  })();
});

server.listen(PORT, HOST, () => {
  console.log(`⚡ FormatPro3 Workflow relais local sur http://${HOST}:${PORT}`);
  console.log('   /api/relay         → transfère les appels bloqués par CORS (Slack, etc.)');
  console.log('   /api/sheets-append → Google Sheets via compte de service');
  console.log('   /api/video/*       → récupère une vidéo par URL et l’upload (YouTube, X, Mastodon, Bluesky…)');
  console.log('   dist/ servi en statique (lancez « npm run build » pour la prod)');
});
