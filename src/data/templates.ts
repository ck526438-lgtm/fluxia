import type { Edge, FlowNode, Template } from '../types';
import { defaultParams, getDef } from './catalog';

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

function n(defType: string, x: number, y: number, params?: Record<string, unknown>, label?: string): FlowNode {
  const def = getDef(defType);
  return {
    id: uid('n'),
    type: 'flux',
    position: { x, y },
    data: { defType, label: label ?? def.label, params: { ...defaultParams(defType), ...(params ?? {}) } },
  };
}

function e(source: FlowNode, target: FlowNode, sourcePort = 0, targetPort = 0): Edge {
  return {
    id: uid('e'),
    source: source.id,
    target: target.id,
    sourceHandle: `out-${sourcePort}`,
    targetHandle: `in-${targetPort}`,
    type: 'flux',
  };
}

export const TEMPLATES: Template[] = [
  {
    id: 'veille-api',
    name: 'Veille API → CSV',
    description: 'Récupère des tâches depuis une API publique, nettoie les champs et exporte un fichier CSV téléchargeable.',
    badges: ['API réelle', 'Fichier CSV'],
    build: () => {
      const trigger = n('scheduleTrigger', 0, 60, { interval: 'hours', cron: '0 * * * *' });
      const http = n('httpRequest', 340, 60, {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos?_limit=5',
      });
      const set = n('set', 680, 60, {
        keepOnly: true,
        fields: [
          { key: 'titre', value: '{{ $json.title }}' },
          { key: 'etat', value: '{{ $json.completed ? "terminé" : "en cours" }}' },
          { key: 'responsable', value: 'équipe #{{ $json.userId }}' },
        ],
      });
      const csv = n('csvExport', 1020, 60, { filename: 'veille-api.csv' }, 'Export CSV');
      return {
        nodes: [trigger, http, set, csv],
        edges: [e(trigger, http), e(http, set), e(set, csv)],
      };
    },
  },
  {
    id: 'triage-leads',
    name: 'Triage de leads par IA',
    description: 'Un formulaire entre, l’IA classe la demande, l’aiguillage route vers l’équipe concernée (emails réels via Brevo) ou l’archive en CSV. Nécessite une clé API Brevo.',
    badges: ['Branchements', 'Clé Brevo requise'],
    build: () => {
      const form = n('formTrigger', 0, 140, {
        formName: 'Contact commercial',
        fields: [
          { key: 'email', value: 'jean.dupont@acme.fr' },
          { key: 'message', value: 'Bonjour, nous avons un bug urgent bloquant la production.' },
        ],
      });
      const classify = n('aiClassify', 340, 140, {
        text: '{{ $json.message }}',
        categories: [
          { key: 'urgent', value: 'urgent, bug, panne, bloqué, critique' },
          { key: 'commercial', value: 'prix, devis, tarif, achat, abonnement' },
        ],
      });
      const sw = n('switch', 680, 140, { value: '{{ $json.categorie }}', case1: 'urgent', case2: 'commercial' });
      const emailSupport = n('emailSend', 1020, -120, {
        to: '{{ $json.email }}',
        subject: 'Votre demande urgente est prise en charge',
        text: 'Bonjour,\n\nNotre équipe support traite votre demande en priorité : {{ $json.message }}\n\nCordialement,',
      }, 'Email support');
      const emailSales = n('emailSend', 1020, 140, {
        to: '{{ $json.email }}',
        subject: 'Votre projet — parlons-en',
        text: 'Bonjour,\n\nMerci pour votre intérêt. Un conseiller vous recontacte sous 24 h.\n\nCordialement,',
      }, 'Email commercial');
      const archive = n('csvExport', 1020, 400, { filename: 'leads-en-attente.csv' }, 'Archiver');
      return {
        nodes: [form, classify, sw, emailSupport, emailSales, archive],
        edges: [e(form, classify), e(classify, sw), e(sw, emailSupport, 0), e(sw, emailSales, 1), e(sw, archive, 2)],
      };
    },
  },
  {
    id: 'resume-ia',
    name: 'Résumé IA → Notification',
    description: 'Résume automatiquement un long texte puis affiche la synthèse en notification système du navigateur.',
    badges: ['IA', 'Sans clé'],
    build: () => {
      const trigger = n('manualTrigger', 0, 40, {
        sample: '{\n  "texte": "L’automatisation des processus métier connaît une accélération sans précédent. Les entreprises qui adoptent des outils de workflow visuels réduisent leurs tâches manuelles de près de 40 %. Les équipes marketing, ventes et support sont les premières concernées par cette transformation. Selon une étude récente, 62 % des PME prévoient d’investir dans l’automatisation d’ici deux ans. Ces gains de productivité permettent de recentrer les équipes sur les tâches à forte valeur ajoutée."\n}',
      });
      const summarize = n('aiSummarize', 340, 40, {
        provider: 'local',
        text: '{{ $json.texte }}',
      });
      const notify = n('notification', 680, 40, {
        title: 'Synthèse prête',
        body: 'Résumé :\n\n{{ $json.resume }}\n\nMots-clés : {{ $json.motsCles.join(", ") }}',
      });
      return { nodes: [trigger, summarize, notify], edges: [e(trigger, summarize), e(summarize, notify)] };
    },
  },
  {
    id: 'webhook-enrichi',
    name: 'Webhook → Enrichissement → Discord',
    description: 'Reçoit un évènement, enrichit le profil via une API, hache l’email puis poste sur un webhook Discord (URL requise).',
    badges: ['API réelle', 'Crypto'],
    build: () => {
      const hook = n('webhookTrigger', 0, 60, {
        path: 'nouvel-achat',
        method: 'POST',
        sample: '{\n  "userId": 3,\n  "action": "achat",\n  "montant": 249.9\n}',
      });
      const http = n('httpRequest', 340, 60, {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/{{ $json.userId }}',
      });
      const code = n('code', 680, 60, {
        code: 'return items.map((item) => ({\n  ...item,\n  segment: item.id <= 3 ? "VIP" : "standard",\n  recuLe: new Date().toISOString(),\n}));',
      });
      const crypto = n('crypto', 1020, 60, { field: 'email', algorithm: 'SHA-256', target: 'empreinteEmail' });
      const discord = n('discordMessage', 1360, 60, {
        content: 'Nouvel achat — {{ $json.name }} ({{ $json.segment }}), empreinte {{ $json.empreinteEmail.slice(0, 12) }}…',
      });
      return {
        nodes: [hook, http, code, crypto, discord],
        edges: [e(hook, http), e(http, code), e(code, crypto), e(crypto, discord)],
      };
    },
  },
  {
    id: 'commandes',
    name: 'Traitement de commandes',
    description: 'Éclate une liste de commandes, sépare les montants élevés et traite chaque file d’attente.',
    badges: ['Logique', 'Agrégation'],
    build: () => {
      const trigger = n('manualTrigger', 0, 120, {
        sample: '{\n  "commandes": [\n    { "id": "CMD-01", "client": "ACME", "montant": 4900 },\n    { "id": "CMD-02", "client": "Beta SARL", "montant": 320 },\n    { "id": "CMD-03", "client": "Nova", "montant": 1750 },\n    { "id": "CMD-04", "client": "Pixel", "montant": 90 }\n  ]\n}',
      });
      const split = n('splitOut', 340, 120, { field: 'commandes' });
      const cond = n('if', 680, 120, { left: '{{ $json.montant }}', operator: 'gt', right: '1000' });
      const email = n('emailSend', 1020, -80, {
        to: 'compta@acme.fr',
        subject: 'Commande prioritaire {{ $json.id }}',
        body: 'La commande {{ $json.id }} de {{ $json.client }} dépasse le seuil : {{ $json.montant }} €.',
      }, 'Alerte montant élevé');
      const sort = n('sort', 1020, 260, { field: 'montant', order: 'desc' }, 'Trier standard');
      const limit = n('limit', 1360, 260, { max: 3 });
      const csv = n('csvExport', 1700, 260, { filename: 'commandes-standard.csv' }, 'Export CSV');
      return {
        nodes: [trigger, split, cond, email, sort, limit, csv],
        edges: [e(trigger, split), e(split, cond), e(cond, email, 0), e(cond, sort, 1), e(sort, limit), e(limit, csv)],
      };
    },
  },
];
