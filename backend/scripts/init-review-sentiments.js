/**
 * init-review-sentiments.js
 *
 * Lit les avis déjà présents sur la blockchain, appelle Flask NLP pour chacun,
 * et stocke les résultats dans PostgreSQL (review_sentiment).
 *
 * Idempotent — l'upsert ON CONFLICT garantit qu'un re-run ne crée pas de doublons.
 *
 * Prérequis : Hardhat node lancé, Flask (port 5001) lancé, PostgreSQL accessible.
 * Lancement  : node backend/scripts/init-review-sentiments.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { ethers } = require("ethers");
const path  = require("path");
const fs    = require("fs");
const pool  = require("../config/db");

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL          = process.env.WEB3_RPC_URL    || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const ML_URL           = process.env.ML_SERVICE_URL   || "http://localhost:5001";
const CONCURRENCY      = 1; // avis analysés séquentiellement (évite MemoryError au chargement NLP)

// ── Helpers ───────────────────────────────────────────────────────────────────

function getContract() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const abiPath  = path.join(__dirname, "../abi/Marketplace.json");
  const { abi }  = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  return new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
}

async function fetchSentiment(text) {
  const res = await fetch(`${ML_URL}/api/analyze-review`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text }),
    signal:  AbortSignal.timeout(40000),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Flask analyze-review échoué");
  return json.data;
}

async function upsertSentiment(contractProductId, reviewerAddress, orderId, rawText, s) {
  await pool.query(
    `INSERT INTO review_sentiment
       (contract_product_id, reviewer_address, order_id, raw_text,
        label, score, normalized_score, confidence,
        prob_positive, prob_neutral, prob_negative)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      rawText,
      s.label,
      s.score,
      s.normalizedScore,
      s.confidence,
      s.probabilities.positive,
      s.probabilities.neutral,
      s.probabilities.negative,
    ]
  );
}

// Exécute un tableau de tâches par batch de `size` en parallèle
async function batchRun(tasks, size) {
  const results = [];
  for (let i = 0; i < tasks.length; i += size) {
    const batch = tasks.slice(i, i + size).map(fn => fn());
    results.push(...await Promise.all(batch));
  }
  return results;
}

// ── Lecture blockchain ────────────────────────────────────────────────────────

async function readBlockchain() {
  const contract = getContract();

  const [productCount, orderCount] = await Promise.all([
    contract.productCount(),
    contract.orderCount(),
  ]);

  // Produits
  const productIds = Array.from({ length: Number(productCount) }, (_, i) => i + 1);
  const products   = (await Promise.all(
    productIds.map(id => contract.products(id).then(p => ({ id: Number(p.id), exists: p.exists })).catch(() => null))
  )).filter(p => p && p.exists);

  // Commandes
  const orderIds = Array.from({ length: Number(orderCount) }, (_, i) => i + 1);
  const orders   = (await Promise.all(
    orderIds.map(id =>
      contract.orders(id)
        .then(o => ({
          id:        Number(o.id),
          productId: Number(o.productId),
          buyer:     o.buyer.toLowerCase(),
          exists:    o.exists,
        }))
        .catch(() => null)
    )
  )).filter(o => o && o.exists);

  // Avis (par produit)
  const reviewArrays = await Promise.all(
    products.map(async p => {
      try {
        const count = await contract.getReviewsCount(p.id);
        const revs  = [];
        for (let i = 0; i < Number(count); i++) {
          const r = await contract.getReview(p.id, i);
          revs.push({
            productId: p.id,
            orderId:   Number(r.orderId),
            reviewer:  r.reviewer.toLowerCase(),
            rating:    Number(r.rating),
            // Le seed stocke le commentaire directement dans ipfsHash
            rawText:   r.ipfsHash || "",
          });
        }
        return revs;
      } catch { return []; }
    })
  );

  return { reviews: reviewArrays.flat(), orders };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║   Init Review Sentiments — BlockBay NLP           ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");

  // 1. Lecture blockchain
  process.stdout.write("📡 Lecture de la blockchain… ");
  let reviews, orders;
  try {
    ({ reviews, orders } = await readBlockchain());
    console.log(`OK — ${reviews.length} avis, ${orders.length} commandes\n`);
  } catch (err) {
    console.error(`\n❌ Erreur blockchain : ${err.message}`);
    console.error("   → Vérifie que Hardhat node est lancé sur le port 8545.");
    process.exit(1);
  }

  if (reviews.length === 0) {
    console.log("⚠️  Aucun avis sur la blockchain — lance seed.js d'abord.");
    process.exit(0);
  }

  // 2. Test Flask
  process.stdout.write("🔥 Vérification du service Flask NLP… ");
  try {
    const probe = await fetch(`${ML_URL}/health`, { signal: AbortSignal.timeout(8000) });
    const json  = await probe.json();
    console.log(`OK — ${json.status || "up"}\n`);
  } catch {
    console.error("\n❌ Service Flask inaccessible sur " + ML_URL);
    console.error("   → Lance le microservice Python : cd ml-service && python app.py");
    process.exit(1);
  }

  // 3. Chaque avis porte déjà son orderId d'origine (stocké on-chain à la review)
  const orderIds = new Set(orders.map(o => o.id));
  const withOrder    = reviews.filter(r => r.orderId && orderIds.has(r.orderId));
  const withoutOrder = reviews.filter(r => !r.orderId || !orderIds.has(r.orderId));

  if (withoutOrder.length > 0) {
    console.log(`⚠️  ${withoutOrder.length} avis sans commande associée (ignorés) :`);
    withoutOrder.forEach(r => console.log(`   • Produit #${r.productId} — ${r.reviewer.slice(0, 10)}…`));
    console.log();
  }

  console.log(`🔬 Analyse NLP de ${withOrder.length} avis (concurrence: ${CONCURRENCY})…\n`);

  // 4. Analyse et stockage
  const stats = { analyzed: 0, skipped: 0, errors: 0 };
  const perProduct = {};

  const tasks = withOrder.map(review => async () => {
    const { productId, reviewer, orderId, rawText, rating } = review;
    const text = rawText.trim() || `Note ${rating}/5 — avis sans commentaire`;

    if (!perProduct[productId]) {
      perProduct[productId] = { count: 0, scores: [], labels: { positive: 0, neutral: 0, negative: 0 } };
    }

    const prefix = `  Produit #${String(productId).padEnd(2)} | Cmd #${String(orderId).padEnd(3)} | `;
    const preview = text.length > 45 ? text.slice(0, 45) + "…" : text.padEnd(46);
    process.stdout.write(`${prefix}"${preview}" → `);

    try {
      const sentiment = await fetchSentiment(text);
      await upsertSentiment(productId, reviewer, orderId, text, sentiment);

      const label = sentiment.label.padEnd(8);
      const norm  = sentiment.normalizedScore.toFixed(3);
      const conf  = (sentiment.confidence * 100).toFixed(0).padStart(2) + "%";
      console.log(`✅ ${label} norm:${norm}  conf:${conf}`);

      stats.analyzed++;
      perProduct[productId].count++;
      perProduct[productId].scores.push(sentiment.normalizedScore);
      perProduct[productId].labels[sentiment.label] =
        (perProduct[productId].labels[sentiment.label] || 0) + 1;
    } catch (err) {
      console.log(`❌ ${err.message.slice(0, 60)}`);
      stats.errors++;
    }
  });

  stats.skipped = withoutOrder.length;
  await batchRun(tasks, CONCURRENCY);

  // 5. Résumé
  const line = "═".repeat(56);
  console.log(`\n╔${line}╗`);
  console.log(`║  RÉSUMÉ FINAL${" ".repeat(42)}║`);
  console.log(`╠${line}╣`);
  console.log(`║  Total avis blockchain   : ${String(reviews.length).padEnd(28)}║`);
  console.log(`║  Analysés et stockés     : ${String(stats.analyzed).padEnd(28)}║`);
  console.log(`║  Ignorés (sans cmd)      : ${String(stats.skipped).padEnd(28)}║`);
  console.log(`║  Erreurs                 : ${String(stats.errors).padEnd(28)}║`);
  console.log(`╠${line}╣`);
  console.log(`║  Résumé par produit${" ".repeat(36)}║`);
  console.log(`╠${line}╣`);

  const pids = Object.keys(perProduct).sort((a, b) => Number(a) - Number(b));
  for (const pid of pids) {
    const p   = perProduct[pid];
    const avg = p.scores.length > 0
      ? (p.scores.reduce((s, x) => s + x, 0) / p.scores.length).toFixed(3)
      : " — ";
    const lbl = [
      p.labels.positive ? `+${p.labels.positive}` : "",
      p.labels.neutral  ? `○${p.labels.neutral}`  : "",
      p.labels.negative ? `-${p.labels.negative}`  : "",
    ].filter(Boolean).join("  ");
    const line2 = `  #${String(pid).padEnd(2)} │ ${p.count} avis │ avgNorm: ${avg} │ ${lbl}`;
    console.log(`║${line2.padEnd(56)}║`);
  }

  console.log(`╚${line}╝`);
  console.log("\n✅ Terminé. Ouvre le monitoring admin → Monitoring Reco IA.\n");

  await pool.end();
}

main().catch(err => {
  console.error("\n❌ Erreur fatale :", err.message);
  process.exit(1);
});
