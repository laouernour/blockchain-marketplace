"""
Détection d'anomalies — Vendeurs & Acheteurs
Modèles Isolation Forest entraînés sur Olist Brazilian E-Commerce Dataset
"""

import os
import json
import numpy as np
import joblib
from collections import defaultdict

_BASE = os.path.join(os.path.dirname(__file__), "models")

# ── Chargement lazy des modèles ───────────────────────────────────────────────
_seller_model  = None
_seller_scaler = None
_buyer_model   = None
_buyer_scaler  = None
_config        = None

def _load_models():
    global _seller_model, _seller_scaler, _buyer_model, _buyer_scaler, _config
    if _seller_model is not None:
        return
    _seller_model  = joblib.load(os.path.join(_BASE, "iso_seller_model.pkl"))
    _seller_scaler = joblib.load(os.path.join(_BASE, "iso_seller_scaler.pkl"))
    _buyer_model   = joblib.load(os.path.join(_BASE, "iso_buyer_model.pkl"))
    _buyer_scaler  = joblib.load(os.path.join(_BASE, "iso_buyer_scaler.pkl"))
    with open(os.path.join(_BASE, "anomaly_config.json")) as f:
        _config = json.load(f)


# ── Sentiment (optionnel — chargé seulement si commentaires disponibles) ──────
_sentiment_pipe   = None
_sentiment_loaded = False
_LABEL_MAP = {"positive": 1.0, "neutral": 0.0, "negative": -1.0}

def _get_sentiment(text):
    """Retourne un score de sentiment [-1, +1]. Retourne 0 si indisponible."""
    global _sentiment_pipe, _sentiment_loaded
    if not text or len(text.strip()) < 5:
        return 0.0
    if not _sentiment_loaded:
        _sentiment_loaded = True
        try:
            from transformers import (AutoTokenizer,
                                      AutoModelForSequenceClassification,
                                      pipeline)
            print("[NLP] Chargement modèle sentiment (pytorch_model.bin)...")
            _model_name = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
            _tok = AutoTokenizer.from_pretrained(_model_name)
            _mdl = AutoModelForSequenceClassification.from_pretrained(
                _model_name, use_safetensors=False
            )
            _sentiment_pipe = pipeline(
                "sentiment-analysis",
                model=_mdl, tokenizer=_tok,
                max_length=128, truncation=True,
                framework="pt",
            )
            print("[NLP] Modèle chargé ✓")
        except Exception as e:
            print(f"[NLP] ERREUR chargement : {e}")
            _sentiment_pipe = None
    if _sentiment_pipe is None:
        print("[NLP] Pipeline None — sentiment désactivé")
        return 0.0
    try:
        pred  = _sentiment_pipe([text[:512]])[0]
        label = pred["label"].lower()
        return round(_LABEL_MAP.get(label, 0.0) * pred["score"], 4)
    except Exception:
        return 0.0


# ── Construction features ─────────────────────────────────────────────────────

def _seller_features(products, orders, reviews, fallback_note=4.2):
    product_seller = {p["id"]: p["seller"] for p in products}

    stats = defaultdict(lambda: {
        "orders": 0, "finalized": 0, "delivered": 0,
        "disputed": 0, "volume": 0.0, "products": set(),
    })
    for p in products:
        stats[p["seller"]]["products"].add(p["id"])
    for o in orders:
        sel = product_seller.get(o["productId"])
        if not sel:
            continue
        s = stats[sel]
        s["orders"]  += 1
        s["volume"]  += o.get("amount_eth", 0)
        # disputeResolved=True means the dispute was settled (disputed is reset to False)
        was_disputed = o.get("disputed") or o.get("disputeResolved")
        if o.get("delivered") or was_disputed:
            s["finalized"] += 1
        if o.get("delivered"):
            s["delivered"] += 1
        if was_disputed:
            s["disputed"]  += 1

    seller_reviews = defaultdict(list)
    for r in reviews:
        sel = product_seller.get(r.get("productId"))
        if sel:
            seller_reviews[sel].append(r)

    rows = []
    for sel, s in stats.items():
        if s["orders"] < 2:
            continue
        nb_fin  = s["finalized"] or 1
        nb_v    = s["orders"]
        vol     = s["volume"]
        nb_prod = len(s["products"])

        taux_litige    = round(s["disputed"]  / nb_fin, 4)
        taux_livraison = round(s["delivered"] / nb_fin, 4)
        panier_moyen   = round(vol / nb_v, 6)

        revs    = seller_reviews[sel]
        ratings = [r["rating"] for r in revs if r.get("rating", 0) > 0]
        note    = round(float(np.mean(ratings)), 2) if ratings else fallback_note

        sents, mismatches = [], []
        for r in revs:
            txt = r.get("ipfsHash", "")
            if isinstance(txt, str) and len(txt) > 5 and not txt.startswith("Qm"):
                sc  = _get_sentiment(txt)
                exp = (r.get("rating", 3) - 3) / 2
                sents.append(sc)
                mismatches.append(abs(sc - exp))

        rows.append({
            "address":              sel,
            "nb_ventes":            nb_v,
            "log_nb_ventes":        round(np.log1p(nb_v),    4),
            "log_volume_eth":       round(np.log1p(vol),     4),
            "taux_litige":          taux_litige,
            "taux_livraison":       taux_livraison,
            "note_moyenne":         note,
            "panier_moyen":         panier_moyen,
            "log_nb_produits":      round(np.log1p(nb_prod), 4),
            "sentiment_moy_recu":   round(float(np.mean(sents)),     4) if sents     else 0.0,
            "mismatch_moy_vendeur": round(float(np.mean(mismatches)), 4) if mismatches else 0.0,
        })
    return rows


def _buyer_features(products, orders, reviews, fallback_note=4.5):
    product_seller = {p["id"]: p["seller"] for p in products}

    stats = defaultdict(lambda: {
        "orders": 0, "finalized": 0, "disputed": 0,
        "volume": 0.0, "sellers": set(),
    })
    for o in orders:
        buyer = o.get("buyer")
        if not buyer:
            continue
        s = stats[buyer]
        s["orders"]  += 1
        s["volume"]  += o.get("amount_eth", 0)
        s["sellers"].add(product_seller.get(o["productId"], "unknown"))
        was_disputed = o.get("disputed") or o.get("disputeResolved")
        if o.get("delivered") or was_disputed:
            s["finalized"] += 1
        if was_disputed:
            s["disputed"]  += 1

    buyer_reviews = defaultdict(list)
    for r in reviews:
        rev = r.get("reviewer")
        if rev:
            buyer_reviews[rev].append(r)

    rows = []
    for buyer, s in stats.items():
        if s["orders"] < 2:
            continue
        nb_fin  = s["finalized"] or 1
        nb_a    = s["orders"]
        vol     = s["volume"]
        nb_sel  = len(s["sellers"])

        taux_litige    = round(s["disputed"] / nb_fin, 4)
        panier_moyen   = round(vol / nb_a, 6)
        ratio_vendeurs = round(nb_sel / nb_a, 4)

        revs    = buyer_reviews[buyer]
        ratings = [r["rating"] for r in revs if r.get("rating", 0) > 0]
        note    = round(float(np.mean(ratings)), 2) if ratings else fallback_note

        sents, mismatches = [], []
        for r in revs:
            txt = r.get("ipfsHash", "")
            if isinstance(txt, str) and len(txt) > 5 and not txt.startswith("Qm"):
                sc  = _get_sentiment(txt)
                exp = (r.get("rating", 3) - 3) / 2
                sents.append(sc)
                mismatches.append(abs(sc - exp))

        rows.append({
            "address":               buyer,
            "nb_achats":             nb_a,
            "log_nb_achats":         round(np.log1p(nb_a), 4),
            "log_total_depense":     round(np.log1p(vol),  4),
            "taux_litige":           taux_litige,
            "note_moy_donnee":       note,
            "panier_moyen":          panier_moyen,
            "ratio_vendeurs":        ratio_vendeurs,
            "sentiment_moy_donne":   round(float(np.mean(sents)),      4) if sents      else 0.0,
            "mismatch_moy_acheteur": round(float(np.mean(mismatches)), 4) if mismatches else 0.0,
        })
    return rows


# ── Prédiction ────────────────────────────────────────────────────────────────

def _predict(rows, feature_names, model, scaler):
    if not rows:
        return []
    X        = np.array([[r[f] for f in feature_names] for r in rows])
    X_scaled = scaler.transform(X)
    labels   = model.predict(X_scaled)
    scores   = model.decision_function(X_scaled)

    anomalies = []
    for i, (lbl, score) in enumerate(zip(labels, scores)):
        if lbl == -1:
            r = rows[i]
            anomalies.append({
                "address":       r["address"],
                "anomaly_score": round(float(score), 4),
                "severity":      "high" if score < -0.15 else "medium",
                "features":      {k: r[k] for k in feature_names},
            })
    return sorted(anomalies, key=lambda x: x["anomaly_score"])


# ── Descriptions lisibles ─────────────────────────────────────────────────────

def _describe_seller(f):
    reasons = []
    if f.get("taux_litige", 0) > 0.2:
        reasons.append(f"taux de litiges élevé ({round(f['taux_litige']*100, 1)}%)")
    if f.get("taux_livraison", 1) < 0.8:
        reasons.append(f"faible livraison ({round(f['taux_livraison']*100, 1)}%)")
    if f.get("note_moyenne", 5) < 2.5:
        reasons.append(f"note très basse ({f['note_moyenne']}/5)")
    if f.get("mismatch_moy_vendeur", 0) > 0.5:
        reasons.append("incohérence note/sentiment élevée")
    return "Vendeur suspect : " + (", ".join(reasons) if reasons else "comportement statistiquement atypique")


def _describe_buyer(f):
    reasons = []
    if f.get("taux_litige", 0) > 0.3:
        reasons.append(f"taux de litiges élevé ({round(f['taux_litige']*100, 1)}%)")
    if f.get("ratio_vendeurs", 1) < 0.3:
        reasons.append("achète toujours chez le même vendeur")
    if f.get("mismatch_moy_acheteur", 0) > 0.8:
        reasons.append("incohérence note/sentiment élevée")
    return "Acheteur suspect : " + (", ".join(reasons) if reasons else "comportement statistiquement atypique")


# ── Point d'entrée public ─────────────────────────────────────────────────────

def detect(products, orders, reviews):
    """
    Détecte les anomalies vendeurs et acheteurs depuis les données blockchain.

    Args:
        products : liste [{id, seller, price_eth, stock, ...}]
        orders   : liste [{id, productId, buyer, amount_eth, delivered, disputed, ...}]
        reviews  : liste [{productId, reviewer, rating, ipfsHash}]

    Returns:
        dict {summary, anomalies}
    """
    _load_models()

    SELLER_FEAT = _config["seller_features"]
    BUYER_FEAT  = _config["buyer_features"]

    s_rows = _seller_features(products, orders, reviews)
    b_rows = _buyer_features(products, orders, reviews)

    s_anom = _predict(s_rows, SELLER_FEAT, _seller_model, _seller_scaler)
    b_anom = _predict(b_rows, BUYER_FEAT,  _buyer_model,  _buyer_scaler)

    for a in s_anom:
        a["type"]        = "suspicious_seller"
        a["entity"]      = "seller"
        a["label"]       = f"{a['address'][:10]}…{a['address'][-6:]}"
        a["description"] = _describe_seller(a["features"])

    for a in b_anom:
        a["type"]        = "suspicious_buyer"
        a["entity"]      = "buyer"
        a["label"]       = f"{a['address'][:10]}…{a['address'][-6:]}"
        a["description"] = _describe_buyer(a["features"])

    all_anom = sorted(s_anom + b_anom, key=lambda x: x["anomaly_score"])

    return {
        "summary": {
            "total":   len(all_anom),
            "sellers": len(s_anom),
            "buyers":  len(b_anom),
            "high":    sum(1 for a in all_anom if a["severity"] == "high"),
            "medium":  sum(1 for a in all_anom if a["severity"] == "medium"),
        },
        "anomalies": all_anom,
    }
