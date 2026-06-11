const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { recommend, recommendByProfile } = require("../services/recommendationEngine");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
const RPC_URL = process.env.WEB3_RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5fbdb2315678afecb367f032d93f642f64180aa3";

// ── Lecture blockchain ────────────────────────────────────────────────────────

function getContract() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const abiPath = path.join(__dirname, "../abi/Marketplace.json");
  const { abi } = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  return new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
}

router.get("/blockchain-data", async (req, res) => {
  try {
    const contract = getContract();

    const [productCount, orderCount] = await Promise.all([
      contract.productCount(),
      contract.orderCount(),
    ]);

    // Lire tous les produits en parallèle
    const productPromises = [];
    for (let i = 1; i <= Number(productCount); i++) {
      productPromises.push(contract.products(i).then(p => ({
        id: Number(p.id),
        storeId: Number(p.storeId),
        seller: p.seller.toLowerCase(),
        price_wei: p.price.toString(),
        price_eth: Number(ethers.formatEther(p.price)),
        stock: Number(p.stock),
        exists: p.exists,
      })).catch(() => null));
    }

    // Lire toutes les commandes en parallèle
    const orderPromises = [];
    for (let i = 1; i <= Number(orderCount); i++) {
      orderPromises.push(
        Promise.all([contract.orders(i), contract.orderTimestamp(i)])
          .then(([o, ts]) => ({
            id: Number(o.id),
            productId: Number(o.productId),
            buyer: o.buyer.toLowerCase(),
            deliverer: o.deliverer.toLowerCase(),
            amount_wei: o.amount.toString(),
            amount_eth: Number(ethers.formatEther(o.amount)),
            delivered: o.delivered,
            released: o.released,
            disputed: o.disputed,
            disputeResolved: o.disputeResolved,
            buyerWon: o.buyerWon,
            deliveryTimestamp: Number(o.deliveryTimestamp),
            createdAt: Number(ts),
            exists: o.exists,
          })).catch(() => null));
    }

    const [products, orders] = await Promise.all([
      Promise.all(productPromises),
      Promise.all(orderPromises),
    ]);

    // Lire les avis pour chaque produit
    const reviewPromises = products
      .filter(p => p && p.exists)
      .map(async p => {
        try {
          const count = await contract.getReviewsCount(p.id);
          const revs = [];
          for (let i = 0; i < Number(count); i++) {
            const r = await contract.getReview(p.id, i);
            revs.push({
              productId: p.id,
              reviewer:  r.reviewer.toLowerCase(),
              rating:    Number(r.rating),
              ipfsHash:  r.ipfsHash || "",
            });
          }
          return revs;
        } catch { return []; }
      });

    const reviewArrays = await Promise.all(reviewPromises);
    const reviews = reviewArrays.flat();

    res.json({
      success: true,
      data: {
        products: products.filter(p => p && p.exists),
        orders:   orders.filter(o => o && o.exists),
        reviews,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Proxy vers le service ML Python ──────────────────────────────────────────

const proxyML = async (path, res) => {
  try {
    const response = await fetch(`${ML_URL}${path}`, {
      signal: AbortSignal.timeout(120000),
    });
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(503).json({ success: false, error: "Service IA indisponible — lance le microservice Python" });
  }
};

router.get("/stats",     (req, res) => proxyML("/api/stats",     res));
router.get("/anomalies", (req, res) => proxyML("/api/anomalies", res));
router.get("/health",    (req, res) => proxyML("/health",        res));

// ── GET /ai/product-sentiments/:productId — avis NLP d'un produit ────────────

router.get("/product-sentiments/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ success: false, error: "productId invalide" });
  try {
    const { rows } = await pool.query(
      `SELECT
         contract_product_id  AS "contractProductId",
         reviewer_address     AS "reviewerAddress",
         order_id             AS "orderId",
         raw_text             AS "rawText",
         label,
         score,
         normalized_score     AS "normalizedScore",
         confidence,
         prob_positive,
         prob_neutral,
         prob_negative,
         analyzed_at
       FROM review_sentiment
       WHERE contract_product_id = $1
       ORDER BY analyzed_at DESC`,
      [productId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /ai/recommend-search — recommandations par recherche ─────────────────

router.get("/recommend-search", async (req, res) => {
  const { query = "", limit = 5 } = req.query;
  try {
    const result = await recommend(query, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[RECO] Erreur recommend-search:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /ai/recommend-profile — recommandations par profil acheteur ──────────

router.get("/recommend-profile", async (req, res) => {
  const { buyer = "", limit = 8 } = req.query;
  if (!/^0x[a-f0-9]{40}$/i.test(buyer)) {
    return res.status(400).json({ success: false, error: "Adresse acheteur invalide — format attendu : 0x suivi de 40 caractères hex" });
  }
  try {
    const result = await recommendByProfile(buyer, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[PROFILE] Erreur recommend-profile:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /ai/analyze-review-store — analyse NLP + persistance PostgreSQL ─────

router.post("/analyze-review-store", async (req, res) => {
  const { contractProductId, reviewerAddress, orderId, rawText } = req.body || {};

  if (!contractProductId || !reviewerAddress || !orderId) {
    return res.status(400).json({
      success: false,
      error: "Champs obligatoires manquants : contractProductId, reviewerAddress, orderId",
    });
  }

  const text = typeof rawText === "string" ? rawText : "";

  // ── 1. Appel Flask /api/analyze-review ──────────────────────────────────────
  let sentiment;
  try {
    const flaskRes = await fetch(`${ML_URL}/api/analyze-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(30000),
    });
    const flaskData = await flaskRes.json();
    if (!flaskData.success) {
      return res.status(500).json({ success: false, error: "Erreur NLP Flask", detail: flaskData.error });
    }
    sentiment = flaskData.data;
  } catch (err) {
    const isNetwork = err.name === "TimeoutError" || err.name === "AbortError" ||
      (err.cause && ["ECONNREFUSED", "ENOTFOUND"].includes(err.cause.code));
    if (isNetwork) {
      return res.status(503).json({ success: false, error: "Service IA indisponible — lance le microservice Python" });
    }
    console.error("[NLP] Erreur appel Flask:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }

  // ── 2. Persistance dans review_sentiment ────────────────────────────────────
  try {
    await pool.query(
      `INSERT INTO review_sentiment
         (contract_product_id, reviewer_address, order_id, raw_text,
          label, score, normalized_score, confidence,
          prob_positive, prob_neutral, prob_negative)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (contract_product_id, reviewer_address, order_id) DO UPDATE SET
         raw_text         = EXCLUDED.raw_text,
         label            = EXCLUDED.label,
         score            = EXCLUDED.score,
         normalized_score = EXCLUDED.normalized_score,
         confidence       = EXCLUDED.confidence,
         prob_positive    = EXCLUDED.prob_positive,
         prob_neutral     = EXCLUDED.prob_neutral,
         prob_negative    = EXCLUDED.prob_negative,
         analyzed_at      = CURRENT_TIMESTAMP`,
      [
        contractProductId,
        reviewerAddress.toLowerCase(),
        orderId,
        text,
        sentiment.label,
        sentiment.score,
        sentiment.normalizedScore,
        sentiment.confidence,
        sentiment.probabilities.positive,
        sentiment.probabilities.neutral,
        sentiment.probabilities.negative,
      ]
    );
    console.log(`[NLP] Stocké — produit ${contractProductId}, commande ${orderId}: ${sentiment.label} (${sentiment.score})`);
  } catch (err) {
    console.error("[NLP] Erreur PostgreSQL:", err.message);
    return res.status(500).json({ success: false, error: "Erreur stockage PostgreSQL", detail: err.message });
  }

  return res.json({ success: true, data: sentiment });
});

module.exports = router;
