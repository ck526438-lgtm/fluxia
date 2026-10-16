# ⚡ Fluxia — Automatisation visuelle de workflows

Fluxia est un éditeur de workflows par nœuds, inspiré de n8n : on construit un flux en
reliant des nœuds sur un canvas, on configure chaque étape à droite, on exécute, et on
regarde les données circuler de nœud en nœud en temps réel.

Interface en français, thème sombre, animations soignées (particules sur les connexions,
anneau d'exécution sur les nœuds, panneaux à ressorts).

[![CI](https://github.com/ck526438-lgtm/fluxia/actions/workflows/ci.yml/badge.svg)](https://github.com/ck526438-lgtm/fluxia/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/Licence-MIT-3f6ad8)](LICENSE) ![Stack](https://img.shields.io/badge/React-19-61dafb) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![TS](https://img.shields.io/badge/TypeScript-5-3178c6)

![Fluxia — canvas de workflow avec nœuds connectés](docs/screenshot.png)

**🌐 Démo en ligne : [ck526438-lgtm.github.io/fluxia](https://ck526438-lgtm.github.io/fluxia/)** —
redéployée automatiquement à chaque push. Version 100 % navigateur : le relais local
(Slack, Google Sheets, API fermées CORS) reste un extra de l'installation locale.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de production dans dist/
npm start        # relais local optionnel + sert dist/ sur http://127.0.0.1:5174
```

Le **relais local** (`server.mjs`, zéro dépendance) est facultatif : sans lui, l'app
fonctionne déjà à 100 % en navigateur. Il débloque en plus les API qui refusent les
appels navigateur (CORS) — Slack, Google Sheets, n'importe quelle API fermée via le
nœud Requête HTTP — en les appelant depuis Node, en local uniquement (127.0.0.1).

## Fonctionnalités

### Éditeur
- **Canvas infini** : zoom, panoramique, minimap colorée par catégorie, alignement
  automatique des nœuds (dagre), pastille zoom + compteurs nœuds / liens.
- **37 nœuds** répartis en 6 familles : Déclencheurs, Actions, Logique, Données, IA,
  Annotations.
- **Notes autocollantes** : post-it redimensionnables (4 couleurs) pour documenter le
  canvas, sans impact sur l'exécution, rendus derrière les nœuds.
- **Menu contextuel** (clic droit) :
  - sur un nœud → paramètres, **exécuter jusqu'ici**, dupliquer, copier, désactiver, supprimer ;
  - sur une connexion → insérer un nœud, supprimer le lien ;
  - sur le canvas → ajouter un nœud / une note, coller, tout sélectionner, organiser.
- **Palette latérale** : recherche, glisser-déposer ou clic pour ajouter.
- **Connexions** : glisser entre les poignées ; bouton `+` au milieu d'une connexion pour
  y insérer un nœud ; bouton `×` pour la supprimer.
- **Panneau de configuration** : formulaires générés depuis le schéma du nœud
  (texte, nombre, liste, booléen, paires clé/valeur, JSON, éditeur de code).
- **Palette de commandes** (`Ctrl K`) : exécuter, ajouter un nœud, importer, aligner…
- **Identifiants** : panneau central pour enregistrer vos clés API une seule fois
  (Brevo, Notion, Telegram, OpenAI…), réutilisables partout avec `{{ $creds.nom }}`.
  Stockage 100 % local (localStorage), bouton dédié dans la barre d'outils.
- **Modèles prêts à l'emploi** : 5 flux complets (veille API, triage de leads IA,
  résumé IA, webhook enrichi, traitement de commandes).
- **Historique** : annuler / rétablir, copier / coller / dupliquer, sauvegarde locale
  automatique (localStorage) avec indicateur « Enregistré », import / export JSON.

### Moteur d'exécution
- Exécution réelle en ordre topologique, branchements `Condition` / `Aiguillage`,
  nœuds ignorés si leur branche n'est pas empruntée, détection des boucles.
- **Expressions** `{{ … }}` partout : `{{ $json.champ }}`, `{{ $items.length }}`,
  `{{ $index }}`, `{{ $node["Nom du nœud"].json.champ }}`, `{{ $now.toISOString() }}`.
- **Animated data flow** : pendant l'exécution, les arêtes s'illuminent avec des
  particules, les nœuds affichent anneau rotatif, coche verte ou secousse d'erreur,
  et le panneau d'exécution détaille entrées / sorties / durée de chaque nœud.
- **Exécuter jusqu'ici** : clic droit sur un nœud → test de l'amont uniquement
  (tous les ancêtres sont exécutés, le reste du flux reste intact).
- Vitesse **Normal** (animations lisibles) ou **Turbo** (instantané).
- Arrêt en cours d'exécution (`Arrêter`).

### Tout est réel — zéro simulation
Chaque nœud effectue une action réelle ou échoue honnêtement avec un message clair.
Aucun nœud ne simule une réponse : sans identifiants, l'exécution s'arrête sur le nœud
concerné avec l'explication exacte (et le lien où créer la clé).

**Intégrations externes réelles** (fonctionnent depuis le navigateur) :

| Nœud | Service | Identifiant requis |
| --- | --- | --- |
| `Envoyer un email` | API Brevo (`api.brevo.com/v3/smtp/email`) | Clé API Brevo + expéditeur validé |
| `Discord` | Webhooks Discord | URL de webhook |
| `Telegram` | API Bot Telegram | Jeton du bot + chat ID |
| `Notion` | API Notion (`api.notion.com/v1/pages`) | Jeton d'intégration + ID de base |
| `Notification` | Notifications du navigateur | Autorisation du site |
| `Requête HTTP` | N'importe quelle API | Selon l'API |
| `Slack` | Webhooks Slack (via relais local) | URL de webhook |
| `Google Sheets` | API Sheets via **compte de service** (via relais local) | Email + clé privée du compte de service, classeur partagé |

Astuce : enregistrez vos clés dans le panneau **Identifiants** puis référencez-les
partout avec `{{ $creds.nom }}` — plus besoin de les ressaisir dans chaque nœud.

**Traitement 100 % local, sans clé** : `Requête HTTP`, `Code JS`, `Éditer les champs`,
`Condition`, `Aiguillage`, `Filtrer`, `Limiter`, `Trier`, `Éclater`, `Agréger`,
`Dédoublonner`, `Parser JSON`, `Date & Heure`, `Crypto` (SHA-1/256/384/512, Base64, Hex),
`Attendre`, `Fusionner`, `Pause neutre`, `Exporter CSV` (fichier téléchargé),
`Déclencheur manuel`, `Planificateur`, `Webhook`, `Formulaire`, et les nœuds IA
(Résumer / Sentiment / Classifier / Extraire / Traduire fonctionnent hors ligne ;
`Chat` / `Agent` utilisent OpenAI compatible **uniquement si** une clé API est fournie).

## Raccourcis

| Raccourci | Action |
| --- | --- |
| `Ctrl K` | Palette de commandes |
| `Ctrl ↵` | Exécuter le flux |
| `Ctrl Z` / `Ctrl ⇧ Z` | Annuler / rétablir |
| `Ctrl C` / `Ctrl V` / `Ctrl D` | Copier / coller / dupliquer |
| `Ctrl A` | Tout sélectionner |
| `D` | Activer / désactiver le nœud sélectionné |
| `Ctrl S` | Sauvegarde locale immédiate |
| `Maj + glisser` | Sélection multiple |
| `Suppr` | Supprimer la sélection |
| Clic droit | Menu contextuel (nœud, connexion, canvas) |

## Architecture

```
server.mjs                  # Relais local optionnel (/api/relay, /api/sheets-append) + sert dist/
src/
├── types.ts                 # Types partagés (nœud, item, exécution…)
├── data/
│   ├── catalog.tsx          # Définition des 37 nœuds (icône, couleur, params, ports)
│   └── templates.ts         # Flux prêts à l'emploi
├── engine/
│   ├── expressions.ts       # Résolution des {{ expressions }} ($json, $items, $creds…)
│   └── engine.ts            # Orchestrateur + exécuteurs de nœuds + branchements + relais
├── store/store.ts           # État global (zustand) : graphe, historique, exécution, toasts, identifiants
└── components/
    ├── Canvas.tsx           # React Flow, minimap, état vide, dépôt des nœuds
    ├── FlowNode.tsx         # Nœud animé (statuts, badge éléments, poignées)
    ├── FlowEdge.tsx         # Connexion animée (particules, insertion, suppression)
    ├── StickyNote.tsx       # Note autocollante redimensionnable
    ├── ContextMenu.tsx      # Menu clic droit (nœud, connexion, canvas)
    ├── ConfigPanel.tsx      # Configuration + inspection entrée/sortie
    ├── ExecutionPanel.tsx   # Journal d'exécution détaillé
    ├── CommandPalette.tsx   # Palette Ctrl K
    ├── CredentialsModal.tsx # Gestionnaire d'identifiants ({{ $creds.nom }})
    ├── TemplatesModal.tsx   # Galerie de modèles
    ├── TopBar.tsx           # Barre d'outils + bouton Exécuter
    ├── JsonView.tsx         # Visualiseur JSON colorisé
    └── Toasts.tsx           # Notifications
```

Ajouter un nœud = ajouter une entrée dans `src/data/catalog.tsx` + un `case` dans
`runNodeCore` (`src/engine/engine.ts`). Le reste (UI, formulaire, poignées, exécution)
est automatique.

## Notes techniques

- État applicatif : [zustand](https://github.com/pmndrs/zustand) · Canvas :
  [@xyflow/react](https://reactflow.dev) (React Flow, licence MIT — attribution
  conservée en bas à droite du canvas) · Animations :
  [motion](https://motion.dev) · Styles : [Tailwind CSS v4](https://tailwindcss.com).
- **Performance** : nœuds et connexions mémoïsés (`React.memo`), panneaux fermés sans
  abonnement à l'état, cache de compilation des expressions `{{ … }}`, bundle découpé
  en 4 chunks vendor parallélisables et cachables (React, React Flow, motion, app).
- Le nœud **Code JS** exécute du JavaScript local (comme le Code node de n8n) via
  `new Function` : n'exécutez que du code que vous comprenez.
- Les appels HTTP partent du navigateur : quand une API refuse (CORS), le nœud
  **Requête HTTP** bascule automatiquement par le relais local s'il est lancé —
  sinon l'erreur exacte s'affiche dans le nœud et le journal.
- **Relais local** : `npm start` écoute uniquement sur 127.0.0.1. Il expose
  `/api/relay` (transfert générique) et `/api/sheets-append` (signature JWT du
  compte de service Google). Aucune donnée ne sort de votre machine sans votre flux.
- Données 100 % locales : le flux et les identifiants sont sauvegardés dans le
  `localStorage` du navigateur. Aucun serveur distant, aucun compte, aucune télémétrie.
