/**
 * Moteur de recommandation par recherche — BlockBay
 *
 * Score final = 0.6 × semanticScore + 0.4 × trustScore
 *
 * trustScore (somme des poids = 1.00) :
 *   0.25 × qualitySignal   — qualité review (NLP si bien couvert, rating sinon)
 *   0.15 × ratingScore     — note blockchain explicite
 *   0.20 × purchaseScore   — popularité (cap 10 achats)
 *   0.20 × deliveryScore   — fiabilité livraison
 *   0.15 × disputePenalty  — pénalité litiges
 *   0.05 × refundPenalty   — pénalité remboursements
 *
 * qualitySignal = reviewCoverage × sentimentQuality + (1 − reviewCoverage) × ratingScore
 *   reviewCoverage = commentCount / purchases  (poids NLP dynamique)
 *   sentimentQuality = avgNormalizedScore × avgConfidence
 */

const pool = require("../config/db");

const SELF_URL         = `http://localhost:${process.env.PORT || 5000}`;
const INTENT_THRESHOLD = 0.10;
const DEFAULT_LIMIT    = 5;

// ── Tokenisation (bilingue FR/EN, sans accents) ───────────────────────────────

function tokenize(text) {
  if (!text || typeof text !== "string") return new Set();
  return new Set(
    text.toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1)
  );
}

// ── Score sémantique : fraction des tokens requête trouvés dans le produit ────

function computeSemanticScore(queryTokens, product) {
  if (queryTokens.size === 0) return 0;
  const corpus = tokenize([
    product.semantic_profile || "",
    product.name             || "",
    product.description      || "",
    product.category         || "",
  ].join(" "));
  let hits = 0;
  for (const t of queryTokens) {
    if (corpus.has(t)) hits++;
  }
  return hits / queryTokens.size;
}

// ── Score de confiance produit ────────────────────────────────────────────────

function computeTrustScore(productId, stock, orders, reviews, sentiments) {
  const pOrders  = orders.filter(o => o.productId      === productId);
  const pReviews = reviews.filter(r => r.productId     === productId);
  const pSents   = sentiments.filter(s => Number(s.contract_product_id) === productId);

  const purchases  = pOrders.length;
  const delivered  = pOrders.filter(o => o.delivered).length;
  const disputed   = pOrders.filter(o => o.disputed || o.disputeResolved).length;
  const refunded   = pOrders.filter(o => o.disputeResolved && o.buyerWon).length;
  const ratings    = pReviews.map(r => r.rating).filter(r => r > 0);
  const commentCnt = pSents.length;

  // Taux
  const deliveryRate = purchases > 0 ? delivered / purchases : 1.0;
  const disputeRate  = purchases > 0 ? disputed  / purchases : 0.0;
  const refundRate   = purchases > 0 ? refunded  / purchases : 0.0;
  const avgRating    = ratings.length > 0
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 3.0; // neutre si aucun avis

  // Composants individuels [0, 1]
  const ratingScore    = avgRating / 5;
  const purchaseScore  = Math.min(1, purchases / 10);
  const deliveryScore  = deliveryRate;
  const disputePenalty = 1 - Math.min(1, disputeRate * 2);  // ×2 : litiges pèsent fort
  const refundPenalty  = 1 - Math.min(1, refundRate  * 3);  // ×3 : remboursements pèsent très fort
  const stockScore     = Math.min(1, (stock || 0) / 5);

  // Poids NLP dynamique : proportionnel à la couverture des avis commentés
  const reviewCoverage = purchases > 0 ? Math.min(1, commentCnt / purchases) : 0;

  let avgNormSentiment = 0.5; // neutre si aucun avis NLP
  let avgConfidence    = 0.0;
  if (commentCnt > 0) {
    avgNormSentiment = pSents.reduce((acc, s) => acc + parseFloat(s.normalized_score), 0) / commentCnt;
    avgConfidence    = pSents.reduce((acc, s) => acc + parseFloat(s.confidence),       0) / commentCnt;
  }
  // sentimentQuality = qualité NLP pondérée par la certitude du modèle
  const sentimentQuality = avgNormSentiment * avgConfidence;
  // qualitySignal : blend NLP ↔ rating selon couverture
  const qualitySignal = reviewCoverage * sentimentQuality + (1 - reviewCoverage) * ratingScore;

  const trustScore =
    0.25 * qualitySignal
    + 0.15 * ratingScore
    + 0.20 * purchaseScore
    + 0.20 * deliveryScore
    + 0.15 * disputePenalty
    + 0.05 * refundPenalty;
  // stockScore non inclus dans trustScore : utilisé uniquement dans les signals

  return {
    trustScore:     round3(trustScore),
    reviewCoverage: round2(reviewCoverage),
    scoreComponents: {
      qualitySignal:          round3(qualitySignal),
      ratingScore:            round3(ratingScore),
      purchaseScore:          round3(purchaseScore),
      deliveryScore:          round3(deliveryScore),
      disputePenalty:         round3(disputePenalty),
      refundPenalty:          round3(refundPenalty),
      reviewCoverage:         round2(reviewCoverage),
      sentimentQuality:       round3(sentimentQuality),
      avgSentimentScore:      commentCnt > 0 ? round3(avgNormSentiment) : null,
      avgSentimentConfidence: commentCnt > 0 ? round3(avgConfidence)    : null,
    },
    signals: {
      purchases,
      delivered,
      reviewsCount:  ratings.length,
      commentCount:  commentCnt,
      avgRating:     ratings.length > 0 ? round2(avgRating) : null,
      disputes:      disputed,
      refunds:       refunded,
      deliveryRate:  round2(deliveryRate),
      disputeRate:   round2(disputeRate),
      refundRate:    round2(refundRate),
      stock:         stock || 0,
      stockScore:    round2(stockScore),
    },
  };
}

// ── Explication lisible ───────────────────────────────────────────────────────

function generateExplanation(semScore, trustScore, signals) {
  const parts = [];

  if      (semScore >= 0.8) parts.push("Très pertinent pour la recherche");
  else if (semScore >= 0.4) parts.push("Pertinent pour la recherche");
  else                       parts.push("Partiellement pertinent");

  if      (trustScore >= 0.7) parts.push("haute confiance système");
  else if (trustScore >= 0.5) parts.push("confiance modérée");
  else                         parts.push("confiance limitée");

  if (signals.disputes > 0 && signals.disputeRate > 0.3)
    parts.push(`taux de litiges élevé (${Math.round(signals.disputeRate * 100)}%)`);
  if (signals.refunds > 0 && signals.refundRate > 0.2)
    parts.push(`remboursements fréquents (${Math.round(signals.refundRate * 100)}%)`);
  if (signals.deliveryRate < 0.7 && signals.purchases > 0)
    parts.push("livraison peu fiable");
  if (signals.purchases === 0)
    parts.push("aucun achat enregistré");
  if (signals.commentCount > 0)
    parts.push(`${signals.commentCount} avis NLP analysé(s)`);

  return parts.join(", ") + ".";
}

// ── Récupération des données ──────────────────────────────────────────────────

async function fetchBlockchainData() {
  const resp = await fetch(`${SELF_URL}/ai/blockchain-data`, {
    signal: AbortSignal.timeout(20000),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || "Erreur lecture blockchain");
  return data.data; // { products, orders, reviews }
}

async function fetchProductsMeta() {
  const { rows } = await pool.query(
    `SELECT contract_product_id, name, description, category, image_ipfs_hash, semantic_profile
     FROM products
     ORDER BY contract_product_id`
  );
  return rows;
}

async function fetchSentiments() {
  const { rows } = await pool.query(
    `SELECT contract_product_id, normalized_score, confidence, label, score
     FROM review_sentiment`
  );
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const round2 = n => Math.round(n * 100)  / 100;
const round3 = n => Math.round(n * 1000) / 1000;

// ── Point d'entrée public ─────────────────────────────────────────────────────

async function recommend(query = "", limit = DEFAULT_LIMIT) {
  const queryTokens = tokenize(query);
  const safeLimit   = Math.min(Math.max(1, parseInt(limit) || DEFAULT_LIMIT), 20);

  // Chargement parallèle des 3 sources de données
  const [dbProducts, blockchainData, sentiments] = await Promise.all([
    fetchProductsMeta(),
    fetchBlockchainData(),
    fetchSentiments(),
  ]);

  const { products: bProducts, orders, reviews } = blockchainData;

  const accepted = [];
  const rejected = [];

  for (const dbProd of dbProducts) {
    const productId = dbProd.contract_product_id;
    const semScore  = computeSemanticScore(queryTokens, dbProd);

    if (semScore < INTENT_THRESHOLD) {
      rejected.push({
        productId,
        name:   dbProd.name,
        reason: "Produit hors intention de recherche",
      });
      continue;
    }

    const bProd = bProducts.find(p => p.id === productId) || {};
    const stock = bProd.stock ?? 0;

    const { trustScore, reviewCoverage, scoreComponents, signals } = computeTrustScore(
      productId, stock, orders, reviews, sentiments
    );

    const finalScore = round3(0.6 * semScore + 0.4 * trustScore);

    accepted.push({
      productId,
      name:           dbProd.name,
      description:    dbProd.description,
      category:       dbProd.category,
      imageIpfsHash:  dbProd.image_ipfs_hash || "",
      priceEth:       bProd.price_eth != null ? String(bProd.price_eth) : "0",
      stock,
      score:          finalScore,
      finalScore,
      semanticScore:  round3(semScore),
      trustScore,
      reviewCoverage,
      scoreComponents,
      signals,
      explanation:    generateExplanation(semScore, trustScore, signals),
    });
  }

  accepted.sort((a, b) => b.score - a.score);

  return {
    query,
    count:    Math.min(accepted.length, safeLimit),
    data:     accepted.slice(0, safeLimit),
    rejected,
    summary: {
      totalProducts: dbProducts.length,
      accepted:      accepted.length,
      rejected:      rejected.length,
      threshold:     INTENT_THRESHOLD,
    },
    formula:  "finalScore = 0.6 × semanticScore + 0.4 × trustScore",
    weights: {
      semantic: 0.6,
      trust:    0.4,
      trustComponents: {
        qualitySignal:  0.25,
        ratingScore:    0.15,
        purchaseScore:  0.20,
        deliveryScore:  0.20,
        disputePenalty: 0.15,
        refundPenalty:  0.05,
      },
    },
  };
}

// ── Affinité sémantique profil acheteur ───────────────────────────────────────
// intersection(buyerTokens, productTokens) / productTokens.size
// "Quelle fraction des tokens du produit est présente dans l'historique acheteur ?"

function computeSemanticAffinity(buyerTokens, product) {
  if (buyerTokens.size === 0) return 0;
  const productTokens = tokenize([
    product.semantic_profile || "",
    product.name             || "",
    product.description      || "",
    product.category         || "",
  ].join(" "));
  if (productTokens.size === 0) return 0;
  let hits = 0;
  for (const t of productTokens) {
    if (buyerTokens.has(t)) hits++;
  }
  return hits / productTokens.size;
}

// ── Explication profil lisible ────────────────────────────────────────────────

function generateProfileExplanation(categoryAffinity, semanticAffinity, trustScore, alreadyBought, hasHistory) {
  if (!hasHistory) return "Produit populaire — aucun historique d'achat disponible.";
  const parts = [];
  if      (categoryAffinity >= 0.3) parts.push("catégorie proche de vos achats");
  else if (categoryAffinity > 0)    parts.push("catégorie achetée occasionnellement");
  if      (semanticAffinity >= 0.4) parts.push("profil très similaire à vos achats précédents");
  else if (semanticAffinity >= 0.2) parts.push("profil similaire à vos achats précédents");
  if      (trustScore >= 0.7)       parts.push("confiance système élevée");
  else if (trustScore < 0.4)        parts.push("confiance système limitée");
  if (alreadyBought)                parts.push("déjà acheté");
  if (parts.length === 0)           parts.push("nouveauté basée sur votre profil");
  return parts.join(", ") + ".";
}

// ── Recommandation par profil acheteur ────────────────────────────────────────

async function recommendByProfile(buyerAddress, limit = 8) {
  const safeAddress = buyerAddress.toLowerCase();
  const safeLimit   = Math.min(Math.max(1, parseInt(limit) || 8), 20);

  const [dbProducts, blockchainData, sentiments] = await Promise.all([
    fetchProductsMeta(),
    fetchBlockchainData(),
    fetchSentiments(),
  ]);

  const { products: bProducts, orders, reviews } = blockchainData;

  // Commandes de cet acheteur
  const buyerOrders    = orders.filter(o => o.buyer === safeAddress);
  const totalPurchases = buyerOrders.length;
  const boughtIds      = new Set(buyerOrders.map(o => o.productId));
  const hasHistory     = totalPurchases > 0;

  // Construction du profil catégorie + tokens sémantiques
  const categoryMap  = {};
  const profileTexts = [];

  if (hasHistory) {
    for (const order of buyerOrders) {
      const dbProd = dbProducts.find(p => p.contract_product_id === order.productId);
      if (!dbProd) continue;
      categoryMap[dbProd.category] = (categoryMap[dbProd.category] || 0) + 1;
      if (dbProd.semantic_profile) profileTexts.push(dbProd.semantic_profile);
    }
  }

  const buyerTokens     = tokenize(profileTexts.join(" "));
  const topCategories   = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  const profileKeywords = Array.from(buyerTokens).slice(0, 20);

  // Scoring de chaque produit du catalogue
  const scored = [];

  for (const dbProd of dbProducts) {
    const productId = dbProd.contract_product_id;
    const bProd     = bProducts.find(p => p.id === productId) || {};
    const stock     = bProd.stock ?? 0;

    const { trustScore, signals } = computeTrustScore(productId, stock, orders, reviews, sentiments);

    let categoryAffinity = 0;
    let semanticAffinity = 0;
    let profileScore;

    if (hasHistory) {
      categoryAffinity = (categoryMap[dbProd.category] || 0) / totalPurchases;
      semanticAffinity = computeSemanticAffinity(buyerTokens, dbProd);
      profileScore     = round3(0.45 * categoryAffinity + 0.25 * semanticAffinity + 0.30 * trustScore);
    } else {
      profileScore = round3(trustScore);
    }

    const alreadyBought = boughtIds.has(productId);

    scored.push({
      productId,
      name:             dbProd.name,
      description:      dbProd.description,
      category:         dbProd.category,
      imageIpfsHash:    dbProd.image_ipfs_hash || "",
      priceEth:         bProd.price_eth != null ? String(bProd.price_eth) : "0",
      stock,
      profileScore,
      categoryAffinity: round3(categoryAffinity),
      semanticAffinity: round3(semanticAffinity),
      trustScore,
      alreadyBought,
      signals,
      explanation: generateProfileExplanation(categoryAffinity, semanticAffinity, trustScore, alreadyBought, hasHistory),
    });
  }

  // Tri : non-achetés d'abord (profileScore DESC), puis déjà achetés
  const notBought = scored.filter(p => !p.alreadyBought).sort((a, b) => b.profileScore - a.profileScore);
  const bought    = scored.filter(p =>  p.alreadyBought).sort((a, b) => b.profileScore - a.profileScore);

  const sorted = [...notBought, ...bought];

  return {
    buyer: safeAddress,
    profileSummary: { totalPurchases, topCategories, profileKeywords, hasHistory },
    count:    Math.min(sorted.length, safeLimit),
    data:     sorted.slice(0, safeLimit),
    formula:  "profileScore = 0.45 × categoryAffinity + 0.25 × semanticAffinity + 0.30 × trustScore",
    fallback: !hasHistory,
  };
}

module.exports = { recommend, recommendByProfile };
