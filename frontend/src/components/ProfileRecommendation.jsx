import { useState, useEffect } from "react";
import ProductCard from "./ProductCard";
import { getProfileRecommendations } from "../utils/api";

// Adresse nulle : aucun historique → fallback trustScore côté backend
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function trustColor(score) {
  if (score >= 0.7) return "#22c55e";
  if (score >= 0.5) return "#fbbf24";
  return "#fb7185";
}

function ProfileRecommendation({ account, products, isDelivererAccount, onPurchaseSuccess }) {
  const [recs,     setRecs]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [expanded, setExpanded] = useState(true);

  // Utilise le zero address si non connecté → fallback trustScore côté backend
  const effectiveAddress = account || ZERO_ADDRESS;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRecs(null);
    setError(null);

    getProfileRecommendations(effectiveAddress, 8)
      .then(res => {
        if (cancelled) return;
        if (res.success) setRecs(res);
        else setError(res.error || "Erreur de recommandation");
      })
      .catch(() => {
        if (!cancelled) setError("Service de recommandation indisponible.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [effectiveAddress]);

  // ── Dérivation de l'état d'affichage ──────────────────────────────────────
  const ps       = recs?.profileSummary || {};
  const hasHist  = !!(account && ps.hasHistory === true);
  const noWallet = !account;

  let title, subtitle, icon;

  if (noWallet) {
    icon     = "bi-shield-check";
    title    = "Produits les plus fiables";
    subtitle = "Sélection basée sur la confiance système globale.";
  } else if (hasHist) {
    icon     = "bi-person-hearts";
    title    = "Recommandé pour vous";
    subtitle = "Sélection basée sur vos achats précédents et la confiance système.";
  } else {
    icon     = "bi-shield-check";
    title    = "Produits les plus fiables";
    subtitle = "Votre historique est encore insuffisant : nous affichons les produits avec la meilleure confiance système.";
  }

  return (
    <div className="prof-section">

      {/* ── En-tête repliable ── */}
      <button className="prof-header" onClick={() => setExpanded(e => !e)}>
        <div className="prof-header-left">
          <i className={`bi ${icon}`}></i>
          <div className="prof-header-text">
            <span className="prof-title">{title}</span>
            <span className="prof-subtitle">{subtitle}</span>
          </div>
        </div>
        <i className={`bi ${expanded ? "bi-chevron-up" : "bi-chevron-down"} prof-chevron`}></i>
      </button>

      {expanded && (
        <div className="prof-body">

          {loading && (
            <div className="empty-state" style={{ padding: "28px 0" }}>
              <div className="loader"></div>
            </div>
          )}

          {error && !loading && (
            <div className="reco-error" style={{ margin: "12px 0" }}>
              <i className="bi bi-exclamation-triangle"></i> {error}
            </div>
          )}

          {recs && !loading && recs.data.length === 0 && (
            <div className="empty-state" style={{ padding: "20px 0" }}>
              <i className="bi bi-bag-x"></i>
              <p>Aucun produit disponible pour le moment.</p>
            </div>
          )}

          {recs && !loading && recs.data.length > 0 && (
            <div className="products-grid">
              {recs.data.map(rec => {
                const chain = products.find(p => p.id === rec.productId) || {};
                const tc    = trustColor(rec.trustScore);

                // Label affiché à l'acheteur — jamais de score brut
                const matchLabel = hasHist
                  ? `Correspond à votre profil ${Math.round(rec.profileScore * 100)} %`
                  : rec.trustScore >= 0.7
                    ? "Confiance système élevée"
                    : "Produit fiable";

                return (
                  <div
                    key={rec.productId}
                    className={`prof-card-wrapper${rec.alreadyBought ? " prof-already" : ""}`}
                  >
                    {/* Badge "Déjà acheté" */}
                    {rec.alreadyBought && (
                      <div className="prof-already-badge">
                        <i className="bi bi-check-circle-fill"></i> Déjà acheté
                      </div>
                    )}

                    {/* Labels lisibles — aucun score brut exposé */}
                    <div className="prof-score-strip">
                      <span className="prof-match-chip">
                        <i className={`bi ${hasHist ? "bi-person-check" : "bi-shield-fill-check"}`}></i>
                        {matchLabel}
                      </span>
                      <span className="prof-trust-chip" style={{ color: tc, borderColor: tc + "44" }}>
                        Confiance {Math.round(rec.trustScore * 100)} %
                      </span>
                    </div>

                    {/* Carte produit — inchangée */}
                    <ProductCard
                      id={rec.productId}
                      name={rec.name}
                      description={rec.description}
                      category={rec.category}
                      image={chain.metadata?.image || ""}
                      ipfsHash={chain.ipfsHash || ""}
                      price={`${rec.priceEth} ETH`}
                      stock={rec.stock}
                      seller={chain.seller || ""}
                      averageRating={rec.signals?.avgRating || 0}
                      account={account}
                      isDelivererAccount={isDelivererAccount}
                      onPurchaseSuccess={onPurchaseSuccess}
                    />
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default ProfileRecommendation;
