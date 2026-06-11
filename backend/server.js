require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./config/db");

const productsRoutes = require("./routes/products");
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// Rate limiting global : 100 req / 15 min
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop de requêtes, réessayez dans 15 minutes" },
});
app.use(globalLimiter);

// Rate limiting auth : 50 tentatives / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, error: "Trop de tentatives de connexion, réessayez plus tard" },
});
app.use("/auth", authLimiter);

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "Backend marketplace actif", dbTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ message: "Backend actif mais erreur PostgreSQL", error: error.message });
  }
});

app.use("/auth", authRoutes);
app.use("/products", productsRoutes);
app.use("/ai", aiRoutes);

// ── Routes livreurs (définies directement pour compatibilité Express 5) ──────

app.get("/deliverers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT address FROM deliverer_candidates ORDER BY registered_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/deliverers/register", async (req, res) => {
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

app.delete("/deliverers/:address", async (req, res) => {
  const { address } = req.params;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ success: false, error: "Adresse invalide" });
  }
  try {
    await pool.query(
      "DELETE FROM deliverer_candidates WHERE address = $1",
      [address.toLowerCase()]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Gestion centralisée des erreurs ─────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err);
  res.status(500).json({ success: false, error: "Erreur interne du serveur" });
});

// Comptes Hardhat pré-configurés comme livreurs (dev uniquement)
const DEV_DELIVERERS = (process.env.DEV_DELIVERERS || "")
  .split(",")
  .map(a => a.trim().toLowerCase())
  .filter(a => /^0x[a-f0-9]{40}$/.test(a));

app.listen(PORT, async () => {
  console.log(`Serveur backend lancé sur http://localhost:${PORT}`);
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deliverer_candidates (
        address VARCHAR(42) PRIMARY KEY,
        registered_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("Table deliverer_candidates OK");

    await pool.query(
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS semantic_profile TEXT`
    );
    console.log("Colonne semantic_profile OK");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS review_sentiment (
        id                  SERIAL PRIMARY KEY,
        contract_product_id INTEGER NOT NULL,
        reviewer_address    TEXT    NOT NULL,
        order_id            INTEGER NOT NULL,
        raw_text            TEXT,
        label               TEXT,
        score               DOUBLE PRECISION,
        normalized_score    DOUBLE PRECISION,
        confidence          DOUBLE PRECISION,
        prob_positive       DOUBLE PRECISION,
        prob_neutral        DOUBLE PRECISION,
        prob_negative       DOUBLE PRECISION,
        analyzed_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (contract_product_id, reviewer_address, order_id)
      )
    `);
    console.log("Table review_sentiment OK");

    // Seed des livreurs de développement : vide la table puis insère uniquement les adresses configurées
    if (DEV_DELIVERERS.length > 0) {
      await pool.query("DELETE FROM deliverer_candidates");
      for (const addr of DEV_DELIVERERS) {
        await pool.query(
          "INSERT INTO deliverer_candidates (address) VALUES ($1) ON CONFLICT DO NOTHING",
          [addr]
        );
        console.log(`Livreur dev enregistré : ${addr}`);
      }
    }
  } catch (e) {
    console.error("Erreur création table deliverers:", e.message);
  }
});
