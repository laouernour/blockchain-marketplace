require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./config/db");

const productsRoutes = require("./routes/products");
const authRoutes = require("./routes/auth");
const deliverersRoutes = require("./routes/deliverers");

const app = express();
const PORT = process.env.PORT || 5000;

// Sécurité : headers HTTP
app.use(helmet());

// CORS restrictif : uniquement le frontend local
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

// Rate limiting strict sur auth : 10 tentatives / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Trop de tentatives de connexion, réessayez plus tard" },
});
app.use("/auth", authLimiter);

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

app.use("/auth", authRoutes);
app.use("/products", productsRoutes);
app.use("/deliverers", deliverersRoutes);

// Gestion centralisée des erreurs
app.use((err, req, res, next) => {
  console.error("Erreur serveur :", err);
  res.status(500).json({ success: false, error: "Erreur interne du serveur" });
});

app.listen(PORT, () => {
  console.log(`Serveur backend lancé sur http://localhost:${PORT}`);
});
