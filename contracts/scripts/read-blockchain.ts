import hre from "hardhat";

const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

function formatEth(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4) + " ETH";
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function separator(title: string) {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

async function main() {
  const { viem } = await hre.network.connect();
  const contract = await viem.getContractAt("Marketplace", CONTRACT_ADDRESS as `0x${string}`);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         DONNÉES STOCKÉES DANS LE SMART CONTRACT          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Adresse contrat : ${CONTRACT_ADDRESS}`);
  console.log(`  Réseau          : Hardhat Localhost (chainId 31337)`);

  // ── Compteurs ──────────────────────────────────────────────
  const [storeCount, productCount, orderCount, admin] = await Promise.all([
    contract.read.storeCount(),
    contract.read.productCount(),
    contract.read.orderCount(),
    contract.read.admin(),
  ]);

  separator("COMPTEURS");
  console.log(`  Boutiques  : ${storeCount}`);
  console.log(`  Produits   : ${productCount}`);
  console.log(`  Commandes  : ${orderCount}`);
  console.log(`  Admin      : ${admin}`);

  // ── Boutiques ──────────────────────────────────────────────
  separator(`BOUTIQUES (${storeCount})`);
  for (let i = 1n; i <= storeCount; i++) {
    const s = await contract.read.stores([i]);
    if (s[4]) { // exists
      console.log(`  [Store #${s[0]}]`);
      console.log(`    Propriétaire : ${s[1]}`);
      console.log(`    Nom          : ${s[2]}`);
      console.log(`    IPFS Hash    : ${s[3] || "(vide)"}`);
    }
  }

  // ── Produits ───────────────────────────────────────────────
  separator(`PRODUITS (${productCount})`);
  for (let i = 1n; i <= productCount; i++) {
    const p = await contract.read.products([i]);
    if (p[6]) { // exists
      console.log(`  [Produit #${p[0]}]`);
      console.log(`    Boutique  : #${p[1]}`);
      console.log(`    Vendeur   : ${p[2]}`);
      console.log(`    Prix      : ${formatEth(p[3])}`);
      console.log(`    Stock     : ${p[4]}`);
      console.log(`    IPFS Hash : ${p[5] || "(vide)"}`);
    }
  }

  // ── Commandes ──────────────────────────────────────────────
  separator(`COMMANDES (${orderCount})`);
  for (let i = 1n; i <= orderCount; i++) {
    const o = await contract.read.orders([i]);
    if (o[14]) { // exists
      const ts = await contract.read.orderTimestamp([i]);
      const date = ts > 0n ? new Date(Number(ts) * 1000).toLocaleString("fr-FR") : "N/A";
      const deliverer = o[3] === "0x0000000000000000000000000000000000000000" ? "(non assigné)" : shortAddr(o[3]);

      let statut = "En attente";
      if (o[7]) statut = "En litige";
      else if (o[5] && o[6]) statut = "Terminé — fonds libérés";
      else if (!o[5] && o[6]) statut = "Remboursé";
      else if (o[5]) statut = "Livré — en attente libération";
      else if (o[12]) statut = "Retour approuvé";
      else if (o[11]) statut = "Retour demandé";

      console.log(`  [Commande #${o[0]}]`);
      console.log(`    Produit        : #${o[1]}`);
      console.log(`    Acheteur       : ${o[2]}`);
      console.log(`    Livreur        : ${deliverer}`);
      console.log(`    Montant        : ${formatEth(o[4])}`);
      console.log(`    Statut         : ${statut}`);
      console.log(`    Date achat     : ${date}`);
      if (o[10] > 0n) console.log(`    Date livraison : ${new Date(Number(o[10]) * 1000).toLocaleString("fr-FR")}`);
      if (o[9])  console.log(`    IPFS Litige    : ${o[9]}`);
    }
  }

  // ── Avis ───────────────────────────────────────────────────
  let totalReviews = 0;
  separator("AVIS PAR PRODUIT");
  for (let i = 1n; i <= productCount; i++) {
    const count = await contract.read.getReviewsCount([i]);
    if (count > 0n) {
      const avg = await contract.read.getAverageRating([i]);
      console.log(`  Produit #${i} — ${count} avis — Note moyenne : ${avg}/5`);
      for (let j = 0n; j < count; j++) {
        const r = await contract.read.getReview([i, j]);
        console.log(`    [Avis #${r[0]}] ${shortAddr(r[3])} — ★ ${r[4]}/5`);
      }
      totalReviews += Number(count);
    }
  }
  if (totalReviews === 0) console.log("  Aucun avis enregistré");

  // ── Résumé ─────────────────────────────────────────────────
  separator("RÉSUMÉ FINANCIER");
  let totalEth = 0n;
  let completed = 0;
  for (let i = 1n; i <= orderCount; i++) {
    const o = await contract.read.orders([i]);
    if (o[14]) {
      totalEth += o[4];
      if (o[6]) completed++;
    }
  }
  console.log(`  Volume total traité : ${formatEth(totalEth)}`);
  console.log(`  Commandes terminées : ${completed} / ${orderCount}`);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    FIN DES DONNÉES                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
