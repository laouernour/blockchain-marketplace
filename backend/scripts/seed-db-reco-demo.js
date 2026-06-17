/**
 * Seed des métadonnées (PostgreSQL) pour les 5 produits démo Recommandation Approche A.
 * À lancer APRÈS contracts/scripts/seed-reco-demo.js
 * Lancement : node backend/scripts/seed-db-reco-demo.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../config/db");

const PRODUCTS = [
  // sellerD — Account #10
  {
    id: 11, seller: "0xbcd4042de499d14e55001ccbb24a551f3b954096",
    name: "PC Gamer HP Victus",
    desc: "PC portable gamer HP Victus, RTX 4060, 16 Go RAM, SSD 1 To, ecran 144Hz",
    cat:  "Informatique & Accessoires",
    profile: "pc gamer ordinateur portable laptop puissant powerful gaming jeux video games informatique computer nvidia rtx amd processeur performance hp victus 144hz",
  },
  // sellerE — Account #11
  {
    id: 12, seller: "0x71be63f3384f5fb98995898a86b02fb2426c5788",
    name: "PC Gamer Asus ROG Strix",
    desc: "PC portable gamer Asus ROG Strix, RTX 4060, 16 Go RAM, SSD 512 Go, ecran 165Hz",
    cat:  "Informatique & Accessoires",
    profile: "pc gamer ordinateur portable laptop puissant powerful gaming jeux video games informatique computer nvidia rtx amd processeur performance asus rog strix 165hz",
  },
  // sellerF — Account #12
  {
    id: 13, seller: "0xfabb0ac9d68b0b445fb7357272ff202c5651694a",
    name: "MacBook Air M2 reconditionne",
    desc: "MacBook Air M2 reconditionne, 8 Go RAM, SSD 256 Go, autonomie longue duree",
    cat:  "Informatique & Accessoires",
    profile: "pc gamer ordinateur portable laptop puissant powerful gaming jeux video games informatique computer apple macbook air m2 reconditionne refurbished autonomie",
  },
  // sellerG — Account #13
  {
    id: 14, seller: "0x1cbd3b2770909d4e10f157cabc84c7264073c9ec",
    name: "Clavier Mecanique RGB Apex",
    desc: "Clavier mecanique gamer retroeclaire RGB, switches lineaires, anti-ghosting",
    cat:  "Informatique & Accessoires",
    profile: "clavier mecanique mechanical rgb gaming gamer keyboard switches retroeclaire backlit informatique peripherique accessoire apex",
  },
  // sellerH — Account #14
  {
    id: 15, seller: "0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097",
    name: "Clavier Mecanique RGB Vortex",
    desc: "Clavier mecanique gamer retroeclaire RGB, switches tactiles, repose-poignet inclus",
    cat:  "Informatique & Accessoires",
    profile: "clavier mecanique mechanical rgb gaming gamer keyboard switches retroeclaire backlit informatique peripherique accessoire vortex",
  },
];

async function main() {
  console.log("Seed BDD — métadonnées produits démo Recommandation\n");

  for (const p of PRODUCTS) {
    await pool.query(
      `INSERT INTO products (contract_product_id, seller_address, name, description, category, image_ipfs_hash, semantic_profile)
       VALUES ($1, $2, $3, $4, $5, '', $6)
       ON CONFLICT (contract_product_id) DO UPDATE SET
         name             = EXCLUDED.name,
         description      = EXCLUDED.description,
         category         = EXCLUDED.category,
         semantic_profile = EXCLUDED.semantic_profile`,
      [p.id, p.seller, p.name, p.desc, p.cat, p.profile]
    );
    console.log(`✓ Produit ${p.id} — ${p.name}`);
  }

  console.log("\n✓ Métadonnées insérées pour 5 produits démo (ID 11-15)");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
