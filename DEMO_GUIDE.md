# Guide de démonstration — Recommandation IA (Approche A)

Toutes les valeurs ci-dessous sont **réelles**, obtenues en exécutant le pipeline complet et en interrogeant l'API en direct (pas d'estimations à la main). Si tu re-seed avant le jour J, les valeurs de sentiment NLP peuvent varier de quelques centièmes (le modèle est déterministe mais les commentaires sont les mêmes) — la hiérarchie et l'écart entre produits resteront identiques.

---

## PARTIE 1 — Préparation (AVANT l'arrivée du jury, ~10 min)

Ouvre 5 terminaux. Fais tout dans l'ordre. Personne ne doit voir cette partie.

### Terminal 1 — Blockchain locale
```
cd contracts
npx hardhat node
```
Laisse tourner. Note les comptes affichés si besoin (tu n'en as pas besoin pour la démo elle-même).

### Terminal 2 — Déploiement + seed (une seule fois, dans l'ordre, attends que chaque commande finisse)
```
cd contracts
node scripts/deploy.js
node scripts/seed.js
node scripts/seed-reco-demo.js
```
Puis :
```
cd ../backend
node scripts/seed-db.js
node scripts/seed-db-reco-demo.js
```

### Terminal 3 — Service NLP (Flask)
```
cd ml-service
python app.py
```
Attends de voir `Running on http://127.0.0.1:5001`.

### Terminal 4 — Backend
```
cd backend
node server.js
```
Attends `Serveur backend lancé sur http://localhost:5000`.

### Terminal 2 (réutilisé) — Analyse NLP des avis
**Important** : la 1ère requête déclenche le chargement du modèle (XLM-RoBERTa), ça prend 60-90s la première fois. C'est normal, ne relance rien pendant ce temps.
```
cd backend
node scripts/init-review-sentiments.js
```
Vérifie à la fin : `Erreurs : 0` et que les produits #11 à #15 apparaissent dans le résumé avec un nombre d'avis cohérent (8, 2, 1, 1, 6).

### Terminal 5 — Frontend
```
cd frontend
npm run dev
```
Ouvre `http://localhost:5173`.

### Checklist finale avant l'arrivée du jury
- [ ] MetaMask connecté sur le réseau Hardhat local (chainId 1337, RPC `http://127.0.0.1:8545`)
- [ ] Si MetaMask a déjà servi sur une session Hardhat précédente : **Paramètres → Avancé → Effacer les données d'activité de cet onglet** (sinon erreurs de nonce)
- [ ] Connecté avec le compte **admin** (Account #0 de Hardhat — c'est lui qui voit "Monitoring Reco IA" dans la sidebar)
- [ ] Sidebar → **Monitoring Reco IA** → tape "pc gamer" → tu dois voir 7 produits retenus, dont en tête "PC Gamer HP Victus"
- [ ] Garde cette page ouverte sur l'écran de présentation, search bar vide, prête à taper

---

## PARTIE 2 — Démonstration en direct devant le jury

Tu es sur **Monitoring Reco IA** (sidebar admin, icône speedomètre). Le titre affiché : *"Monitoring Recommandation IA — Pertinence sémantique, confiance système, NLP et données blockchain — calculés en temps réel."* Juste dessous, le bandeau formule est déjà visible :
`finalScore = 0.6 × semanticScore + 0.4 × trustScore`

### Phrase d'ouverture
> "Cette page n'est pas destinée à l'acheteur — c'est un outil de monitoring admin que j'ai construit pour vous montrer, en transparence totale, comment le moteur de recommandation calcule chaque score, en temps réel, à partir des données blockchain, de la base PostgreSQL et de l'analyse NLP. Je vais vous montrer 4 situations qui prouvent que ce n'est pas une formule statique, mais un système qui s'adapte aux données réelles de chaque produit."

---

### Scénario 1 — Le filtre de seuil sémantique (≈1 min)

**Action** : tape `voiture` dans la barre de recherche, clique **Analyser**.

**Ce qui s'affiche** : la carte KPI "Non retenus" passe à **15**, "Retenus" à **0**, message *"Aucun produit pertinent pour 'voiture'"*.

**Discours :**
> "Notre catalogue ne vend ni voitures ni rien qui s'en approche. Le système ne renvoie aucun résultat — il ne force jamais une réponse. Chaque produit est comparé à la requête avec un score de pertinence sémantique entre 0 et 1, et un seuil minimum de **0.10** est appliqué : en dessous, le produit est explicitement rejeté plutôt que de polluer les résultats avec du bruit."

**Action** : efface, tape `pc gamer`, clique **Analyser**.

**Ce qui s'affiche** : KPI "Retenus" = **7**, "Non retenus" = **8**. Déplie la section *"Produits analysés mais non retenus (8)"*.

**Discours :**
> "Là, le système identifie correctement 7 produits pertinents — et rejette les 8 autres : câbles, chargeurs, coques de téléphone… Aucun de ces produits ne contient de vocabulaire lié à 'PC gamer' dans son profil sémantique, donc ils sont écartés automatiquement, avant même de calculer un score de confiance. C'est la première brique : la pertinence sémantique. Maintenant, parmi les 7 retenus, regardons comment le système les classe entre eux — et c'est là que ça devient intéressant."

---

### Scénario 2 — Comparaison multi-vendeurs (LE scénario clé) (~6-7 min)

Tu es toujours sur les résultats de `pc gamer`. Les 3 premières cartes sont, dans l'ordre : **PC Gamer HP Victus** (#1), puis un produit du catalogue d'origine, puis **PC Gamer Asus ROG Strix** (#3) et **MacBook Air M2 reconditionné** (#4). Pointe directement HP Victus, Asus ROG, MacBook — ce sont nos 3 vendeurs de PC gamer.

> "Voici trois vendeurs différents qui proposent chacun un PC gamer. Je vais décomposer leur classement en plusieurs étapes pour vous montrer exactement ce qui fait gagner ou perdre des points."

#### Mini-scénario 2.1 — Le classement brut : la pertinence ne suffit pas

Pointe les chips en haut de chaque carte (HP Victus, Asus, MacBook) : **Pertinence 100%** sur les trois.

> "Premier constat : les trois produits ont exactement la même pertinence sémantique, 100%. Pour le moteur de recherche, ce sont trois 'PC gamer' tout aussi valides les uns que les autres. Pourtant regardez le score final : HP Victus **0.983**, Asus ROG **0.900**, MacBook **0.782**. Cet écart de 20 points ne vient donc que d'une seule chose : la **confiance système** — 96% pour HP, 75% pour Asus, 45% pour le MacBook. C'est tout l'historique du vendeur qui fait la différence, pas le texte de l'annonce."

#### Mini-scénario 2.2 — Volume de ventes et fiabilité de livraison

Déplie la carte **HP Victus**, montre la colonne "Signaux blockchain" puis "Composants du trustScore".

> "HP Victus : 10 achats, 10 livraisons confirmées, 0 litige. Dans le tableau de droite, `purchaseScore` est à 1.000 — c'est le score maximum, plafonné à 10 achats pour éviter qu'un très gros vendeur écrase tout le monde uniquement par volume. `deliveryScore` est aussi à 1.000 : 100% de livraisons confirmées."

Déplie **Asus ROG Strix**.

> "Asus : seulement 6 achats. Son `purchaseScore` tombe à **0.600** — c'est mécanique, 6 divisé par 10. Sa livraison reste à 100% donc `deliveryScore` = 1.000, identique à HP. Sur ces deux composants-là, Asus perd uniquement sur le volume, pas sur la qualité de service."

#### Mini-scénario 2.3 — Litige et remboursement : la pénalité qui se mesure

Reste sur la carte **Asus**, pointe la ligne "Litiges" dans "Signaux blockchain" puis `disputePenalty` dans "Composants du trustScore".

> "Asus a eu **1 litige sur 6 commandes**, soit un taux de 17%. Il a été résolu en faveur du vendeur — l'acheteur n'a donc pas eu raison. Mais regardez : `disputePenalty` tombe quand même à **0.667**, alors qu'il était à 1.000 pour HP qui n'a eu aucun litige. Le système retient qu'un litige a existé, même tranché en faveur du vendeur, parce qu'un litige reste un signal de friction avec un client."

Déplie **MacBook Air M2 reconditionné**.

> "Le MacBook cumule plusieurs problèmes en même temps. Premier signal : `deliveryScore` = **0.75** — une commande sur quatre est encore en transit, jamais livrée. Deuxième signal : il a eu **1 litige sur 4 commandes**, cette fois résolu **en faveur de l'acheteur** — donc remboursé. Regardez la différence d'impact : `disputePenalty` descend à **0.5**, mais `refundPenalty` — qui ne se déclenche que si le litige est validé par un remboursement — tombe à **0.25**. Le poids du remboursement est volontairement 3 fois plus lourd dans la formule, parce qu'un remboursement confirme que le litige était fondé, alors qu'un litige seul peut être infondé."

#### Mini-scénario 2.4 — Le verdict

> "Ces pénalités se cumulent dans le `trustScore` final : 96% pour HP, qui n'a aucun problème ; 75% pour Asus, qui vend moins et a eu un litige sans gravité ; 45% pour le MacBook, qui cumule livraison incomplète, litige et remboursement. Le système ne se contente donc pas de regarder 'qui vend le plus' — il pondère la fiabilité réelle de chaque transaction."

---

### Scénario 3 — La nuance NLP au-delà de la simple note (~2 min)

Reste sur les mêmes 3 cartes. Sur la carte **Asus ROG Strix**, clique le bouton **"Voir les 2 avis NLP analysés"**.

**Discours :**
> "Regardons maintenant le détail des avis eux-mêmes. Le premier avis sur l'Asus dit : *'Le PC fonctionne bien dans l'ensemble mais le ventilateur est un peu bruyant.'* — l'acheteur lui a mis **4 étoiles sur 5**, une note plutôt bonne. Mais regardez la colonne Label et Score : le modèle NLP classe ce commentaire **négatif**, avec une confiance de 79%."

Pointe la colonne `Normalized [0;1]` : **0.104**.

> "Le modèle a détecté le mot 'mais' suivi d'une critique concrète — 'bruyant' — et a correctement identifié que, malgré la note polie de 4 étoiles, le sentiment réel exprimé est négatif. C'est exactement la valeur ajoutée du NLP : une note seule ne capture pas cette nuance, le texte si."

Déplie **MacBook**, ouvre son unique avis NLP.

> "À l'inverse, ici le commentaire — *'Produit reçu avec une rayure sur l'écran, pas conforme à la description'* — est classé négatif avec **96% de confiance**. Le modèle ne se trompe pas non plus quand le sentiment est sans ambiguïté : il le confirme avec une certitude très élevée. C'est cette confiance, `avgSentimentConfidence`, qui module elle-même le poids du signal NLP dans le calcul final."

---

### Scénario 4 — Pondération dynamique selon la couverture d'avis (~3 min)

**Action** : efface la recherche, tape `clavier mecanique rgb`, clique **Analyser**.

**Ce qui s'affiche** : 2 résultats, **Clavier Mécanique RGB Vortex** en #1, **Clavier Mécanique RGB Apex** en #2.

> "Ces deux claviers ont une pertinence sémantique de 100% chacun, le même volume de ventes — 20 commandes chacun —, 100% de livraison, et 0 litige. Sur le papier, des conditions strictement identiques. Pourtant, score final : Vortex **0.986**, Apex **0.933**. La seule différence va venir du nombre d'avis laissés par les acheteurs."

Déplie **Apex**, pointe le bloc "Couverture NLP" en bas de carte.

> "Sur 20 acheteurs, **un seul** a laissé un avis — 5% de couverture. Regardez la formule affichée directement à l'écran : `qualitySignal = 5% × sentimentQuality + 95% × ratingScore`. Avec aussi peu de retours, le système ne fait quasiment pas confiance au signal NLP — il se range à 95% sur la note brute. Et cette note brute n'est que 3 étoiles, donnée avec ce commentaire :" 

Ouvre l'avis NLP d'Apex : *"Plutôt satisfait mais léger cliquetis bizarre sur certaines touches, à voir sur la durée."*

> "Notez d'ailleurs que même ce commentaire commence par 'plutôt satisfait' — mais le modèle NLP le classe **négatif** à 80% de confiance, parce qu'il détecte le doute exprimé ensuite. Avec une seule donnée, le système reste prudent et ne laisse pas un avis isolé, même ambigu, dicter tout le score : il pèse à peine 5%."

Déplie **Vortex**.

> "Vortex, lui, a **6 avis sur 20 commandes** — 30% de couverture. La formule devient `qualitySignal = 30% × sentimentQuality + 70% × ratingScore`. Le système accorde maintenant un poids réel — 30% — au signal NLP, calculé sur 6 avis quasi unanimement positifs. Plus un produit a de retours fiables, plus le système ose s'appuyer sur l'analyse fine du texte plutôt que sur la seule moyenne arithmétique des étoiles. C'est ça, le poids NLP dynamique : il ne dépend pas d'un coefficient fixe écrit en dur, il dépend littéralement du volume de preuves disponibles pour chaque produit."

---

### Scénario 6 (bonus, si le temps le permet) — Robustesse sémantique (~1 min)

**Action** : efface, tape `ordinateur portable puissant` (au lieu de "pc gamer"), clique **Analyser**.

**Discours :**
> "Une dernière chose : ce classement n'est pas basé sur la correspondance exacte des mots-clés. Si je reformule complètement ma recherche — 'ordinateur portable puissant' au lieu de 'PC gamer' — regardez le classement : HP Victus, Laptop RTX 4070, Asus ROG, MacBook... exactement le même ordre, avec très exactement les mêmes scores qu'avant — 0.983, 0.916, 0.900, 0.782. Le système comprend l'intention derrière la requête, pas seulement les mots utilisés."

---

## Tableau récapitulatif des chiffres réels (pour toi, pas pour le jury)

| Produit | Achats | Livraison | Litiges | Remb. | Note | Couverture | trustScore | finalScore |
|---|---|---|---|---|---|---|---|---|
| PC Gamer HP Victus | 10 | 100% | 0 | 0 | 4.75/5 | 80% (8/10) | **0.957** | 0.983 |
| PC Asus ROG Strix | 6 | 100% | 1 (vendeur gagne) | 0 | 4.0/5 | 33% (2/6) | **0.751** | 0.900 |
| MacBook Air M2 recond. | 4 | 75% | 1 (acheteur gagne) | 1 | 2.0/5 | 25% (1/4) | **0.454** | 0.782 |
| Clavier RGB Vortex | 20 | 100% | 0 | 0 | 4.67/5 | 30% (6/20) | **0.964** | 0.986 |
| Clavier RGB Apex | 20 | 100% | 0 | 0 | 3.0/5 | 5% (1/20) | **0.833** | 0.933 |

(`finalScore` du Vortex/Apex donné pour la requête "clavier mecanique rgb" où `semanticScore`=100% pour les deux.)
