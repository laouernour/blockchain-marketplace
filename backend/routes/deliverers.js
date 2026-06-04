const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// S'inscrire comme livreur disponible
router.post("/register", async (req, res) => {
  const { address } = req.body;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: "Adresse invalide" });
  }
  try {
    await pool.query(
      "INSERT INTO deliverer_candidates (address) VALUES ($1) ON CONFLICT DO NOTHING",
      [address.toLowerCase()]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Récupérer tous les livreurs disponibles
router.get(["", "/"], async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT address FROM deliverer_candidates ORDER BY registered_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
