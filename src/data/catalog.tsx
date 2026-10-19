import {
  AlignLeft, ArrowDownWideNarrow, ArrowUpDown, Bell, Braces, CalendarClock, ClipboardList, Clock,
  Code2, CopyX, FileDown, FileText, Filter, GitBranch, Globe, Hash, ListTree, Mail, Merge,
  MessageSquare, MousePointerClick, PenLine, Route, Send, ShieldCheck, Sigma, Smile, Sparkles,
  StickyNote, Table2, Tags, Timer, Webhook, Zap, Layers, Boxes, Terminal,
  MonitorPlay, AtSign, Feather, MessagesSquare, Camera, ThumbsUp, Music2,
} from 'lucide-react';
import type { CategoryMeta, NodeCategory, NodeDef } from '../types';

export const CATEGORIES: Record<NodeCategory, CategoryMeta> = {
  trigger: { label: 'Déclencheurs', hint: 'Point de départ du flux', color: '#a78bfa', soft: 'rgba(167,139,250,0.14)' },
  action: { label: 'Actions', hint: 'Appels externes & envois', color: '#60a5fa', soft: 'rgba(96,165,250,0.14)' },
  video: { label: 'Vidéo', hint: 'Publication sur les réseaux', color: '#fb7185', soft: 'rgba(251,113,133,0.14)' },
  logic: { label: 'Logique', hint: 'Branchements & contrôle', color: '#fbbf24', soft: 'rgba(251,191,36,0.14)' },
  data: { label: 'Données', hint: 'Transformation & calcul', color: '#34d399', soft: 'rgba(52,211,153,0.14)' },
  ai: { label: 'Intelligence', hint: 'IA & traitement du langage', color: '#e879f9', soft: 'rgba(232,121,249,0.14)' },
  note: { label: 'Annotations', hint: 'Documenter le canvas', color: '#facc15', soft: 'rgba(250,204,21,0.13)' },
};

const CMP = {
  method: {
    key: 'method', label: 'Méthode', type: 'select' as const, default: 'GET',
    options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((v) => ({ label: v, value: v })),
  },
  header: { key: 'headers', label: 'En-têtes', type: 'keyvalue' as const, default: [], hint: 'Ex. Content-Type: application/json' },
  conditionLeft: { key: 'left', label: 'Valeur 1', type: 'text' as const, placeholder: '{{ $json.status }}', hint: 'Expressions supportées' },
  conditionOp: {
    key: 'operator', label: 'Opérateur', type: 'select' as const, default: 'equals',
    options: [
      { label: 'égal à', value: 'equals' }, { label: 'différent de', value: 'notEquals' },
      { label: 'supérieur à', value: 'gt' }, { label: 'inférieur à', value: 'lt' },
      { label: 'contient', value: 'contains' }, { label: 'ne contient pas', value: 'notContains' },
      { label: 'commence par', value: 'startsWith' }, { label: 'se termine par', value: 'endsWith' },
      { label: 'existe', value: 'notEmpty' }, { label: 'est vide', value: 'empty' },
    ],
  },
  conditionRight: { key: 'right', label: 'Valeur 2', type: 'text' as const, placeholder: '200' },
};

const VIDEO_URL = {
  key: 'videoUrl', label: 'URL de la vidéo', type: 'text' as const, default: '{{ $json.video }}',
  placeholder: 'https://…/clip.mp4', hint: 'Lien direct vers le fichier (mp4, mov, webm…)',
};

export const NODE_DEFS: NodeDef[] = [
  // ───────────────────────── DÉCLENCHEURS ─────────────────────────
  {
    type: 'manualTrigger', label: 'Déclencheur manuel', category: 'trigger', icon: MousePointerClick,
    description: 'Lance le flux à la demande, avec des données d’exemple.',
    inputs: 0, outputs: ['Sortie'],
    params: [
      { key: 'sample', label: 'Données d’exemple (JSON)', type: 'json', default: '{\n  "client": "ACME Corp",\n  "montant": 4900,\n  "ville": "Lyon"\n}' },
    ],
  },
  {
    type: 'scheduleTrigger', label: 'Planificateur', category: 'trigger', icon: Clock,
    description: 'Démarre selon une planification cron (chaque heure, jour…).',
    inputs: 0, outputs: ['Sortie'],
    params: [
      {
        key: 'interval', label: 'Fréquence', type: 'select', default: 'hours',
        options: [
          { label: 'Chaque minute', value: 'minutes' }, { label: 'Chaque heure', value: 'hours' },
          { label: 'Chaque jour', value: 'days' }, { label: 'Chaque semaine', value: 'weeks' },
        ],
      },
      { key: 'cron', label: 'Expression cron', type: 'text', default: '0 * * * *', hint: 'Informative — utilisée par le planificateur serveur' },
    ],
  },
  {
    type: 'webhookTrigger', label: 'Webhook', category: 'trigger', icon: Webhook,
    description: 'Reçoit un appel HTTP entrant sur une URL dédiée.',
    inputs: 0, outputs: ['Sortie'],
    params: [
      { key: 'path', label: 'Chemin', type: 'text', default: 'mon-webhook' },
      { ...CMP.method, default: 'POST' },
      { key: 'sample', label: 'Charge utile d’exemple (JSON)', type: 'json', default: '{\n  "event": "commande.creee",\n  "id": "CMD-1042",\n  "total": 129.9\n}' },
    ],
  },
  {
    type: 'formTrigger', label: 'Formulaire', category: 'trigger', icon: ClipboardList,
    description: 'Déclenche le flux quand un formulaire est soumis.',
    inputs: 0, outputs: ['Sortie'],
    params: [
      { key: 'formName', label: 'Nom du formulaire', type: 'text', default: 'Contact commercial' },
      { key: 'fields', label: 'Champs', type: 'keyvalue', default: [{ key: 'email', value: 'jean@exemple.fr' }, { key: 'budget', value: '15000' }] },
    ],
  },

  // ───────────────────────── ACTIONS ─────────────────────────
  {
    type: 'httpRequest', label: 'Requête HTTP', category: 'action', icon: Globe,
    description: 'Appelle n’importe quelle API REST. Exécution réelle.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      CMP.method,
      { key: 'url', label: 'URL', type: 'text', default: 'https://jsonplaceholder.typicode.com/users', placeholder: 'https://api.exemple.com/v1/…' },
      CMP.header,
      { key: 'body', label: 'Corps (JSON)', type: 'json', default: '', hint: 'Utilisé pour POST / PUT / PATCH' },
    ],
  },
  {
    type: 'emailSend', label: 'Envoyer un email', category: 'action', icon: Mail,
    description: 'Envoie un email réel via l’API Brevo (clé requise).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'apiKey', label: 'Clé API Brevo', type: 'text', default: '', placeholder: 'xkeysib-…', hint: 'app.brevo.com → SMTP & API → Clés API' },
      { key: 'from', label: 'Expéditeur', type: 'text', default: '', placeholder: 'vous@votre-domaine.fr', hint: 'Adresse validée dans Brevo' },
      { key: 'to', label: 'Destinataire', type: 'text', default: '{{ $json.email }}' },
      { key: 'subject', label: 'Sujet', type: 'text', default: 'Rapport automatique — {{ $now.toLocaleDateString("fr-FR") }}' },
      { key: 'text', label: 'Message', type: 'textarea', default: 'Bonjour,\n\nLe flux a produit {{ $json.ville }}.\n\nCordialement,\nFluxia' },
    ],
  },
  {
    type: 'slackMessage', label: 'Slack', category: 'action', icon: Hash,
    description: 'Poste un message via un webhook Slack (via le relais local).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'webhookUrl', label: 'URL de webhook', type: 'text', default: '', placeholder: 'https://hooks.slack.com/services/…', hint: 'api.slack.com/messaging/webhooks' },
      { key: 'text', label: 'Message', type: 'textarea', default: ':zap: Flux exécuté — {{ $json.client ?? "sans client" }}' },
    ],
  },
  {
    type: 'discordMessage', label: 'Discord', category: 'action', icon: MessageSquare,
    description: 'Poste un message réel via un webhook Discord.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'webhookUrl', label: 'URL de webhook', type: 'text', default: '', placeholder: 'https://discord.com/api/webhooks/…', hint: 'Serveur → Intégrations → Webhooks → Copier l’URL' },
      { key: 'content', label: 'Message', type: 'textarea', default: 'Nouvelle exécution de flux : {{ $json.id ?? "—" }}' },
    ],
  },
  {
    type: 'telegramMessage', label: 'Telegram', category: 'action', icon: Send,
    description: 'Envoie un message réel via un bot Telegram.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'botToken', label: 'Jeton du bot', type: 'text', default: '', placeholder: '123456:ABC-DEF…', hint: 'Créé via @BotFather' },
      { key: 'chatId', label: 'ID de conversation', type: 'text', default: '', placeholder: '@canal ou 123456789' },
      { key: 'text', label: 'Message', type: 'textarea', default: 'Flux exécuté avec succès ✅' },
    ],
  },
  {
    type: 'csvExport', label: 'Exporter CSV', category: 'action', icon: FileDown,
    description: 'Convertit les éléments reçus en fichier CSV et le télécharge.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'filename', label: 'Nom du fichier', type: 'text', default: 'export-fluxia.csv' },
      {
        key: 'separator', label: 'Séparateur', type: 'select', default: ';',
        options: [{ label: '; (Excel FR)', value: ';' }, { label: ', (standard)', value: ',' }],
      },
    ],
  },
  {
    type: 'notification', label: 'Notification', category: 'action', icon: Bell,
    description: 'Affiche une notification système du navigateur.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'title', label: 'Titre', type: 'text', default: 'Fluxia — flux terminé' },
      { key: 'body', label: 'Message', type: 'textarea', default: 'Traitement de {{ $items.length }} élément(s) terminé ✅' },
    ],
  },
  {
    type: 'sheetsAppend', label: 'Google Sheets', category: 'action', icon: Table2,
    description: 'Ajoute une ligne réelle via un compte de service Google (relais local).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'serviceAccountEmail', label: 'Email du compte de service', type: 'text', default: '', placeholder: 'fluxia@mon-projet.iam.gserviceaccount.com' },
      { key: 'privateKey', label: 'Clé privée (private_key)', type: 'textarea', default: '', placeholder: '-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n' },
      { key: 'spreadsheetId', label: 'ID du classeur', type: 'text', default: '', placeholder: '1BxiMVs0XRA5nFMd… (URL du classeur)' },
      { key: 'range', label: 'Feuille et plage', type: 'text', default: 'Feuille 1!A1' },
      { key: 'values', label: 'Valeurs de la ligne', type: 'keyvalue', default: [{ key: 'client', value: '{{ $json.client }}' }, { key: 'montant', value: '{{ $json.montant }}' }] },
    ],
  },
  {
    type: 'notionCreate', label: 'Notion', category: 'action', icon: FileText,
    description: 'Crée une page réelle dans une base de données Notion.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'integrationToken', label: 'Jeton d’intégration', type: 'text', default: '', placeholder: 'ntn_…', hint: 'notion.so/my-integrations' },
      { key: 'databaseId', label: 'ID de la base', type: 'text', default: '', placeholder: '32 caractères dans l’URL de la base' },
      { key: 'titleProperty', label: 'Propriété titre', type: 'text', default: 'Name', hint: 'Nom de la propriété « Titre » de la base' },
      { key: 'title', label: 'Titre de la page', type: 'text', default: '{{ $json.client ?? "Nouveau contact" }}' },
      { key: 'content', label: 'Contenu', type: 'textarea', default: 'Créé automatiquement par Fluxia.' },
    ],
  },

  // ───────────────────────── VIDÉO ─────────────────────────
  {
    type: 'videoYoutube', label: 'YouTube', category: 'video', icon: MonitorPlay,
    description: 'Télécharge la vidéo et l’envoie réellement sur YouTube (relais + jeton OAuth).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'accessToken', label: 'Jeton d’accès OAuth', type: 'text', default: '', placeholder: 'ya29.…', hint: 'Scope youtube.upload — voir OAuth Playground pour un test' },
      { key: 'title', label: 'Titre', type: 'text', default: '{{ $json.titre ?? "Ma vidéo" }}' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
      { key: 'tags', label: 'Tags', type: 'text', default: '', placeholder: 'tuto, automation, fluxia', hint: 'Séparés par des virgules' },
      {
        key: 'categoryId', label: 'Catégorie', type: 'select', default: '22',
        options: [
          { label: 'People & Blogs', value: '22' }, { label: 'Divertissement', value: '24' },
          { label: 'Éducation', value: '27' }, { label: 'Science & Tech', value: '28' },
          { label: 'Musique', value: '10' }, { label: 'Jeux vidéo', value: '20' },
        ],
      },
      {
        key: 'privacy', label: 'Visibilité', type: 'select', default: 'private',
        options: [
          { label: 'Privée', value: 'private' }, { label: 'Non répertoriée', value: 'unlisted' }, { label: 'Publique', value: 'public' },
        ],
      },
      { key: 'madeForKids', label: 'Conçue pour les enfants', type: 'boolean', default: false },
    ],
  },
  {
    type: 'videoMastodon', label: 'Mastodon', category: 'video', icon: AtSign,
    description: 'Publie une vraie vidéo sur l’instance de votre choix (MP4/MOV/WebM, jeton write:media + write:statuses).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'instance', label: 'Instance', type: 'text', default: 'mastodon.social', placeholder: 'mastodon.social', hint: 'Domaine seul, sans https' },
      { key: 'accessToken', label: 'Jeton d’accès', type: 'text', default: '', placeholder: 'AAAA…', hint: 'Préférences → Développement → « Generer un jeton » (write:media, write:statuses)' },
      { key: 'text', label: 'Message', type: 'textarea', default: '{{ $json.texte ?? "" }}' },
      { key: 'altText', label: 'Texte alternatif vidéo', type: 'text', default: '', hint: 'Description pour les lecteurs d’écran (optionnel)' },
      {
        key: 'visibility', label: 'Visibilité', type: 'select', default: 'public',
        options: [
          { label: 'Publique', value: 'public' }, { label: 'Non listée', value: 'unlisted' },
          { label: 'Abonnés', value: 'private' }, { label: 'Direct', value: 'direct' },
        ],
      },
    ],
  },
  {
    type: 'videoBluesky', label: 'Bluesky', category: 'video', icon: Feather,
    description: 'Poste réellement une vidéo sur Bluesky — MP4 uniquement, mot de passe d’application requis.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'pds', label: 'Hébergeur', type: 'text', default: 'bsky.social', hint: 'bsky.social par défaut, ou le domaine de votre PDS' },
      { key: 'identifier', label: 'Identifiant', type: 'text', default: '', placeholder: 'pseudo.bsky.social' },
      { key: 'appPassword', label: 'Mot de passe d’application', type: 'text', default: '', hint: 'Paramètres → Sécurité → Mots de passe d’application' },
      { key: 'text', label: 'Message', type: 'textarea', default: '{{ $json.texte ?? "" }}' },
      { key: 'altText', label: 'Texte alternatif vidéo', type: 'text', default: '', hint: 'Description pour les lecteurs d’écran (optionnel)' },
    ],
  },
  {
    type: 'videoX', label: 'X (Twitter)', category: 'video', icon: MessagesSquare,
    description: 'Envoie réellement la vidéo par tranches puis publie le post (relais local).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'accessToken', label: 'User access token', type: 'text', default: '', hint: 'developer.x.com → projet → scopes media.write + tweet.write' },
      { key: 'text', label: 'Post', type: 'textarea', default: '{{ $json.texte ?? "" }}' },
    ],
  },
  {
    type: 'videoInstagram', label: 'Instagram Reels', category: 'video', icon: Camera,
    description: 'Publie un Reel réel via la Graph API (compte pro + app Meta approuvée).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'igUserId', label: 'ID du compte Instagram', type: 'text', default: '', hint: 'Graph API Explorer → Instagram Business Account' },
      { key: 'accessToken', label: 'Jeton d’accès Meta', type: 'text', default: '', hint: 'instagram_content_publish + pages_read_engagement' },
      { key: 'caption', label: 'Légende', type: 'textarea', default: '{{ $json.texte ?? "" }}' },
      { key: 'shareToFeed', label: 'Partager aussi dans le fil', type: 'boolean', default: true },
    ],
  },
  {
    type: 'videoFacebook', label: 'Facebook Page', category: 'video', icon: ThumbsUp,
    description: 'Met réellement une vidéo en ligne sur une Page (jeton Page + publish_video).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'pageId', label: 'ID de la Page', type: 'text', default: '', hint: 'Page → À propos → Identifiant de la Page' },
      { key: 'accessToken', label: 'Jeton d’accès de la Page', type: 'text', default: '', hint: 'publish_video + pages_manage_metadata' },
      { key: 'title', label: 'Titre', type: 'text', default: '{{ $json.titre ?? "Ma vidéo" }}' },
      { key: 'description', label: 'Description', type: 'textarea', default: '' },
    ],
  },
  {
    type: 'videoTiktok', label: 'TikTok', category: 'video', icon: Music2,
    description: 'Demande réellement une publication via la Content Posting API (app approuvée).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      VIDEO_URL,
      { key: 'accessToken', label: 'Jeton d’accès', type: 'text', default: '', hint: 'developers.tiktok.com → scope video.publish' },
      { key: 'title', label: 'Titre / description', type: 'textarea', default: '{{ $json.texte ?? "" }}' },
      {
        key: 'privacy', label: 'Visibilité', type: 'select', default: 'SELF_ONLY',
        options: [
          { label: 'Moi uniquement', value: 'SELF_ONLY' }, { label: 'Abonnés croisés', value: 'MUTUAL_FOLLOW' },
          { label: 'Mes abonnés', value: 'FOLLOWER' }, { label: 'Public', value: 'PUBLIC_TO_EVERYONE' },
        ],
        hint: '« Public » exige une app auditée par TikTok',
      },
      { key: 'coverUrl', label: 'URL de la miniature', type: 'text', default: '', hint: 'Optionnel — image publique' },
      { key: 'allowComments', label: 'Commentaires autorisés', type: 'boolean', default: true },
      { key: 'allowDuet', label: 'Duettes autorisées', type: 'boolean', default: false },
      { key: 'allowStitch', label: 'Stitch autorisé', type: 'boolean', default: false },
    ],
  },

  // ───────────────────────── LOGIQUE ─────────────────────────
  {
    type: 'if', label: 'Condition', category: 'logic', icon: GitBranch,
    description: 'Sépare les éléments selon une condition (Vrai / Faux).',
    inputs: 1, outputs: ['Vrai', 'Faux'],
    params: [CMP.conditionLeft, CMP.conditionOp, CMP.conditionRight],
  },
  {
    type: 'switch', label: 'Aiguillage', category: 'logic', icon: Route,
    description: 'Dirige les éléments vers plusieurs branches selon leur valeur.',
    inputs: 1, outputs: ['Cas 1', 'Cas 2', 'Défaut'],
    params: [
      { key: 'value', label: 'Valeur testée', type: 'text', default: '{{ $json.region }}', hint: 'Comparée à chaque cas' },
      { key: 'case1', label: 'Cas 1', type: 'text', default: 'sud' },
      { key: 'case2', label: 'Cas 2', type: 'text', default: 'nord' },
    ],
  },
  {
    type: 'merge', label: 'Fusionner', category: 'logic', icon: Merge,
    description: 'Combine plusieurs entrées en un seul flux.',
    inputs: 2, outputs: ['Sortie'],
    params: [
      {
        key: 'mode', label: 'Mode', type: 'select', default: 'append',
        options: [{ label: 'Concaténer', value: 'append' }, { label: 'Fusionner par index', value: 'index' }],
      },
    ],
  },
  {
    type: 'wait', label: 'Attendre', category: 'logic', icon: Timer,
    description: 'Suspend l’exécution pendant un délai défini.',
    inputs: 1, outputs: ['Sortie'],
    params: [{ key: 'seconds', label: 'Durée (secondes)', type: 'number', default: 2 }],
  },
  {
    type: 'filter', label: 'Filtrer', category: 'logic', icon: Filter,
    description: 'Ne conserve que les éléments qui passent la condition.',
    inputs: 1, outputs: ['Sortie'],
    params: [CMP.conditionLeft, CMP.conditionOp, CMP.conditionRight],
  },
  {
    type: 'limit', label: 'Limiter', category: 'logic', icon: ArrowDownWideNarrow,
    description: 'Réduit le nombre d’éléments traités.',
    inputs: 1, outputs: ['Sortie'],
    params: [{ key: 'max', label: 'Maximum d’éléments', type: 'number', default: 5 }],
  },

  // ───────────────────────── DONNÉES ─────────────────────────
  {
    type: 'set', label: 'Éditer les champs', category: 'data', icon: PenLine,
    description: 'Ajoute ou remplace des champs sur chaque élément.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'fields', label: 'Champs', type: 'keyvalue', default: [{ key: 'traite', value: 'oui' }] },
      { key: 'keepOnly', label: 'Conserver uniquement ces champs', type: 'boolean', default: false },
    ],
  },
  {
    type: 'code', label: 'Code JS', category: 'data', icon: Code2,
    description: 'Transforme les données avec du JavaScript. Exécution réelle.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      {
        key: 'code', label: 'Code', type: 'code',
        default: '// items : tableau d’objets JSON\nreturn items.map((item, i) => ({\n  ...item,\n  position: i + 1,\n  enrichi: true,\n}));',
      },
    ],
  },
  {
    type: 'splitOut', label: 'Éclater', category: 'data', icon: ListTree,
    description: 'Transforme un champ tableau en plusieurs éléments.',
    inputs: 1, outputs: ['Sortie'],
    params: [{ key: 'field', label: 'Champ tableau', type: 'text', default: 'tags' }],
  },
  {
    type: 'aggregate', label: 'Agréger', category: 'data', icon: Sigma,
    description: 'Regroupe tous les éléments : comptage, collection ou somme.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      {
        key: 'mode', label: 'Opération', type: 'select', default: 'count',
        options: [{ label: 'Compter', value: 'count' }, { label: 'Collecter', value: 'collect' }, { label: 'Somme d’un champ', value: 'sum' }],
      },
      { key: 'field', label: 'Champ (pour la somme)', type: 'text', default: 'montant' },
    ],
  },
  {
    type: 'dateTime', label: 'Date & Heure', category: 'data', icon: CalendarClock,
    description: 'Génère ou décale une date sur chaque élément.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      {
        key: 'mode', label: 'Opération', type: 'select', default: 'now',
        options: [{ label: 'Maintenant', value: 'now' }, { label: 'Décaler', value: 'shift' }],
      },
      { key: 'amount', label: 'Quantité', type: 'number', default: 1 },
      {
        key: 'unit', label: 'Unité', type: 'select', default: 'days',
        options: [{ label: 'Minutes', value: 'minutes' }, { label: 'Heures', value: 'hours' }, { label: 'Jours', value: 'days' }],
      },
      { key: 'target', label: 'Champ de sortie', type: 'text', default: 'date' },
    ],
  },
  {
    type: 'crypto', label: 'Crypto', category: 'data', icon: ShieldCheck,
    description: 'Hache ou encode une valeur (SHA-256, Base64…).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'field', label: 'Champ source', type: 'text', default: 'email' },
      {
        key: 'algorithm', label: 'Algorithme', type: 'select', default: 'SHA-256',
        options: ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512', 'Base64', 'Hexadécimal'].map((v) => ({ label: v, value: v })),
      },
      { key: 'target', label: 'Champ de sortie', type: 'text', default: 'hash' },
    ],
  },
  {
    type: 'jsonParse', label: 'Parser JSON', category: 'data', icon: Braces,
    description: 'Convertit une chaîne JSON en objet exploitable.',
    inputs: 1, outputs: ['Sortie'],
    params: [{ key: 'field', label: 'Champ à parser', type: 'text', default: 'payload' }],
  },
  {
    type: 'removeDuplicates', label: 'Dédoublonner', category: 'data', icon: CopyX,
    description: 'Supprime les éléments identiques selon un champ.',
    inputs: 1, outputs: ['Sortie'],
    params: [{ key: 'field', label: 'Champ de comparaison', type: 'text', default: 'email', hint: 'Vide = élément entier' }],
  },
  {
    type: 'sort', label: 'Trier', category: 'data', icon: ArrowUpDown,
    description: 'Trie les éléments par champ, croissant ou décroissant.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'field', label: 'Champ', type: 'text', default: 'montant' },
      {
        key: 'order', label: 'Ordre', type: 'select', default: 'desc',
        options: [{ label: 'Décroissant', value: 'desc' }, { label: 'Croissant', value: 'asc' }],
      },
    ],
  },
  {
    type: 'noOp', label: 'Pause neutre', category: 'data', icon: Layers,
    description: 'Laisse passer les éléments sans modification.',
    inputs: 1, outputs: ['Sortie'],
    params: [],
  },

  // ───────────────────────── IA ─────────────────────────
  {
    type: 'aiSummarize', label: 'Résumer', category: 'ai', icon: AlignLeft,
    description: 'Résume un texte — extraction locale ou OpenAI.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      {
        key: 'provider', label: 'Moteur', type: 'select', default: 'local',
        options: [{ label: 'Local (extractif, hors ligne)', value: 'local' }, { label: 'OpenAI compatible', value: 'openai' }],
      },
      { key: 'text', label: 'Texte à résumer', type: 'textarea', default: '{{ $json.texte }}' },
      { key: 'apiKey', label: 'Clé API', type: 'text', default: '', hint: 'Requise pour le moteur OpenAI', placeholder: 'sk-…' },
      { key: 'model', label: 'Modèle', type: 'text', default: 'gpt-4o-mini' },
    ],
  },
  {
    type: 'aiSentiment', label: 'Sentiment', category: 'ai', icon: Smile,
    description: 'Détecte si un texte est positif, négatif ou neutre.',
    inputs: 1, outputs: ['Sortie'],
    params: [{ key: 'text', label: 'Texte analysé', type: 'text', default: '{{ $json.avis }}' }],
  },
  {
    type: 'aiClassify', label: 'Classifier', category: 'ai', icon: Tags,
    description: 'Assigne chaque élément à une catégorie par mots-clés.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'text', label: 'Texte analysé', type: 'text', default: '{{ $json.message }}' },
      { key: 'categories', label: 'Catégories', type: 'keyvalue', default: [{ key: 'urgent', value: 'urgent, panne, bloqué, critique' }, { key: 'commercial', value: 'prix, devis, achat, tarif' }] },
    ],
  },
  {
    type: 'aiChat', label: 'Chat IA', category: 'ai', icon: Sparkles,
    description: 'Génère du texte / répond à une consigne — local ou OpenAI.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      {
        key: 'provider', label: 'Moteur', type: 'select', default: 'local',
        options: [{ label: 'Local (gabarit, hors ligne)', value: 'local' }, { label: 'OpenAI compatible', value: 'openai' }],
      },
      { key: 'preset', label: 'Consigne', type: 'textarea', default: 'Rédige un message commercial court et chaleureux.', hint: 'Expressions supportées : {{ $json.champ }}' },
      { key: 'apiKey', label: 'Clé API', type: 'text', default: '', hint: 'Requise pour le moteur OpenAI', placeholder: 'sk-…' },
      { key: 'model', label: 'Modèle', type: 'text', default: 'gpt-4o-mini' },
      { key: 'baseUrl', label: 'URL de base', type: 'text', default: 'https://api.openai.com/v1' },
      { key: 'target', label: 'Champ de sortie', type: 'text', default: 'reponse' },
    ],
  },
  {
    type: 'aiAgent', label: 'Agent IA', category: 'ai', icon: Terminal,
    description: 'Analyse l’entrée et propose une action à réaliser.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'goal', label: 'Objectif de l’agent', type: 'textarea', default: 'Déterminer la meilleure action pour traiter cette demande.' },
      { key: 'target', label: 'Champ de sortie', type: 'text', default: 'plan' },
    ],
  },
  {
    type: 'aiExtract', label: 'Extraire des données', category: 'ai', icon: Boxes,
    description: 'Extrait les valeurs clés d’un texte non structuré.',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'text', label: 'Texte source', type: 'text', default: '{{ $json.message }}' },
      { key: 'keys', label: 'Champs à extraire', type: 'keyvalue', default: [{ key: 'email', value: '' }, { key: 'telephone', value: '' }, { key: 'montant', value: '' }] },
    ],
  },
  {
    type: 'aiTranslate', label: 'Traduire', category: 'ai', icon: Zap,
    description: 'Traduit un texte vers une langue cible (dictionnaire local).',
    inputs: 1, outputs: ['Sortie'],
    params: [
      { key: 'text', label: 'Texte', type: 'textarea', default: '{{ $json.message }}' },
      {
        key: 'target_lang', label: 'Langue cible', type: 'select', default: 'en',
        options: [{ label: 'Anglais', value: 'en' }, { label: 'Français', value: 'fr' }, { label: 'Espagnol', value: 'es' }],
      },
    ],
  },
  // ───────────────────────── ANNOTATIONS ─────────────────────────
  {
    type: 'stickyNote', label: 'Note', category: 'note', icon: StickyNote,
    description: 'Documente le canvas : post-it libre, sans impact sur l’exécution.',
    inputs: 0, outputs: [],
    params: [
      { key: 'text', label: 'Contenu', type: 'textarea', default: 'Décrivez ici le rôle de cette partie du flux…' },
      {
        key: 'color', label: 'Couleur', type: 'select', default: 'jaune',
        options: [
          { label: 'Jaune', value: 'jaune' }, { label: 'Violet', value: 'violet' },
          { label: 'Bleu', value: 'bleu' }, { label: 'Vert', value: 'vert' },
        ],
      },
    ],
  },
];

export const DEF_MAP: Record<string, NodeDef> = Object.fromEntries(NODE_DEFS.map((d) => [d.type, d]));

export function getDef(type: string): NodeDef {
  return DEF_MAP[type] ?? NODE_DEFS[0];
}

export function defaultParams(type: string): Record<string, unknown> {
  const def = getDef(type);
  const out: Record<string, unknown> = {};
  for (const p of def.params) {
    if (p.default !== undefined) out[p.key] = typeof p.default === 'object' && p.default !== null ? structuredClone(p.default) : p.default;
  }
  return out;
}

export const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'video', 'logic', 'data', 'ai', 'note'];
