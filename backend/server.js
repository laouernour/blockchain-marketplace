require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const productsRoutes = require("./routes/products");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Backend marketplace actif",
      dbTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("Erreur connexion PostgreSQL :", error);
    res.status(500).json({
      message: "Backend actif mais erreur PostgreSQL",
      error: error.message,
    });
  }
});

app.use("/products", productsRoutes);

app.listen(PORT, () => {
  console.log(`Serveur backend lancé sur http://localhost:${PORT}`);
});