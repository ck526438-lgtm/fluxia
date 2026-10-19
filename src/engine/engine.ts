import { getDef } from '../data/catalog';
import type { FlowNode, FlowNodeData, Item, RunRecord } from '../types';
import { defaultCtx, resolveDeep, resolveString, type ExprContext } from './expressions';
import { hasRelay, relayFetch } from './relay';
import { runVideoNode } from './video';

export interface EngineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface EngineHooks {
  onNodeStart: (nodeId: string) => void;
  onNodeFinish: (rec: RunRecord) => void;
  onEdgeActive: (edgeId: string, active: boolean) => void;
  onEdgeDone: (edgeId: string) => void;
  shouldAbort: () => boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function topoOrder(nodes: FlowNode[], edges: EngineEdge[]): { order: FlowNode[]; cycle: boolean } {
  const ids = new Set(nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const order: FlowNode[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const t of adj.get(n.id) ?? []) {
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(nodes.find((x) => x.id === t)!);
    }
  }
  return { order, cycle: order.length !== nodes.length };
}

// ─────────────────────────── Helpers ───────────────────────────

function param<T = unknown>(node: FlowNode, key: string, fallback: T): T {
  const v = node.data.params?.[key];
  return (v === undefined || v === null || v === '' ? fallback : v) as T;
}

function resolveAll(node: FlowNode, ctx: ExprContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.data.params ?? {})) out[k] = resolveDeep(v, ctx);
  return out;
}

function parseJsonSafe(text: unknown, fallback: unknown = {}): unknown {
  if (typeof text !== 'string') return text ?? fallback;
  const t = text.trim();
  if (!t) return fallback;
  try {
    return JSON.parse(t);
  } catch {
    return fallback;
  }
}

function kvToEntries(kv: unknown): { key: string; value: unknown }[] {
  if (Array.isArray(kv)) return kv.filter((r) => r && typeof r === 'object') as { key: string; value: unknown }[];
  return [];
}

function firstInput(input: Item[]): Item {
  return input[0] ?? {};
}

function isNumeric(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return s !== '' && !isNaN(Number(s));
}

function compare(a: unknown, op: string, b: unknown): boolean {
  const na = Number(a);
  const nb = Number(b);
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  switch (op) {
    case 'equals': return isNumeric(a) && isNumeric(b) ? na === nb : sa === sb;
    case 'notEquals': return !compare(a, 'equals', b);
    case 'gt': return !isNaN(na) && !isNaN(nb) && na > nb;
    case 'lt': return !isNaN(na) && !isNaN(nb) && na < nb;
    case 'contains': return sa.toLowerCase().includes(sb.toLowerCase());
    case 'notContains': return !sa.toLowerCase().includes(sb.toLowerCase());
    case 'startsWith': return sa.toLowerCase().startsWith(sb.toLowerCase());
    case 'endsWith': return sa.toLowerCase().endsWith(sb.toLowerCase());
    case 'notEmpty': return a !== undefined && a !== null && sa !== '';
    case 'empty': return a === undefined || a === null || sa === '';
    default: return false;
  }
}

async function openaiChat(opts: {
  apiKey: string; baseUrl: string; model: string; system: string; user: string;
}): Promise<string> {
  const base = (opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status} — ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? '';
}

function localSummary(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 12);
  if (sentences.length <= 2) return text.slice(0, 220);
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? []) freq.set(w, (freq.get(w) ?? 0) + 1);
  const ranked = sentences
    .map((s, i) => {
      const words = s.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? [];
      const score = words.reduce((acc, w) => acc + (freq.get(w) ?? 0), 0) / Math.max(1, words.length);
      return { s, i, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.i - b.i);
  return ranked.map((r) => r.s.trim()).join(' ');
}

const POS = ['bien', 'super', 'excellent', 'parfait', 'génial', 'rapide', 'merci', 'satisfait', 'top', 'recommande', 'great', 'good', 'amazing', 'love', 'excellent'];
const NEG = ['mauvais', 'lent', 'bug', 'problème', 'cher', 'déçu', 'nul', 'panne', 'erreur', 'jamais', 'bad', 'slow', 'broken', 'terrible', 'hate'];

function localSentiment(text: string): { sentiment: string; score: number } {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of POS) if (t.includes(w)) score += 1;
  for (const w of NEG) if (t.includes(w)) score -= 1;
  const sentiment = score > 0 ? 'positif' : score < 0 ? 'négatif' : 'neutre';
  return { sentiment, score: Math.max(-1, Math.min(1, score / 3)) };
}

const DICT_EN_FR: Record<string, string> = {
  hello: 'bonjour', world: 'monde', order: 'commande', customer: 'client', invoice: 'facture',
  payment: 'paiement', urgent: 'urgent', report: 'rapport', data: 'données', message: 'message',
  thanks: 'merci', please: "s'il vous plaît", new: 'nouveau', error: 'erreur', success: 'succès',
};

function localTranslate(text: string, target: string): string {
  const dict = target === 'fr' ? DICT_EN_FR : Object.fromEntries(Object.entries(DICT_EN_FR).map(([k, v]) => [v, k]));
  return text
    .split(/(\b)/)
    .map((tok) => dict[tok.toLowerCase()] ?? tok)
    .join('');
}

function extractFields(text: string, keys: { key: string; value: unknown }[]): Item {
  const out: Item = {};
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  const phone = text.match(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
  const amount = text.match(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s?(?:€|EUR|euros?)/i);
  for (const k of keys) {
    const key = String(k.key ?? '').toLowerCase();
    if (!key) continue;
    if (email && key.includes('mail')) out[k.key] = email[0];
    else if (phone && (key.includes('tel') || key.includes('phone'))) out[k.key] = phone[0].replace(/\s+/g, ' ');
    else if (amount && (key.includes('montant') || key.includes('amount') || key.includes('prix'))) out[k.key] = parseFloat(amount[1].replace(/\s/g, '').replace(',', '.'));
    else out[k.key] = null;
  }
  return out;
}

// ─────────────────────────── Exécuteurs ───────────────────────────

async function digest(algo: string, text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}
function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function runNodeCore(
  node: FlowNode,
  input: Item[],
  byLabel: Record<string, Item[]>,
  creds?: Record<string, string>,
): Promise<Item[][]> {
  const def = getDef(node.data.defType);
  const ctx: ExprContext = { json: firstInput(input), index: 0, items: input, byLabel, now: new Date(), creds };
  const P = (key: string, fallback: unknown = '') => param(node, key, fallback);

  switch (node.data.defType) {
    case 'manualTrigger': {
      const sample = parseJsonSafe(param(node, 'sample', '{}'), {});
      return [[typeof sample === 'object' && sample !== null ? (sample as Item) : { valeur: sample }]];
    }
    case 'scheduleTrigger':
      return [[{
        declencheLe: new Date().toISOString(),
        frequence: P('interval', 'hours'),
        cron: P('cron', ''),
        source: 'planificateur',
      }]];
    case 'webhookTrigger': {
      const sample = parseJsonSafe(param(node, 'sample', '{}'), {});
      return [[{
        ...(typeof sample === 'object' && sample !== null ? sample : { valeur: sample }),
        _webhook: { methode: P('method', 'POST'), chemin: `/${P('path', 'webhook')}`, recuLe: new Date().toISOString() },
      }]];
    }
    case 'formTrigger': {
      const data: Item = {};
      for (const f of kvToEntries(node.data.params?.fields)) data[String(f.key)] = f.value;
      return [[{ ...data, formulaire: P('formName', 'Formulaire'), soumisLe: new Date().toISOString() }]];
    }

    case 'httpRequest': {
      const method = String(P('method', 'GET')).toUpperCase();
      const url = String(resolveString(String(P('url', '')), ctx) ?? '');
      if (!url) throw new Error('URL manquante');
      const headers: Record<string, string> = {};
      for (const h of kvToEntries(node.data.params?.headers)) {
        const k = String(resolveString(String(h.key), ctx) ?? '');
        if (k) headers[k] = String(resolveString(String(h.value ?? ''), ctx) ?? '');
      }
      let body: string | undefined;
      const rawBody = String(node.data.params?.body ?? '');
      if (rawBody.trim() && method !== 'GET') {
        const resolvedBody = resolveDeep(parseJsonSafe(rawBody, rawBody), ctx);
        body = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
        if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        let status: number;
        let text: string;
        try {
          const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
          status = res.status;
          text = await res.text();
        } catch (e) {
          if ((e as Error).name === 'AbortError') throw new Error('Délai dépassé (20 s) — l’API n’a pas répondu.');
          if (await hasRelay()) {
            const r = await relayFetch(url, { method, headers, body });
            status = r.status;
            text = r.body;
          } else {
            throw new Error('Requête bloquée par le navigateur (CORS ou réseau) : cette API n’autorise pas les appels directs. Lancez le relais local (« npm start » Ã  la racine du projet) pour la débloquer.');
          }
        }
        let data: unknown = text;
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          try { data = JSON.parse(text); } catch { /* garde le texte brut */ }
        }
        if (status >= 400) throw new Error(`HTTP ${status} — ${text.slice(0, 160)}`);
        if (Array.isArray(data)) return [(data as Item[]).map((d) => (typeof d === 'object' && d !== null ? (d as Item) : { valeur: d }))];
        if (typeof data === 'object' && data !== null) return [[data as Item]];
        return [[{ reponse: data }]];
      } finally {
        clearTimeout(timer);
      }
    }

    case 'emailSend': {
      const out: Item[] = [];
      for (let i = 0; i < input.length; i++) {
        const c: ExprContext = { ...ctx, json: input[i], index: i };
        const resolved = resolveAll(node, c);
        const apiKey = String(resolved.apiKey ?? '').trim();
        const from = String(resolved.from ?? '').trim();
        const to = String(resolved.to ?? '').trim();
        if (!apiKey) throw new Error('Clé API Brevo manquante — créez-en une sur app.brevo.com (SMTP & API → Clés API) puis collez-la dans le nœud.');
        if (!from) throw new Error('Expéditeur manquant — renseignez une adresse validée dans Brevo (champ « Expéditeur »).');
        if (!to) throw new Error('Destinataire manquant — vérifiez le champ « Destinataire » (ex. {{ $json.email }}).');
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sender: { email: from },
            to: [{ email: to }],
            subject: String(resolved.subject ?? ''),
            textContent: String(resolved.text ?? ''),
          }),
        });
        const text = await res.text();
        let json: { messageId?: string; message?: string } | null = null;
        try { json = JSON.parse(text); } catch { /* réponse non JSON */ }
        if (!res.ok) throw new Error(`Brevo ${res.status} — ${json?.message ?? text.slice(0, 160)}`);
        out.push({ ...input[i], emailEnvoye: true, messageId: json?.messageId ?? null, destinataire: to, envoyeLe: new Date().toISOString() });
      }
      return [out];
    }
    case 'slackMessage': {
      if (!(await hasRelay())) {
        throw new Error('Slack bloque les appels directs du navigateur (CORS). Lancez le relais local : « npm start » Ã  la racine du projet, puis relancez le flux.');
      }
      const out: Item[] = [];
      for (let i = 0; i < input.length; i++) {
        const c: ExprContext = { ...ctx, json: input[i], index: i };
        const resolved = resolveAll(node, c);
        const url = String(resolved.webhookUrl ?? '').trim();
        if (!/^https:\/\/hooks\.slack\.com\/services\//.test(url)) {
          throw new Error('URL de webhook Slack invalide — api.slack.com/messaging/webhooks → « Copy webhook URL ».');
        }
        const r = await relayFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: String(resolved.text ?? '') }),
        });
        if (r.status >= 400 || r.status === 0) throw new Error(`Slack ${r.status || 'réseau'} — ${r.body.slice(0, 160)}`);
        out.push({ ...input[i], slack: { statut: 'envoyé', envoyeLe: new Date().toISOString() } });
      }
      return [out];
    }
    case 'discordMessage': {
      const out: Item[] = [];
      for (let i = 0; i < input.length; i++) {
        const c: ExprContext = { ...ctx, json: input[i], index: i };
        const resolved = resolveAll(node, c);
        const url = String(resolved.webhookUrl ?? '').trim();
        if (!/^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\//.test(url)) {
          throw new Error('URL de webhook Discord invalide — Paramètres du serveur → Intégrations → Webhooks → « Copier l’URL du webhook ».');
        }
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: String(resolved.content ?? '') }),
        });
        if (!res.ok) throw new Error(`Discord ${res.status} — ${(await res.text()).slice(0, 160)}`);
        out.push({ ...input[i], discord: { statut: 'envoyé', envoyeLe: new Date().toISOString() } });
      }
      return [out];
    }
    case 'telegramMessage': {
      const out: Item[] = [];
      for (let i = 0; i < input.length; i++) {
        const c: ExprContext = { ...ctx, json: input[i], index: i };
        const resolved = resolveAll(node, c);
        const token = String(resolved.botToken ?? '').trim();
        const chatId = String(resolved.chatId ?? '').trim();
        if (!token || !chatId) throw new Error('Jeton du bot ou ID de conversation manquant — créez un bot via @BotFather puis récupérez le chat ID (ex. via @userinfobot).');
        // Content-Type text/plain : requête « simple » sans préflight CORS, réponse lisible.
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ chat_id: chatId, text: String(resolved.text ?? '') }),
        });
        const text = await res.text();
        let json: { ok?: boolean; description?: string; result?: { message_id?: number } } | null = null;
        try { json = JSON.parse(text); } catch { /* réponse non JSON */ }
        if (!res.ok || !json?.ok) throw new Error(`Telegram ${res.status} — ${json?.description ?? text.slice(0, 160)}`);
        out.push({ ...input[i], telegram: { statut: 'envoyé', messageId: json.result?.message_id ?? null, envoyeLe: new Date().toISOString() } });
      }
      return [out];
    }
    case 'csvExport': {
      const resolved = resolveAll(node, ctx);
      const sep = String(resolved.separator ?? ';');
      const cols: string[] = [];
      const seen = new Set<string>();
      for (const item of input) {
        for (const k of Object.keys(item)) if (!seen.has(k)) { seen.add(k); cols.push(k); }
      }
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return /["\r\n;,]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      };
      const lines = [cols.map(esc).join(sep), ...input.map((it) => cols.map((c) => esc(it[c])).join(sep))];
      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const raw = String(resolved.filename ?? 'export.csv').replace(/[\\/:*?"<>|]/g, '-').trim() || 'export.csv';
      const name = raw.endsWith('.csv') ? raw : `${raw}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return [[{ fichier: name, colonnes: cols, lignes: input.length, octets: blob.size }]];
    }
    case 'notification': {
      const resolved = resolveAll(node, ctx);
      if (typeof Notification === 'undefined') throw new Error('Ce navigateur ne prend pas en charge les notifications de bureau.');
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications refusées — autorisez les notifications pour ce site dans les paramètres du navigateur.');
      const title = String(resolved.title ?? 'FormatPro3') || 'FormatPro3';
      const body = String(resolved.body ?? '');
      const notif = new Notification(title, { body });
      notif.onclick = () => { window.focus(); notif.close(); };
      return [input.map((item) => ({ ...item, notification: { titre: title, afficheeLe: new Date().toISOString() } }))];
    }
    case 'sheetsAppend': {
      const resolved = resolveAll(node, ctx);
      const clientEmail = String(resolved.serviceAccountEmail ?? '').trim();
      const privateKey = String(resolved.privateKey ?? '').trim();
      const spreadsheetId = String(resolved.spreadsheetId ?? '').trim();
      const range = String(resolved.range ?? '').trim() || 'Feuille 1!A1';
      if (!clientEmail) throw new Error('Email du compte de service manquant — Google Cloud → « Comptes de service » → créez-en un, puis partagez le classeur avec son adresse (rôle Éditeur).');
      if (!privateKey) throw new Error('Clé privée manquante — dans le fichier JSON du compte de service, copiez la valeur du champ « private_key ».');
      if (!/^[\w-]{20,}$/.test(spreadsheetId)) throw new Error('ID de classeur invalide — copiez l’identifiant long de l’URL du classeur (entre /d/ et /edit).');
      if (!(await hasRelay())) {
        throw new Error('Google Sheets exige une signature côté serveur (CORS). Lancez le relais local : « npm start » Ã  la racine du projet, puis relancez le flux.');
      }
      const row = kvToEntries(resolved.values).map((f) => String(f.value ?? ''));
      const res = await fetch('/api/sheets-append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail, privateKey, spreadsheetId, range, values: [row] }),
      });
      const json = (await res.json().catch(() => null)) as { status?: number; body?: string; error?: string } | null;
      if (!res.ok) throw new Error(String(json?.error ?? `Relais ${res.status}`));
      let inner: { updates?: { updatedRange?: string } } | null = null;
      if (json && typeof json.body === 'string') {
        try { inner = JSON.parse(json.body) as { updates?: { updatedRange?: string } }; } catch { /* corps non JSON */ }
      }
      if (!json || json.status === undefined || json.status === 0 || json.status >= 400) {
        throw new Error(`Google Sheets ${json?.status || 'réseau'} — ${String(json?.body ?? '').slice(0, 160)}`);
      }
      return [[{
        classeur: spreadsheetId,
        feuille: range.split('!')[0] ?? range,
        ligneAjoutee: row,
        plageMiseAJour: inner?.updates?.updatedRange ?? null,
      }]];
    }
    case 'notionCreate': {
      const out: Item[] = [];
      for (let i = 0; i < input.length; i++) {
        const c: ExprContext = { ...ctx, json: input[i], index: i };
        const resolved = resolveAll(node, c);
        const token = String(resolved.integrationToken ?? '').trim();
        const databaseId = String(resolved.databaseId ?? '').trim().replace(/-/g, '');
        if (!token) throw new Error('Jeton d’intégration Notion manquant — notion.so/my-integrations → « Nouvelle intégration », puis connectez la base à cette intégration.');
        if (!/^[0-9a-f]{32}$/i.test(databaseId)) throw new Error('ID de base Notion invalide — copiez les 32 caractères de l’identifiant dans l’URL de la base.');
        const titleProp = String(resolved.titleProperty ?? '').trim() || 'Name';
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: { type: 'database_id', database_id: databaseId },
            properties: { [titleProp]: { title: [{ text: { content: String(resolved.title ?? '') } }] } },
            children: [{
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: String(resolved.content ?? '') } }] },
            }],
          }),
        });
        const text = await res.text();
        let json: { id?: string; url?: string; message?: string } | null = null;
        try { json = JSON.parse(text); } catch { /* réponse non JSON */ }
        if (!res.ok) throw new Error(`Notion ${res.status} — ${json?.message ?? text.slice(0, 160)}`);
        out.push({ ...input[i], notion: { pageId: json?.id ?? null, url: json?.url ?? null, creeLe: new Date().toISOString() } });
      }
      return [out];
    }

    case 'if': {
      const t: Item[] = [], f: Item[] = [];
      input.forEach((item, i) => {
        const c: ExprContext = { ...ctx, json: item, index: i };
        const left = resolveString(String(node.data.params?.left ?? ''), c);
        const right = resolveString(String(node.data.params?.right ?? ''), c);
        (compare(left, String(node.data.params?.operator ?? 'equals'), right) ? t : f).push(item);
      });
      return [t, f];
    }
    case 'switch': {
      const ports: Item[][] = [[], [], []];
      input.forEach((item, i) => {
        const c: ExprContext = { ...ctx, json: item, index: i };
        const value = String(resolveString(String(node.data.params?.value ?? ''), c) ?? '');
        const c1 = String(resolveString(String(node.data.params?.case1 ?? ''), c) ?? '');
        const c2 = String(resolveString(String(node.data.params?.case2 ?? ''), c) ?? '');
        if (value === c1) ports[0].push(item);
        else if (value === c2) ports[1].push(item);
        else ports[2].push(item);
      });
      return ports;
    }
    case 'merge': {
      const groups = inputGroups.get(node.id) ?? [input];
      if (String(node.data.params?.mode ?? 'append') === 'index') {
        const max = Math.max(0, ...groups.map((g) => g.length));
        const out: Item[] = [];
        for (let i = 0; i < max; i++) {
          const merged: Item = {};
          for (const g of groups) if (g[i]) Object.assign(merged, g[i]);
          out.push(merged);
        }
        return [out];
      }
      return [input];
    }
    case 'wait': {
      const secs = Math.min(15, Math.max(0, Number(param(node, 'seconds', 1))));
      await sleep(secs * 1000);
      return [input];
    }
    case 'filter': {
      const out = input.filter((item, i) => {
        const c: ExprContext = { ...ctx, json: item, index: i };
        const left = resolveString(String(node.data.params?.left ?? ''), c);
        const right = resolveString(String(node.data.params?.right ?? ''), c);
        return compare(left, String(node.data.params?.operator ?? 'equals'), right);
      });
      return [out];
    }
    case 'limit':
      return [input.slice(0, Math.max(0, Number(param(node, 'max', 5))))];

    case 'set': {
      const keepOnly = Boolean(node.data.params?.keepOnly);
      const out = input.map((item, i) => {
        const c: ExprContext = { ...ctx, json: item, index: i };
        const fields: Item = {};
        for (const f of kvToEntries(node.data.params?.fields)) {
          if (!f.key) continue;
          fields[String(f.key)] = resolveDeep(f.value, c);
        }
        return keepOnly ? fields : { ...item, ...fields };
      });
      return [out];
    }
    case 'code': {
      const code = String(param(node, 'code', 'return items;'));
      // eslint-disable-next-line no-new-func
      const fn = new Function('items', '$input', '$json', '$index', '$now', `"use strict";\n${code}\n`);
      const raw = fn(input, { all: () => input }, firstInput(input), 0, new Date());
      if (raw === undefined) return [[{ resultat: null }]];
      if (!Array.isArray(raw)) return [[typeof raw === 'object' ? (raw as Item) : { resultat: raw }]];
      return [raw.map((r) => (r && typeof r === 'object' && 'json' in r && Object.keys(r).length === 1 ? (r as { json: Item }).json : r) as Item)];
    }
    case 'splitOut': {
      const field = String(param(node, 'field', ''));
      const out: Item[] = [];
      for (const item of input) {
        const v = item[field];
        if (Array.isArray(v)) {
          for (const el of v) out.push(el !== null && typeof el === 'object' && !Array.isArray(el) ? { ...item, ...(el as Item) } : { ...item, [field]: el });
        } else out.push(item);
      }
      return [out];
    }
    case 'aggregate': {
      const mode = String(param(node, 'mode', 'count'));
      const field = String(param(node, 'field', ''));
      if (mode === 'count') return [[{ nombre: input.length }]];
      if (mode === 'collect') return [[{ elements: input }]];
      const total = input.reduce((acc, it) => acc + (Number(it[field]) || 0), 0);
      return [[{ champ: field, somme: total, nombre: input.length }]];
    }
    case 'dateTime': {
      const mode = String(param(node, 'mode', 'now'));
      const target = String(param(node, 'target', 'date'));
      const unit = String(param(node, 'unit', 'days'));
      const amount = Number(param(node, 'amount', 1));
      return [input.map((item) => {
        const d = new Date();
        if (mode === 'shift') {
          const ms = unit === 'minutes' ? 60000 : unit === 'hours' ? 3600000 : 86400000;
          d.setTime(d.getTime() + amount * ms);
        }
        return { ...item, [target]: d.toISOString() };
      })];
    }
    case 'crypto': {
      const field = String(param(node, 'field', ''));
      const target = String(param(node, 'target', 'hash'));
      const algo = String(param(node, 'algorithm', 'SHA-256'));
      const out: Item[] = [];
      for (const item of input) {
        const source = String(item[field] ?? '');
        let result: string;
        if (algo === 'Base64') result = toBase64(source);
        else if (algo === 'Hexadécimal') result = toHex(source);
        else result = await digest(algo, source);
        out.push({ ...item, [target]: result });
      }
      return [out];
    }
    case 'jsonParse': {
      const field = String(param(node, 'field', ''));
      return [input.map((item) => {
        const parsed = parseJsonSafe(item[field], null);
        return parsed === null ? { ...item, _erreurParse: true } : { ...item, [field]: parsed };
      })];
    }
    case 'removeDuplicates': {
      const field = String(param(node, 'field', ''));
      const seen = new Set<string>();
      const out = input.filter((item) => {
        const key = JSON.stringify(field ? item[field] : item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return [out];
    }
    case 'sort': {
      const field = String(param(node, 'field', ''));
      const dir = String(param(node, 'order', 'asc')) === 'asc' ? 1 : -1;
      const sorted = [...input].sort((a, b) => {
        const va = a[field], vb = b[field];
        const na = Number(va), nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '') return (na - nb) * dir;
        return String(va ?? '').localeCompare(String(vb ?? ''), 'fr') * dir;
      });
      return [sorted];
    }
    case 'noOp':
      return [input];

    case 'aiSummarize': {
      const resolved = resolveAll(node, ctx);
      const text = String(resolved.text ?? '');
      const provider = String(resolved.provider ?? 'local');
      let resume: string;
      if (provider === 'openai' && resolved.apiKey) {
        resume = await openaiChat({
          apiKey: String(resolved.apiKey), baseUrl: 'https://api.openai.com/v1',
          model: String(resolved.model ?? 'gpt-4o-mini'),
          system: 'Tu résumes en français, de façon concise et fidèle.',
          user: text,
        });
      } else {
        resume = localSummary(text);
      }
      const words = text.toLowerCase().match(/[a-zà-ÿ]{5,}/g) ?? [];
      const freq = new Map<string, number>();
      for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
      const motsCles = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
      return [input.map((item) => ({ ...item, resume, motsCles, moteur: provider === 'openai' && resolved.apiKey ? 'openai' : 'local' }))];
    }
    case 'aiSentiment': {
      const resolved = resolveAll(node, ctx);
      const text = String(resolved.text ?? '');
      const s = localSentiment(text);
      return [input.map((item) => ({ ...item, ...s, analyse: 'lexicale' }))];
    }
    case 'aiClassify': {
      const resolved = resolveAll(node, ctx);
      const text = String(resolved.text ?? '').toLowerCase();
      const cats = kvToEntries(resolved.categories);
      let best = 'non classé', bestScore = 0;
      for (const c of cats) {
        const words = String(c.value ?? '').toLowerCase().split(',').map((w) => w.trim()).filter(Boolean);
        const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; best = String(c.key); }
      }
      return [input.map((item) => ({ ...item, categorie: best, confiance: cats.length ? Math.min(1, bestScore / 2) : 0 }))];
    }
    case 'aiChat': {
      const resolved = resolveAll(node, ctx);
      const target = String(resolved.target || 'reponse');
      const prompt = String(resolved.preset ?? '');
      let text: string;
      if (String(resolved.provider) === 'openai' && resolved.apiKey) {
        text = await openaiChat({
          apiKey: String(resolved.apiKey), baseUrl: String(resolved.baseUrl ?? ''),
          model: String(resolved.model ?? 'gpt-4o-mini'),
          system: 'Tu es un assistant qui répond en français, avec concision.',
          user: prompt,
        });
      } else {
        text = `Consigne traitée localement : « ${prompt.slice(0, 140)} »\n\nProposition : ${prompt.slice(0, 60)}… adaptée aux données fournies (${JSON.stringify(firstInput(input)).slice(0, 80)}). Renseignez une clé API OpenAI dans les paramètres pour une génération réelle.`;
      }
      return [input.map((item) => ({ ...item, [target]: text }))];
    }
    case 'aiAgent': {
      const resolved = resolveAll(node, ctx);
      const target = String(resolved.target || 'plan');
      const first = firstInput(input);
      const amount = Number(first.montant ?? first.amount ?? NaN);
      const urgency = (!isNaN(amount) && amount > 1000) || /urgent|panne|critique/i.test(JSON.stringify(first)) ? 'haute' : 'normale';
      const plan = {
        objectif: String(resolved.goal ?? '').slice(0, 120),
        priorite: urgency,
        etapes: urgency === 'haute'
          ? ['Vérifier les informations client', 'Escalader au responsable sous 1 h', 'Notifier le client']
          : ['Qualifier la demande', 'Programmer une relance', 'Archiver dans le CRM'],
        confiance: urgency === 'haute' ? 0.86 : 0.72,
      };
      return [input.map((item) => ({ ...item, [target]: plan }))];
    }
    case 'aiExtract': {
      const resolved = resolveAll(node, ctx);
      const text = String(resolved.text ?? '');
      const keys = kvToEntries(resolved.keys).map((k) => ({ ...k, value: resolveDeep(k.value, ctx) }));
      return [[extractFields(text, keys)]];
    }
    case 'aiTranslate': {
      const resolved = resolveAll(node, ctx);
      const text = String(resolved.text ?? '');
      const target = String(resolved.target_lang ?? 'en');
      return [input.map((item) => ({ ...item, traduction: localTranslate(text, target), langue: target }))];
    }
    default: {
      const published = await runVideoNode(node, input, ctx);
      if (published) return published;
      return [input];
    }
  }
}

// Partage des groupes d'entrée par nœud (pour le mode « index » de Fusionner)
const inputGroups = new Map<string, Item[][]>();

async function runNode(
  node: FlowNode,
  groups: Item[][],
  byLabel: Record<string, Item[]>,
  creds?: Record<string, string>,
): Promise<Item[][]> {
  inputGroups.set(node.id, groups);
  const flat = groups.flat();
  try {
    return await runNodeCore(node, flat, byLabel, creds);
  } finally {
    inputGroups.delete(node.id);
  }
}

// ─────────────────────────── Orchestrateur ───────────────────────────

export interface ExecuteOptions {
  nodes: FlowNode[];
  edges: EngineEdge[];
  hooks: EngineHooks;
  minNodeMs: number;
  flowMs: number;
  creds?: Record<string, string>;
}

export async function executeWorkflow({ nodes, edges, hooks, minNodeMs, flowMs, creds }: ExecuteOptions): Promise<void> {
  const active = nodes.filter((n) => !n.data.disabled && getDef(n.data.defType).category !== 'note');
  const activeIds = new Set(active.map((n) => n.id));
  const cleanEdges = edges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));

  const { order, cycle } = topoOrder(active, cleanEdges);
  if (cycle) throw new Error('Boucle détectée dans le flux — impossible de déterminer l’ordre d’exécution.');

  const byLabel: Record<string, Item[]> = {};
  const inbox = new Map<string, { edgeId: string; items: Item[] }[]>();
  const deliveredEdges = new Set<string>();
  const resolved = new Set<string>();
  const executed = new Set<string>();
  const outEdges = new Map<string, EngineEdge[]>();
  const inEdges = new Map<string, EngineEdge[]>();
  for (const e of cleanEdges) {
    outEdges.set(e.source, [...(outEdges.get(e.source) ?? []), e]);
    inEdges.set(e.target, [...(inEdges.get(e.target) ?? []), e]);
  }

  for (const node of order) {
    if (hooks.shouldAbort()) return;
    const def = getDef(node.data.defType);
    const incoming = inEdges.get(node.id) ?? [];
    const groups = (inbox.get(node.id) ?? []).map((g) => g.items);

    const isRoot = incoming.length === 0;
    const hasDeliveredInput = incoming.some((e) => deliveredEdges.has(e.id));

    if (isRoot && def.category !== 'trigger') {
      hooks.onNodeFinish({ nodeId: node.id, status: 'skipped', input: [], output: [], durationMs: 0, startedAt: Date.now() });
      resolved.add(node.id);
      continue;
    }
    if (!isRoot && !hasDeliveredInput) {
      hooks.onNodeFinish({ nodeId: node.id, status: 'skipped', input: [], output: [], durationMs: 0, startedAt: Date.now() });
      resolved.add(node.id);
      continue;
    }

    const startedAt = Date.now();
    const input = groups.flat();
    hooks.onNodeStart(node.id);
    try {
      const t0 = performance.now();
      const ports = await runNode(node, groups.length ? groups : [[]], byLabel, creds);
      const elapsed = performance.now() - t0;
      if (elapsed < minNodeMs) await sleep(minNodeMs - elapsed);
      if (hooks.shouldAbort()) return;

      const output = ports.flat();
      hooks.onNodeFinish({
        nodeId: node.id, status: 'success', input, output,
        durationMs: Date.now() - startedAt, startedAt,
      });
      resolved.add(node.id);
      executed.add(node.id);

      const label = node.data.label || def.label;
      byLabel[label] = [...(byLabel[label] ?? []), ...output];

      const outs = outEdges.get(node.id) ?? [];
      for (const edge of outs) {
        const portIdx = edge.sourceHandle?.startsWith('out-') ? Number(edge.sourceHandle.slice(4)) : 0;
        const items = ports[portIdx] ?? (portIdx === 0 ? output : []);
        if (!items || items.length === 0) continue;
        inbox.set(edge.target, [...(inbox.get(edge.target) ?? []), { edgeId: edge.id, items }]);
        deliveredEdges.add(edge.id);
        hooks.onEdgeActive(edge.id, true);
        await sleep(flowMs);
        hooks.onEdgeActive(edge.id, false);
        hooks.onEdgeDone(edge.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      hooks.onNodeFinish({
        nodeId: node.id, status: 'error', input, output: [], error: message,
        durationMs: Date.now() - startedAt, startedAt,
      });
      resolved.add(node.id);
      throw err;
    }
  }
}
