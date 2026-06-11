import { useState } from "react";
import { getRecommendations, getProductSentiments } from "../utils/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const pct  = (n) => `${Math.round((n || 0) * 100)}%`;
const fmt3 = (n) => n != null ? Number(n).toFixed(3) : "—";

function trustStyle(score) {
  if (score >= 0.7) return { color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  if (score >= 0.5) return { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  return { color: "#fb7185", bg: "rgba(251,113,133,0.12)" };
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function ScoreBar({ value, color }) {
  return (
    <div className="mon-bar-track">
      <div className="mon-bar-fill" style={{ width: pct(value), background: color }} />
    </div>
  );
}

function SentimentBadge({ label }) {
  const map = { positive: "#22c55e", neutral: "#94a3b8", negative: "#fb7185" };
  const sym = { positive: "⊕", neutral: "○", negative: "⊖" };
  return (
    <span style={{ color: map[label] || "#94a3b8", fontWeight: 600, fontSize: "0.8rem" }}>
      {sym[label] || "○"} {label || "—"}
    </span>
  );
}

function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Carte produit (expandable) ────────────────────────────────────────────────

function ProductMonCard({ reco, rank }) {
  const [expanded, setExpanded] = useState(false);
  const [nlpRows,  setNlpRows]  = useState(null);
  const [nlpLoad,  setNlpLoad]  = useState(false);

  const sc  = reco.scoreComponents || {};
  const sig = reco.signals         || {};
  const ts  = trustStyle(reco.trustScore);

  const reviewsCount  = sig.reviewsCount  || 0;
  const commentCount  = sig.commentCount  || 0;
  const hasDiscrepancy = reviewsCount > commentCount && commentCount > 0;

  const toggleNlp = async () => {
    if (nlpRows !== null) { setExpanded(e => !e); return; }
    setNlpLoad(true);
    const res = await getProductSentiments(reco.productId);
    setNlpRows(res.success ? res.data : []);
    setNlpLoad(false);
    setExpanded(true);
  };

  return (
    <div className="mon-product-card">

      {/* ── En-tête ── */}
      <div className="mon-product-header">
        <span className="mon-rank">#{rank}</span>
        <div className="mon-product-meta">
          <strong>{reco.name}</strong>
          <span className="mon-cat-badge">{reco.category}</span>
        </div>
        <div className="mon-chips-row">
          <span className="mon-chip" style={{ color: "#4f8cff", background: "rgba(79,140,255,0.12)" }}>
            Pertinence {pct(reco.semanticScore)}
          </span>
          <span className="mon-chip" style={{ color: ts.color, background: ts.bg }}>
            Confiance {pct(reco.trustScore)}
          </span>
          <span className="mon-chip mon-chip-final">
            Score final {reco.finalScore}
          </span>
        </div>
      </div>

      {/* ── Barres visuelles ── */}
      <div className="mon-bars-grid">
        <div>
          <div className="mon-bar-label">Pertinence sémantique <strong>{pct(reco.semanticScore)}</strong></div>
          <ScoreBar value={reco.semanticScore} color="#4f8cff" />
        </div>
        <div>
          <div className="mon-bar-label">Confiance système <strong style={{ color: ts.color }}>{pct(reco.trustScore)}</strong></div>
          <ScoreBar value={reco.trustScore} color={ts.color} />
        </div>
        <div>
          <div className="mon-bar-label">Score final <strong style={{ color: "#33d6a6" }}>{reco.finalScore}</strong></div>
          <ScoreBar value={reco.finalScore} color="#33d6a6" />
        </div>
      </div>

      {/* ── Deux colonnes : signaux blockchain + composants score ── */}
      <div className="mon-detail-cols">

        <div className="mon-detail-col">
          <div className="mon-col-title"><i className="bi bi-diagram-3"></i> Signaux blockchain</div>
          <table className="mon-data-table">
            <tbody>
              <tr><td>Achats</td>            <td><strong>{sig.purchases}</strong></td></tr>
              <tr><td>Livraisons</td>         <td><strong>{sig.delivered}</strong></td></tr>
              <tr><td>Taux livraison</td>     <td><strong>{pct(sig.deliveryRate)}</strong></td></tr>
              <tr>
                <td>Litiges</td>
                <td><strong style={{ color: sig.disputes > 0 ? "#fb7185" : "inherit" }}>{sig.disputes}</strong></td>
              </tr>
              <tr>
                <td>Taux litiges</td>
                <td><strong style={{ color: sig.disputeRate > 0.2 ? "#fb7185" : "inherit" }}>{pct(sig.disputeRate)}</strong></td>
              </tr>
              <tr>
                <td>Remboursements</td>
                <td><strong style={{ color: sig.refunds > 0 ? "#fbbf24" : "inherit" }}>{sig.refunds}</strong></td>
              </tr>
              <tr><td>Taux remboursements</td><td><strong>{pct(sig.refundRate)}</strong></td></tr>
              <tr>
                <td>
                  Avis blockchain
                  {hasDiscrepancy && (
                    <span className="mon-discrepancy-dot" title="Voir explication NLP ci-dessous"> ⓘ</span>
                  )}
                </td>
                <td><strong>{reviewsCount}</strong></td>
              </tr>
              <tr><td>Note moyenne</td>       <td><strong>{sig.avgRating ? `${sig.avgRating}/5` : "—"}</strong></td></tr>
              <tr><td>Stock</td>              <td><strong>{sig.stock}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <div className="mon-detail-col">
          <div className="mon-col-title"><i className="bi bi-calculator"></i> Composants du trustScore</div>
          <table className="mon-data-table">
            <tbody>
              <tr className="mon-row-hl">
                <td>qualitySignal <span className="mon-weight">×0.25</span></td>
                <td><strong>{fmt3(sc.qualitySignal)}</strong></td>
              </tr>
              <tr><td>ratingScore <span className="mon-weight">×0.15</span></td>    <td><strong>{fmt3(sc.ratingScore)}</strong></td></tr>
              <tr><td>purchaseScore <span className="mon-weight">×0.20</span></td>  <td><strong>{fmt3(sc.purchaseScore)}</strong></td></tr>
              <tr><td>deliveryScore <span className="mon-weight">×0.20</span></td>  <td><strong>{fmt3(sc.deliveryScore)}</strong></td></tr>
              <tr>
                <td>disputePenalty <span className="mon-weight">×0.15</span></td>
                <td><strong style={{ color: sc.disputePenalty < 0.8 ? "#fb7185" : "inherit" }}>{fmt3(sc.disputePenalty)}</strong></td>
              </tr>
              <tr>
                <td>refundPenalty <span className="mon-weight">×0.05</span></td>
                <td><strong style={{ color: sc.refundPenalty < 0.8 ? "#fbbf24" : "inherit" }}>{fmt3(sc.refundPenalty)}</strong></td>
              </tr>
              <tr className="mon-row-sep"><td colSpan={2}></td></tr>
              <tr className="mon-row-hl">
                <td>reviewCoverage</td>
                <td>
                  <strong>{pct(sc.reviewCoverage)}</strong>
                  <span className="mon-coverage-hint"> ({commentCount}/{sig.purchases} NLP)</span>
                </td>
              </tr>
              <tr><td>sentimentQuality</td>
                <td><strong>{fmt3(sc.sentimentQuality)}</strong></td>
              </tr>
              <tr>
                <td>avgSentimentScore</td>
                <td><strong>{sc.avgSentimentScore != null ? fmt3(sc.avgSentimentScore) : <span className="mon-muted-text">pas de NLP</span>}</strong></td>
              </tr>
              <tr>
                <td>avgSentimentConfidence</td>
                <td><strong>{sc.avgSentimentConfidence != null ? pct(sc.avgSentimentConfidence) : <span className="mon-muted-text">pas de NLP</span>}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* ── Couverture NLP ── */}
      <div className="mon-coverage-block">
        <div className="mon-coverage-text">
          <i className="bi bi-bar-chart-steps"></i>
          Couverture NLP : <strong>{commentCount}</strong> avis analysé{commentCount !== 1 ? "s" : ""} / <strong>{sig.purchases}</strong> achat{sig.purchases !== 1 ? "s" : ""}
          {" → "}poids NLP dans qualitySignal : <strong>{pct(sc.reviewCoverage)}</strong>
        </div>
        <div className="mon-coverage-formula">
          qualitySignal = <span className="mon-formula-val">{pct(sc.reviewCoverage)}</span> × sentimentQuality
          {" + "}<span className="mon-formula-val">{pct(1 - (sc.reviewCoverage || 0))}</span> × ratingScore
          {" = "}<strong>{fmt3(sc.qualitySignal)}</strong>
        </div>
        <div className="mon-coverage-bar-track">
          <div className="mon-coverage-bar-fill" style={{ width: pct(sc.reviewCoverage) }} />
        </div>
        {hasDiscrepancy && (
          <div className="mon-discrepancy-note">
            <i className="bi bi-info-circle"></i>
            <span>
              <strong>Avis blockchain ({reviewsCount}) ≠ avis NLP ({commentCount})</strong>
              {" "}— un acheteur peut soumettre plusieurs avis (un par commande) sur le même produit.
              L'analyse NLP ne conserve qu'un enregistrement par commande unique.
              Si un même acheteur a passé plusieurs commandes, seule la plus récente est indexée.
            </span>
          </div>
        )}
      </div>

      {/* ── Explication lisible ── */}
      <div className="mon-explanation-row">
        <i className="bi bi-info-circle"></i>
        {reco.explanation}
      </div>

      {/* ── Bouton NLP ── */}
      {commentCount > 0 && (
        <button className="mon-nlp-toggle" onClick={toggleNlp}>
          <i className={`bi ${expanded ? "bi-chevron-up" : "bi-brain"}`}></i>
          {nlpLoad ? "Chargement…" : expanded ? "Masquer les avis NLP" : `Voir les ${commentCount} avis NLP analysé${commentCount !== 1 ? "s" : ""}`}
        </button>
      )}

      {/* ── Tableau avis NLP ── */}
      {expanded && nlpRows && (
        <div className="mon-nlp-section">
          {nlpRows.length === 0 ? (
            <p className="mon-muted-text" style={{ padding: "12px 0" }}>
              Aucun avis en base — exécute <code>npm run init:review-sentiments</code> depuis le dossier backend.
            </p>
          ) : (
            <table className="mon-nlp-table">
              <thead>
                <tr>
                  <th>Texte du commentaire</th>
                  <th>Label</th>
                  <th>Score [-1;+1]</th>
                  <th>Normalized [0;1]</th>
                  <th>Confidence</th>
                  <th>Auteur</th>
                </tr>
              </thead>
              <tbody>
                {nlpRows.map((row, i) => (
                  <tr key={i}>
                    <td className="mon-review-text">{row.rawText || "—"}</td>
                    <td><SentimentBadge label={row.label} /></td>
                    <td><strong>{fmt3(parseFloat(row.score))}</strong></td>
                    <td><strong>{fmt3(parseFloat(row.normalizedScore))}</strong></td>
                    <td>{pct(parseFloat(row.confidence))}</td>
                    <td className="mon-muted-text">{shortAddr(row.reviewerAddress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}

// ── Section produits rejetés (repliable) ─────────────────────────────────────

function RejectedSection({ rejected }) {
  const [open, setOpen] = useState(false);
  if (!rejected || rejected.length === 0) return null;
  return (
    <div className="mon-rejected-section">
      <button className="mon-rejected-toggle" onClick={() => setOpen(o => !o)}>
        <span className="mon-rejected-toggle-left">
          <i className="bi bi-funnel" style={{ color: "#94a3b8" }}></i>
          Produits analysés mais non retenus
          <span className="mon-count-badge mon-count-muted">{rejected.length}</span>
        </span>
        <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"}`} style={{ color: "#94a3b8" }}></i>
      </button>
      {open && (
        <>
          <p className="mon-rejected-subtitle">
            Ces produits existent dans le catalogue, mais leur pertinence sémantique est insuffisante pour cette recherche.
          </p>
          <div className="mon-rejected-grid">
            {rejected.map(r => (
              <div key={r.productId} className="mon-rejected-row">
                <span className="mon-rejected-id">#{r.productId}</span>
                <span className="mon-rejected-name">{r.name}</span>
                <span className="mon-rejected-reason">{r.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

function MonitoringRecommendation() {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const search = async () => {
    const sq = query.trim();
    if (!sq) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getRecommendations(sq, 20);
      if (res.success) setResults(res);
      else { setError(res.error || "Erreur inconnue"); setResults(null); }
    } catch {
      setError("Service de recommandation indisponible — vérifie que le backend et Hardhat sont lancés.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const w = results?.weights?.trustComponents || {};

  return (
    <section className="page-card mon-page">

      {/* ── En-tête ── */}
      <div className="mon-page-header">
        <div>
          <span className="eyebrow">Analyse avancée</span>
          <h1><i className="bi bi-speedometer2"></i> Monitoring Recommandation IA</h1>
          <p>Pertinence sémantique, confiance système, NLP et données blockchain — calculés en temps réel.</p>
        </div>
      </div>

      {/* ── Formule ── */}
      <div className="mon-formula-band">
        <code className="mon-formula-code">
          finalScore = <span className="mon-f-accent">0.6</span> × semanticScore + <span className="mon-f-trust">0.4</span> × trustScore
        </code>
        <span className="mon-formula-detail">
          trustScore = 0.25×qualitySignal + 0.15×rating + 0.20×achats + 0.20×livraison + 0.15×litiges + 0.05×remboursements
        </span>
      </div>

      {/* ── Barre de recherche ── */}
      <div className="mon-search-row">
        <input
          className="mon-search-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Tapez une intention de recherche : PC gamer, smartphone, chargeur rapide…"
        />
        <button className="primary-btn" onClick={search} disabled={loading || !query.trim()}>
          <i className="bi bi-search"></i> Analyser
        </button>
      </div>
      <p className="mon-search-hint">
        Les résultats sont calculés dynamiquement à partir des données blockchain, PostgreSQL et NLP.
      </p>

      {/* ── États ── */}
      {loading && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <div className="loader"></div>
          <h3>Calcul des recommandations…</h3>
        </div>
      )}

      {error && !loading && (
        <div className="reco-error" style={{ marginTop: 20 }}>
          <i className="bi bi-exclamation-triangle"></i> {error}
        </div>
      )}

      {!results && !loading && !error && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <i className="bi bi-stars"></i>
          <h3>Tapez une intention de recherche</h3>
          <p>Le moteur analyse chaque produit du catalogue et calcule un score en temps réel.</p>
        </div>
      )}

      {/* ── Résultats ── */}
      {results && !loading && (
        <>
          {/* Résumé KPI */}
          <div className="mon-summary-strip">
            <div className="mon-kpi-card"><span>{results.summary?.totalProducts}</span><small>Produits catalogue</small></div>
            <div className="mon-kpi-card mon-kpi-green"><span>{results.summary?.accepted}</span><small>Retenus</small></div>
            <div className="mon-kpi-card mon-kpi-red"><span>{results.summary?.rejected}</span><small>Non retenus</small></div>
            <div className="mon-kpi-card mon-kpi-blue"><span>{results.summary?.threshold}</span><small>Seuil sémantique</small></div>
            <div className="mon-kpi-card" style={{ flex: 2 }}>
              <span style={{ fontSize: "1rem" }}>"{results.query}"</span>
              <small>Requête analysée</small>
            </div>
          </div>

          {/* Poids du trustScore */}
          <div className="mon-weights-row">
            <span className="mon-weight-label">Poids trustScore :</span>
            {[
              ["qualitySignal",  w.qualitySignal,  "#33d6a6"],
              ["rating",         w.ratingScore,    "#4f8cff"],
              ["achats",         w.purchaseScore,  "#a78bfa"],
              ["livraison",      w.deliveryScore,  "#22c55e"],
              ["litiges",        w.disputePenalty, "#fbbf24"],
              ["remboursements", w.refundPenalty,  "#fb7185"],
            ].map(([k, v, c]) => (
              <span key={k} className="mon-weight-chip" style={{ borderColor: c, color: c }}>
                {k} {Math.round((v || 0) * 100)}%
              </span>
            ))}
          </div>

          {/* Produits retenus */}
          {results.data?.length > 0 ? (
            <div className="mon-section">
              <div className="mon-section-head">
                <i className="bi bi-check-circle" style={{ color: "#22c55e" }}></i>
                Produits recommandés <span className="mon-count-badge">{results.data.length}</span>
              </div>
              {results.data.map((reco, i) => (
                <ProductMonCard key={reco.productId} reco={reco} rank={i + 1} />
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ marginTop: 24 }}>
              <i className="bi bi-search-heart"></i>
              <h3>Aucun produit pertinent pour "{results.query}"</h3>
              <p>Le filtre d'intention a écarté tous les produits — semantic score &lt; {results.summary?.threshold} pour chacun.</p>
            </div>
          )}

          {/* Produits non retenus — repliable */}
          <RejectedSection rejected={results.rejected} />
        </>
      )}
    </section>
  );
}

export default MonitoringRecommendation;
