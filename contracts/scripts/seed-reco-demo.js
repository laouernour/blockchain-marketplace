/**
 * Seed additif — démo Recommandation Approche A (jury).
 *
 * Ajoute 5 nouveaux produits / 5 nouveaux vendeurs, SANS toucher aux données
 * de seed.js (Seller A/B/C, Buyer A-D restent inchangés pour la démo anomalies).
 *
 * Scénario 2 (comparaison multi-vendeurs "PC gamer") :
 *  - PC Gamer HP Victus   (sellerD) : 10 cmd, 100% livré, 0 litige, 80% coverage, note ~4.75
 *  - PC Asus ROG Strix    (sellerE) :  6 cmd, 100% livré, 1 litige (vendeur gagne), 33% coverage, note ~4.0
 *  - MacBook Air M2 recond.(sellerF):  4 cmd, 75% livré (1 en transit), 1 litige (acheteur gagne/remboursé), 25% coverage, note 2.0
 *
 * Scénario 4 (pondération dynamique NLP selon couverture d'avis) :
 *  - Clavier Mécanique RGB Apex   (sellerG) : 20 cmd, 100% livré, 0 litige, coverage 5%  (1/20), note 3.0
 *  - Clavier Mécanique RGB Vortex (sellerH) : 20 cmd, 100% livré, 0 litige, coverage 30% (6/20), note ~4.67
 *
 * Prérequis : hardhat node + contrat déployé + contracts/scripts/seed.js déjà exécuté (10 produits existants).
 * Lancement : node contracts/scripts/seed-reco-demo.js
 */

import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { abi } = JSON.parse(
  readFileSync(
    join(__dirname, "../artifacts/contracts/Marketplace.sol/Marketplace.json"),
    "utf8"
  )
);

const CONTRACT = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const RPC      = "http://127.0.0.1:8545";

// ── Comptes Hardhat ───────────────────────────────────────────────────────────
// Réutilise admin/buyers/deliverer de seed.js. sellerD-H = comptes Hardhat #10-14,
// jamais utilisés par seed.js (aucune collision de rôle).
const PKS = {
  admin:     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  buyerA:    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  buyerB:    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  buyerC:    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  buyerD:    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  deliverer: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  sellerD:   "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897", // Account 10 — HP Victus
  sellerE:   "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82", // Account 11 — Asus ROG
  sellerF:   "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1", // Account 12 — MacBook
  sellerG:   "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd", // Account 13 — Clavier Apex
  sellerH:   "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa", // Account 14 — Clavier Vortex
};

const pub  = createPublicClient({ chain: hardhat, transport: http(RPC) });
const accs = Object.fromEntries(Object.entries(PKS).map(([k, pk]) => [k, privateKeyToAccount(pk)]));
const wals = Object.fromEntries(Object.entries(PKS).map(([k, pk]) => [k,
  createWalletClient({ account: privateKeyToAccount(pk), chain: hardhat, transport: http(RPC) })
]));

async function tx(role, fn, args, value) {
  const hash = await wals[role].writeContract({
    address: CONTRACT, abi, functionName: fn, args,
    ...(value !== undefined ? { value } : {}),
  });
  await pub.waitForTransactionReceipt({ hash });
}

async function getOrderCount() {
  return Number(await pub.readContract({ address: CONTRACT, abi, functionName: "orderCount" }));
}

async function advanceTime(seconds) {
  await pub.request({ method: "evm_increaseTime", params: [seconds] });
  await pub.request({ method: "evm_mine" });
}

// ── Flux complet d'une commande (achat → livraison → libération/litige → avis) ─
async function order(buyerKey, sellerKey, productId, priceEth, opts = {}) {
  const deliverer = accs.deliverer.address;

  await tx(buyerKey,    "purchase",        [BigInt(productId)], parseEther(priceEth));
  const id = await getOrderCount();
  await tx(sellerKey,   "assignDeliverer", [BigInt(id), deliverer]);

  const transitDays = 1 + Math.floor(Math.random() * 3);
  await advanceTime(transitDays * 86400);

  await tx("deliverer", "confirmDelivery", [BigInt(id)]);

  if (opts.dispute) {
    await tx(buyerKey, "openDispute", [BigInt(id), "preuve_litige"]);
    if (opts.resolve !== undefined) {
      await tx("admin", "resolveDispute", [BigInt(id), opts.resolve]);
    }
  } else {
    await advanceTime(49 * 3600);
    await tx(buyerKey, "releaseFunds", [BigInt(id)]);
  }

  if (opts.rating) {
    await tx(buyerKey, "submitReview", [BigInt(id), opts.rating, opts.comment ?? ""]);
  }
  process.stdout.write(".");
}

// ── Commande laissée "en transit" — jamais confirmDelivery (pour MacBook #4) ──
async function purchaseOnly(buyerKey, sellerKey, productId, priceEth) {
  const deliverer = accs.deliverer.address;
  await tx(buyerKey,  "purchase",        [BigInt(productId)], parseEther(priceEth));
  const id = await getOrderCount();
  await tx(sellerKey, "assignDeliverer", [BigInt(id), deliverer]);
  process.stdout.write(".");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║  BlockBay — Seed démo Recommandation (Jury)    ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  // ── 0. Vérification état initial (doit suivre seed.js) ─────────────────────
  const existingProducts = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "productCount" }));
  const existingStores   = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "storeCount" }));
  if (existingProducts !== 10 || existingStores !== 3) {
    console.error(`\n⚠  État inattendu (${existingStores} boutiques, ${existingProducts} produits).`);
    console.error("   Lance d'abord, dans l'ordre, sur un contrat fraîchement déployé :");
    console.error("   node contracts/scripts/seed.js");
    console.error("   puis : node contracts/scripts/seed-reco-demo.js\n");
    process.exit(1);
  }

  // ── 1. Boutiques ─────────────────────────────────────────────────────────
  console.log("Création des boutiques...");
  await tx("sellerD", "createStore", ["GamerTech",        "store_gamertech"]);
  await tx("sellerE", "createStore", ["ROG Boutique",     "store_rogboutique"]);
  await tx("sellerF", "createStore", ["ReconditionnePlus","store_recondplus"]);
  await tx("sellerG", "createStore", ["KeyMaster",        "store_keymaster_apex"]);
  await tx("sellerH", "createStore", ["RGB Peripherals",  "store_rgbperipherals"]);
  console.log("✓ 5 boutiques\n");

  // ── 2. Produits (IDs 11-15) ─────────────────────────────────────────────
  console.log("Ajout des produits...");
  await tx("sellerD", "addProduct", [parseEther("0.08"),  20n, "pc_gamer_hp_victus"]);   // 11
  await tx("sellerE", "addProduct", [parseEther("0.075"), 15n, "pc_gamer_asus_rog"]);    // 12
  await tx("sellerF", "addProduct", [parseEther("0.05"),  10n, "macbook_air_m2_recond"]);// 13
  await tx("sellerG", "addProduct", [parseEther("0.015"), 30n, "clavier_mecanique_apex"]);  // 14
  await tx("sellerH", "addProduct", [parseEther("0.018"), 30n, "clavier_mecanique_vortex"]);// 15
  console.log("✓ 5 produits (ID 11-15)\n");

  // ── 3. PC Gamer HP Victus (sellerD, id 11) — 10 cmd, 0 litige, 80% coverage ─
  process.stdout.write("PC Gamer HP Victus   ");
  await order("buyerA", "sellerD", 11, "0.08", { rating: 5, comment: "Livraison ultra rapide, le PC est exactement comme decrit, performances excellentes pour le prix !" });
  await order("buyerB", "sellerD", 11, "0.08", { rating: 5, comment: "Tres satisfait, aucun defaut, je recommande vivement ce vendeur." });
  await order("buyerC", "sellerD", 11, "0.08", { rating: 4, comment: "Tres bon PC, fonctionne parfaitement, juste un peu bruyant sous charge." });
  await order("buyerD", "sellerD", 11, "0.08", {});
  await order("buyerA", "sellerD", 11, "0.08", { rating: 5, comment: "Excellent rapport qualite prix, je suis impressionne par les performances en jeu." });
  await order("buyerB", "sellerD", 11, "0.08", { rating: 5, comment: "Parfait du debut a la fin, vendeur tres professionnel et reactif." });
  await order("buyerC", "sellerD", 11, "0.08", { rating: 4, comment: "Conforme a la description, livraison rapide et soignee." });
  await order("buyerD", "sellerD", 11, "0.08", {});
  await order("buyerA", "sellerD", 11, "0.08", { rating: 5, comment: "Aucun probleme, exactement ce que je voulais, merci !" });
  await order("buyerB", "sellerD", 11, "0.08", { rating: 5, comment: "Tres bonne experience d'achat, le PC tourne meme les jeux recents sans souci." });
  console.log("  → 10 cmd, 0 litige, 8/10 avis (80%), note≈4.75 [trustScore élevé attendu]");

  // ── 4. PC Asus ROG Strix (sellerE, id 12) — 6 cmd, 1 litige (vendeur gagne) ─
  process.stdout.write("PC Asus ROG Strix    ");
  await order("buyerA", "sellerE", 12, "0.075", {});
  await order("buyerB", "sellerE", 12, "0.075", { rating: 4, comment: "Le PC fonctionne bien dans l'ensemble mais le ventilateur est un peu bruyant." });
  await order("buyerC", "sellerE", 12, "0.075", { dispute: true, resolve: false });
  await order("buyerD", "sellerE", 12, "0.075", {});
  await order("buyerA", "sellerE", 12, "0.075", { rating: 4, comment: "Correct pour le prix, rien d'exceptionnel." });
  await order("buyerB", "sellerE", 12, "0.075", {});
  console.log("  → 6 cmd, 1 litige résolu vendeur (1/6=17%), 2/6 avis (33%), note≈4.0 [trustScore intermédiaire attendu]");

  // ── 5. MacBook Air M2 reconditionné (sellerF, id 13) — 4 cmd, 1 en transit ──
  process.stdout.write("MacBook Air M2 recond.");
  await order("buyerA", "sellerF", 13, "0.05", {});
  await order("buyerB", "sellerF", 13, "0.05", {});
  await order("buyerC", "sellerF", 13, "0.05", { dispute: true, resolve: true, rating: 2, comment: "Produit recu avec une rayure sur l'ecran, pas conforme a la description, j'ai du ouvrir un litige." });
  await purchaseOnly("buyerD", "sellerF", 13, "0.05");
  console.log("  → 4 cmd, 1 en transit (75% livré), 1 litige résolu acheteur/remboursé (25%), 1/4 avis (25%), note=2.0 [trustScore faible attendu]\n");

  // ── 6. Clavier Mécanique RGB Apex (sellerG, id 14) — 20 cmd, coverage 5% ───
  process.stdout.write("Clavier RGB Apex     ");
  await order("buyerA", "sellerG", 14, "0.015", { rating: 3, comment: "Plutot satisfait mais leger cliquetis bizarre sur certaines touches, a voir sur la duree." });
  for (let i = 0; i < 19; i++) {
    const buyer = ["buyerA", "buyerB", "buyerC", "buyerD"][i % 4];
    await order(buyer, "sellerG", 14, "0.015", {});
  }
  console.log("  → 20 cmd, 0 litige, 1/20 avis (5%), note=3.0 [coverage faible → poids NLP quasi nul]");

  // ── 7. Clavier Mécanique RGB Vortex (sellerH, id 15) — 20 cmd, coverage 30% ─
  process.stdout.write("Clavier RGB Vortex   ");
  await order("buyerA", "sellerH", 15, "0.018", { rating: 5, comment: "Excellent clavier, switches tres reactifs et RGB magnifique." });
  await order("buyerB", "sellerH", 15, "0.018", { rating: 5, comment: "Tres satisfait, qualite de fabrication au top, je recommande." });
  await order("buyerC", "sellerH", 15, "0.018", { rating: 4, comment: "Bon clavier mecanique, RGB sympa, leger temps d'adaptation au debut." });
  await order("buyerD", "sellerH", 15, "0.018", { rating: 5, comment: "Parfait pour le gaming, switches precis et silencieux." });
  await order("buyerA", "sellerH", 15, "0.018", { rating: 5, comment: "Aucun probleme, fonctionne parfaitement depuis 2 semaines." });
  await order("buyerB", "sellerH", 15, "0.018", { rating: 4, comment: "Tres bon produit, eclairage RGB personnalisable facilement." });
  for (let i = 0; i < 14; i++) {
    const buyer = ["buyerC", "buyerD", "buyerA", "buyerB"][i % 4];
    await order(buyer, "sellerH", 15, "0.018", {});
  }
  console.log("  → 20 cmd, 0 litige, 6/20 avis (30%), note≈4.67 [coverage forte → poids NLP significatif]\n");

  // ── Résumé ───────────────────────────────────────────────────────────────
  const nOrders   = await getOrderCount();
  const nProducts = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "productCount" }));

  console.log("╔════════════════════════════════════════════════╗");
  console.log(`║  ${nProducts} produits  •  ${nOrders} commandes (total)         ║`);
  console.log("╠════════════════════════════════════════════════╣");
  console.log("║  11 PC Gamer HP Victus    → trustScore haut     ║");
  console.log("║  12 PC Asus ROG Strix     → trustScore moyen    ║");
  console.log("║  13 MacBook Air M2 recond.→ trustScore bas      ║");
  console.log("║  14 Clavier RGB Apex      → coverage 5%         ║");
  console.log("║  15 Clavier RGB Vortex    → coverage 30%        ║");
  console.log("╚════════════════════════════════════════════════╝");
  console.log("\n→ Lance ensuite : node backend/scripts/seed-db-reco-demo.js");
}

main().catch(e => { console.error(e); process.exitCode = 1; });
