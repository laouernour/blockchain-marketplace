const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

router.get(["", "/"], async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products ORDER BY created_at DESC"
    );
    res.json({
      success: true,
      message: "Produits récupérés avec succès",
      data: result.rows,
    });
  } catch (error) {
    console.error("Erreur GET /products :", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { contractProductId, sellerAddress, name, description, category, imageIpfsHash } = req.body;

    // Validation
    if (!contractProductId || !Number.isInteger(Number(contractProductId)) || Number(contractProductId) <= 0) {
      return res.status(400).json({ success: false, error: "contractProductId invalide" });
    }
    if (!sellerAddress || !/^0x[a-fA-F0-9]{40}$/.test(sellerAddress)) {
      return res.status(400).json({ success: false, error: "Adresse vendeur invalide" });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, error: "Nom invalide (2 à 100 caractères)" });
    }
    if (description && description.length > 1000) {
      return res.status(400).json({ success: false, error: "Description trop longue (max 1000 caractères)" });
    }
    if (!category || typeof category !== "string" || category.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Catégorie requise" });
    }

    // Vérification que l'utilisateur authentifié est bien le vendeur
    if (req.user.address !== sellerAddress.toLowerCase()) {
      return res.status(403).json({ success: false, error: "Vous ne pouvez pas publier au nom d'une autre adresse" });
    }

    const result = await pool.query(
      `INSERT INTO products
        (contract_product_id, seller_address, name, description, category, image_ipfs_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (contract_product_id) DO UPDATE SET
         name            = EXCLUDED.name,
         description     = EXCLUDED.description,
         category        = EXCLUDED.category,
         image_ipfs_hash = EXCLUDED.image_ipfs_hash
       RETURNING *`,
      [
        Number(contractProductId),
        sellerAddress.toLowerCase(),
        name.trim(),
        description?.trim() || "",
        category.trim(),
        imageIpfsHash || "",
      ]
    );

    res.json({
      success: true,
      message: "Produit enregistré en base",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur POST /products :", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
