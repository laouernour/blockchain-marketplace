/**
 * Seed de données de test pour la détection d'anomalies.
 *
 * Scénarios :
 *  - Seller A (TechShop)   : 6 commandes, 0 litige, note ~4.5  → NORMAL
 *  - Seller B (PromoFlash) : 6 commandes, 4 litiges, note ~1.8 → ANOMALIE vendeur
 *  - Seller C (MegaDeal)   : 12 commandes, 0 litige            → outlier volume
 *  - Buyer C               : 8 commandes, 4 litiges ouverts    → ANOMALIE acheteur
 *
 * Prérequis : hardhat node en cours + contrat déployé.
 * Lancement : node contracts/scripts/seed.js
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

// ── Comptes Hardhat (clés privées standard) ───────────────────────────────────
const PKS = {
  admin:     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  sellerA:   "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  sellerB:   "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  sellerC:   "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6", // Account 9
  buyerA:    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  buyerB:    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  buyerC:    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  buyerD:    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Account 2
  deliverer: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
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

// ── Helper : avancer le temps Hardhat ────────────────────────────────────────
async function advanceTime(seconds) {
  await pub.request({ method: "evm_increaseTime", params: [seconds] });
  await pub.request({ method: "evm_mine" });
}

// ── Helper : flux complet d'une commande ─────────────────────────────────────
async function order(buyerKey, sellerKey, productId, priceEth, opts = {}) {
  const deliverer = accs.deliverer.address;

  await tx(buyerKey,    "purchase",        [BigInt(productId)], parseEther(priceEth));
  const id = await getOrderCount();
  await tx(sellerKey,   "assignDeliverer", [BigInt(id), deliverer]);

  // Simuler un délai de transit réaliste (1–3 jours) entre assignation et livraison
  const transitDays = 1 + Math.floor(Math.random() * 3);
  await advanceTime(transitDays * 86400);

  await tx("deliverer", "confirmDelivery", [BigInt(id)]);

  if (opts.dispute) {
    await tx(buyerKey, "openDispute", [BigInt(id), "preuve_litige"]);
    // Résoudre certains litiges : buyer gagne si favorBuyer=true
    if (opts.resolve !== undefined) {
      await tx("admin", "resolveDispute", [BigInt(id), opts.resolve]);
    }
  } else {
    // Avancer de 49h pour passer le DISPUTE_WINDOW (48h) et libérer les fonds
    await advanceTime(49 * 3600);
    await tx(buyerKey, "releaseFunds", [BigInt(id)]);
  }

  if (opts.rating) {
    await tx(buyerKey, "submitReview", [BigInt(id), opts.rating, opts.comment ?? ""]);
  }
  process.stdout.write(".");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  BlockBay — Seed données de test IA  ║");
  console.log("╚══════════════════════════════════════╝\n");

  // ── 0. Vérification état initial ──────────────────────────────────────────
  const existingProducts = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "productCount" }));
  const existingOrders   = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "orderCount" }));
  const existingStores   = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "storeCount" }));
  if (existingProducts > 0 || existingOrders > 0 || existingStores > 0) {
    console.error(`\n⚠  Blockchain non vide (${existingStores} boutiques, ${existingProducts} produits, ${existingOrders} commandes).`);
    console.error("   Redéploie le contrat d'abord :");
    console.error("   cd contracts && npx hardhat node    (nouveau terminal)");
    console.error("   cd contracts && node scripts/deploy.js\n");
    process.exit(1);
  }

  // ── 1. Boutiques ──────────────────────────────────────────────────────────
  console.log("Création des boutiques...");
  await tx("sellerA", "createStore", ["TechShop",   "store_techshop"]);
  await tx("sellerB", "createStore", ["PromoFlash", "store_promoflash"]);
  await tx("sellerC", "createStore", ["MegaDeal",   "store_megadeal"]);
  console.log("✓ 3 boutiques (TechShop, PromoFlash, MegaDeal)\n");

  // ── 2. Produits ───────────────────────────────────────────────────────────
  console.log("Ajout des produits...");
  // Seller A — produits 1, 2, 3
  await tx("sellerA", "addProduct", [parseEther("0.05"), 20n, "laptop_rtx4070"]);
  await tx("sellerA", "addProduct", [parseEther("0.02"), 30n, "souris_gaming_pro"]);
  await tx("sellerA", "addProduct", [parseEther("0.03"), 20n, "casque_audio_hd"]);
  // Seller B — produits 4, 5
  await tx("sellerB", "addProduct", [parseEther("0.04"), 15n, "smartphone_offbrand"]);
  await tx("sellerB", "addProduct", [parseEther("0.06"), 10n, "tablette_basique"]);
  // Seller C — produits 6, 7, 8, 9, 10
  await tx("sellerC", "addProduct", [parseEther("0.01"),  50n, "cable_usbc"]);
  await tx("sellerC", "addProduct", [parseEther("0.015"), 50n, "adaptateur_hdmi"]);
  await tx("sellerC", "addProduct", [parseEther("0.02"),  40n, "coque_telephone"]);
  await tx("sellerC", "addProduct", [parseEther("0.025"), 30n, "support_telephone"]);
  await tx("sellerC", "addProduct", [parseEther("0.01"), 100n, "chargeur_rapide"]);
  console.log("✓ 10 produits (ID 1–10)\n");

  // ── 3. Seller A — Vendeur normal ──────────────────────────────────────────
  process.stdout.write("Seller A (normal)    ");
  await order("buyerA", "sellerA", 1, "0.05", { rating: 5, comment: "Excellent produit, tres satisfait de mon achat !" });
  await order("buyerB", "sellerA", 2, "0.02", { rating: 4, comment: "Bonne qualite pour le prix, je recommande" });
  await order("buyerC", "sellerA", 3, "0.03", { rating: 4, comment: "Conforme a la description, livraison rapide" });
  await order("buyerD", "sellerA", 1, "0.05", { rating: 5, comment: "Parfait, exactement ce que je cherchais" });
  await order("buyerA", "sellerA", 2, "0.02", { rating: 4, comment: "Tres bien, rien a redire sur la qualite" });
  await order("buyerB", "sellerA", 3, "0.03", { rating: 5, comment: "Impeccable, livraison soignee et rapide" });
  console.log("  → taux_litige=0, note≈4.5 [NORMAL attendu]");

  // ── 4. Seller B — Vendeur frauduleux ──────────────────────────────────────
  process.stdout.write("Seller B (fraude)    ");
  await order("buyerA", "sellerB", 4, "0.04", { dispute: true, resolve: true,  rating: 1, comment: "Arnaque totale, produit completement non conforme a l annonce !" });
  await order("buyerC", "sellerB", 5, "0.06", { dispute: true, resolve: true,  rating: 1, comment: "Produit defectueux, jamais recu tel que decrit" });
  await order("buyerD", "sellerB", 4, "0.04", { dispute: true, resolve: false, rating: 2, comment: "Qualite catastrophique, rien ne correspond a la description" });
  await order("buyerB", "sellerB", 5, "0.06", { dispute: true,                 rating: 2, comment: "Mauvaise experience, probleme non resolu correctement" });
  await order("buyerA", "sellerB", 4, "0.04", { rating: 3, comment: "Mediocre, a peine utilisable" });
  await order("buyerC", "sellerB", 5, "0.06", { rating: 2, comment: "Pas terrible, qualite vraiment decevante" });
  console.log("  → taux_litige=4/6=0.67, note≈1.8 [ANOMALIE attendue]");

  // ── 5. Seller C — Volume outlier ──────────────────────────────────────────
  process.stdout.write("Seller C (volume)    ");
  const cOrders = [
    ["buyerA", 6,  "0.01",  5, "Parfait petit accessoire USB, fonctionne super bien"],
    ["buyerB", 7,  "0.015", 4, "Adaptateur tres pratique, bonne compatibilite"],
    ["buyerD", 8,  "0.02",  4, "Coque protectrice solide et bien ajustee"],
    ["buyerA", 9,  "0.025", 5, "Support tres pratique, stable et reglable facilement"],
    ["buyerB", 10, "0.01",  4, "Chargeur rapide et compact, tres bon rapport qualite prix"],
    ["buyerC", 6,  "0.01",  5, "Excellent cable, charge vraiment vite comme annonce"],
    ["buyerD", 7,  "0.015", 4, "Bon adaptateur, image 4K nette sans probleme"],
    ["buyerA", 8,  "0.02",  5, "Coque bien faite, protege vraiment bien le telephone"],
    ["buyerB", 9,  "0.025", 4, "Support stable et facile a installer sur le bureau"],
    ["buyerC", 10, "0.01",  5, "Chargeur nickel, charge complete en moins d une heure"],
    ["buyerD", 6,  "0.01",  4, "Cable de bonne qualite, dure bien dans le temps"],
    ["buyerA", 7,  "0.015", 5, "Adaptateur parfait pour mes presentations"],
  ];
  for (const [b, p, pr, r, c] of cOrders) {
    await order(b, "sellerC", p, pr, { rating: r, comment: c });
  }
  console.log("  → 12 commandes, volume outlier [ANOMALIE possible]");

  // ── 6. Buyer C — Acheteur litigieux (litiges supplémentaires) ─────────────
  process.stdout.write("Buyer C (litiges+)   ");
  await order("buyerC", "sellerA", 2, "0.02", { dispute: true, resolve: true,  rating: 1, comment: "Commande pas conforme, j exige un remboursement" });
  await order("buyerC", "sellerC", 8, "0.02", { dispute: true, resolve: false, rating: 1, comment: "Probleme avec cette commande, pas satisfait du tout" });
  await order("buyerC", "sellerA", 3, "0.03", { dispute: true,                 rating: 1, comment: "Encore un probleme, comportement inacceptable du vendeur" });
  console.log("  → total 8 commandes, 4 litiges, taux=0.5 [ANOMALIE attendue]\n");

  // ── Résumé ────────────────────────────────────────────────────────────────
  const nOrders   = await getOrderCount();
  const nProducts = Number(await pub.readContract({ address: CONTRACT, abi, functionName: "productCount" }));

  console.log("╔══════════════════════════════════════╗");
  console.log(`║  ${nProducts} produits  •  ${nOrders} commandes           ║`);
  console.log("╠══════════════════════════════════════╣");
  console.log("║  Seller A  0x7099…79C8  NORMAL       ║");
  console.log("║  Seller B  0x3C44…93BC  ANOMALIE ★   ║");
  console.log("║  Seller C  0x2361…1e8f  outlier vol  ║");
  console.log("║  Buyer C   0x976E…0aa9  ANOMALIE ★   ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("\n→ Lance ensuite : node backend/scripts/seed-db.js");
}

main().catch(e => { console.error(e); process.exitCode = 1; });
