const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("POST /products body:", req.body);

    const {
      contractProductId,
      sellerAddress,
      name,
      description,
      category,
      imageIpfsHash,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO products
      (contract_product_id, seller_address, name, description, category, image_ipfs_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        contractProductId,
        sellerAddress,
        name,
        description,
        category,
        imageIpfsHash,
      ]
    );

    res.json({
      success: true,
      message: "Produit enregistré en base",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur POST /products :", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;