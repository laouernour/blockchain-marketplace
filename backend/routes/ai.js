const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

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

module.exports = router;
