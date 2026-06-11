/**
 * Seed des métadonnées produits dans PostgreSQL.
 * À lancer APRÈS contracts/scripts/seed.js
 * Lancement : node backend/scripts/seed-db.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const pool = require("../config/db");

const PRODUCTS = [
  // Seller A — 0x70997970c51812dc3a010c7d01b50e0d17dc79c8
  {
    id: 1, seller: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    name: "Laptop RTX 4070",
    desc: "Ordinateur portable gaming haute performance, 16 Go RAM, SSD 512 Go",
    cat:  "Informatique & Accessoires",
    profile: "pc gamer ordinateur portable gaming laptop puissant powerful rtx 4070 haute performance high performance jeux video games informatique computer nvidia gpu",
  },
  {
    id: 2, seller: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    name: "Souris Gaming Pro",
    desc: "Souris gaming 7 boutons programmables, DPI ajustable jusqu a 16000",
    cat:  "Informatique & Accessoires",
    profile: "souris gaming mouse pro gamer 7 boutons buttons dpi ajustable adjustable precision peripherique accessoire informatique computer accessory",
  },
  {
    id: 3, seller: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    name: "Casque Audio HD",
    desc: "Casque audio sans fil avec reduction de bruit active, autonomie 30h",
    cat:  "Informatique & Accessoires",
    profile: "casque audio headset headphones sans fil wireless reduction bruit noise cancelling active gaming musique music autonomie battery stereo son sound",
  },
  // Seller B — 0x90f79bf6eb2c4f870365e785982e1f101e93b906
  {
    id: 4, seller: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    name: "Smartphone OffBrand",
    desc: "Smartphone generique 6.5 pouces, 4G, double SIM",
    cat:  "Électronique & High-Tech",
    profile: "smartphone telephone portable mobile phone 4g double sim ecran screen 6.5 pouces inch android generique generic pas cher budget",
  },
  {
    id: 5, seller: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    name: "Tablette Basique",
    desc: "Tablette Android 10 pouces, 3 Go RAM, 32 Go stockage",
    cat:  "Électronique & High-Tech",
    profile: "tablette tablet android 10 pouces inch portable ecran tactile touchscreen stockage storage ram pas cher budget education enfant kid",
  },
  // Seller C — 0xa0ee7a142d267c1f36714e4a8f75612f20a79720
  {
    id: 6, seller: "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    name: "Cable USB-C 2m",
    desc: "Cable USB-C charge rapide 100W, longueur 2m, compatible tous appareils",
    cat:  "Informatique & Accessoires",
    profile: "cable usb-c usbc charge rapide fast charging 100w 2 metres long compatible android smartphone tablette tablet chargeur charger data",
  },
  {
    id: 7, seller: "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    name: "Adaptateur HDMI 4K",
    desc: "Adaptateur USB-C vers HDMI 4K 60Hz, plug and play",
    cat:  "Informatique & Accessoires",
    profile: "adaptateur hdmi adapter usb-c usbc 4k 60hz television tv ecran monitor screen plug play cable video display connecteur converter",
  },
  {
    id: 8, seller: "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    name: "Coque Telephone",
    desc: "Coque de protection universelle silicone anti-choc",
    cat:  "Électronique & High-Tech",
    profile: "coque protection case cover telephone smartphone phone silicone anti-choc shockproof bumper housse universel universal transparent rigide",
  },
  {
    id: 9, seller: "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    name: "Support Telephone",
    desc: "Support de bureau reglable 360 degres, compatible tous smartphones",
    cat:  "Informatique & Accessoires",
    profile: "support bureau desk stand holder telephone smartphone phone reglable adjustable 360 degres degrees rotatif rotating bras arm fixation",
  },
  {
    id: 10, seller: "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
    name: "Chargeur Rapide GaN",
    desc: "Chargeur rapide 65W GaN compact, 2 ports USB-C + 1 USB-A",
    cat:  "Informatique & Accessoires",
    profile: "chargeur rapide charger fast charging gan 65w compact multiport usb-c usbc usb-a power delivery pd universel universal voyage travel laptop tablette",
  },
];

async function main() {
  console.log("Seed BDD — métadonnées produits\n");

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

  console.log("\n✓ Métadonnées insérées pour 10 produits (avec semantic_profile)");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
