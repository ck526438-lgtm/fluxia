// Fluxia — relais local optionnel.
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

async function forward(url, { method = 'GET', headers = {}, body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
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

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'fluxia-relais', version: 1 });
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
  console.log(`⚡ Fluxia relais local sur http://${HOST}:${PORT}`);
  console.log('   /api/relay         → transfère les appels bloqués par CORS (Slack, etc.)');
  console.log('   /api/sheets-append → Google Sheets via compte de service');
  console.log('   dist/ servi en statique (lancez « npm run build » pour la prod)');
});
