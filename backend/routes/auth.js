const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Stockage temporaire des nonces (in-memory, un par adresse)
const nonces = new Map();

function buildMessage(nonce) {
  return `Bienvenue sur ChainMarket !\n\nSignez ce message pour vous connecter.\nCe message ne coûte aucun frais.\n\nNonce : ${nonce}`;
}

// GET /auth/nonce?address=0x...
router.get("/nonce", (req, res) => {
  const address = req.query.address?.toLowerCase();

  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ success: false, error: "Adresse invalide" });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  nonces.set(address, nonce);

  // Expiration automatique du nonce après 5 minutes
  setTimeout(() => nonces.delete(address), 5 * 60 * 1000);

  res.json({ success: true, nonce, message: buildMessage(nonce) });
});

// POST /auth/verify
router.post("/verify", (req, res) => {
  const { address, signature } = req.body;

  if (!address || !signature) {
    return res.status(400).json({ success: false, error: "Adresse et signature requises" });
  }

  const addr = address.toLowerCase();
  const nonce = nonces.get(addr);

  if (!nonce) {
    return res.status(400).json({ success: false, error: "Nonce expiré ou introuvable, reconnectez-vous" });
  }

  try {
    const message = buildMessage(nonce);
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();

    if (recovered !== addr) {
      return res.status(401).json({ success: false, error: "Signature invalide" });
    }

    // Nonce à usage unique : on le supprime
    nonces.delete(addr);

    const token = jwt.sign(
      { address: addr },
      process.env.JWT_SECRET,
      { expiresIn: "30s" }
    );

    res.json({ success: true, token });
  } catch (error) {
    console.error("Erreur vérification signature :", error);
    res.status(401).json({ success: false, error: "Échec de la vérification" });
  }
});

module.exports = router;
