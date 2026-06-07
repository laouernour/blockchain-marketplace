import os, requests
from flask import Flask, jsonify
from flask_cors import CORS
import psycopg2, psycopg2.extras
from dotenv import load_dotenv
from collections import Counter, defaultdict

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:5000"])

NODE_URL = os.getenv("NODE_URL", "http://localhost:5000")

# ── Connexion PostgreSQL ──────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        dbname=os.getenv("DB_NAME", "marketplace"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )

def fetch_meta_from_db(product_ids):
    if not product_ids:
        return {}
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT contract_product_id, name, category FROM products WHERE contract_product_id = ANY(%s)",
            (list(product_ids),)
        )
        rows = {r["contract_product_id"]: r for r in cur.fetchall()}
        cur.close(); conn.close()
        return rows
    except:
        return {}

# ── Santé ─────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    db_ok = False
    try:
        conn = get_db(); conn.close(); db_ok = True
    except: pass
    return jsonify({"status": "ok", "db": db_ok})

# ── /api/stats — dashboard complet ───────────────────────────────────────────

@app.route("/api/stats")
def get_stats():
    try:
        # Récupère les données blockchain depuis Node.js
        resp = requests.get(f"{NODE_URL}/ai/blockchain-data", timeout=20)
        resp.raise_for_status()
        chain = resp.json()
        if not chain.get("success"):
            return jsonify({"success": False, "error": chain.get("error", "Erreur blockchain")}), 500

        products = chain["data"]["products"]
        orders   = chain["data"]["orders"]
        reviews  = chain["data"]["reviews"]

        # Métadonnées off-chain (noms, catégories) depuis PostgreSQL
        product_ids = [p["id"] for p in products]
        meta = fetch_meta_from_db(product_ids)

        # ── KPIs globaux ──────────────────────────────────────────────────────
        total_orders      = len(orders)
        total_volume_eth  = sum(o["amount_eth"] for o in orders)
        delivered_count   = sum(1 for o in orders if o["delivered"])
        disputed_count    = sum(1 for o in orders if o["disputed"])
        buyer_won_count   = sum(1 for o in orders if o["disputeResolved"] and o["buyerWon"])
        seller_won_count  = sum(1 for o in orders if o["disputeResolved"] and not o["buyerWon"])
        unique_buyers     = len({o["buyer"]  for o in orders})
        unique_sellers    = len({p["seller"] for p in products})
        delivery_rate     = round(delivered_count / total_orders * 100, 1) if total_orders else 0
        dispute_rate      = round(disputed_count  / total_orders * 100, 1) if total_orders else 0
        avg_rating        = round(sum(r["rating"] for r in reviews) / len(reviews), 2) if reviews else 0

        # ── Top produits les plus vendus ──────────────────────────────────────
        orders_by_product = Counter(o["productId"] for o in orders)
        volume_by_product = defaultdict(float)
        for o in orders:
            volume_by_product[o["productId"]] += o["amount_eth"]

        top_products = []
        for p in sorted(products, key=lambda x: orders_by_product[x["id"]], reverse=True)[:10]:
            m = meta.get(p["id"], {})
            top_products.append({
                "id":         p["id"],
                "name":       m.get("name", f"Produit #{p['id']}"),
                "category":   m.get("category", "—"),
                "orders":     orders_by_product[p["id"]],
                "volume_eth": round(volume_by_product[p["id"]], 4),
                "price_eth":  round(p["price_eth"], 4),
                "stock":      p["stock"],
            })

        # ── Catégories par ventes réelles ─────────────────────────────────────
        cat_orders  = defaultdict(int)
        cat_volume  = defaultdict(float)
        cat_listings = defaultdict(int)
        for p in products:
            m = meta.get(p["id"], {})
            cat = m.get("category", "Autre") if m else "Autre"
            cat_listings[cat] += 1
        for o in orders:
            m = meta.get(o["productId"], {})
            cat = m.get("category", "Autre") if m else "Autre"
            cat_orders[cat]  += 1
            cat_volume[cat]  += o["amount_eth"]

        categories = sorted(
            [{"category": k, "orders": v, "volume_eth": round(cat_volume[k], 4)}
             for k, v in cat_orders.items()],
            key=lambda x: x["orders"], reverse=True
        )[:12]

        # ── Top vendeurs ──────────────────────────────────────────────────────
        product_seller  = {p["id"]: p["seller"] for p in products}
        seller_volume   = defaultdict(float)
        seller_orders   = defaultdict(int)
        seller_disputes = defaultdict(int)
        for o in orders:
            seller = product_seller.get(o["productId"], "unknown")
            seller_volume[seller]  += o["amount_eth"]
            seller_orders[seller]  += 1
            if o["disputed"]:
                seller_disputes[seller] += 1

        top_sellers = sorted(
            [{"address":      k,
              "volume_eth":   round(v, 4),
              "orders":       seller_orders[k],
              "disputes":     seller_disputes[k],
              "dispute_rate": round(seller_disputes[k] / seller_orders[k] * 100, 1) if seller_orders[k] else 0}
             for k, v in seller_volume.items()],
            key=lambda x: x["volume_eth"], reverse=True
        )[:5]

        # ── Distribution des notes ────────────────────────────────────────────
        rating_dist = {str(i): sum(1 for r in reviews if r["rating"] == i) for i in range(1, 6)}

        # ── Stats prix ────────────────────────────────────────────────────────
        prices = [p["price_eth"] for p in products if p["price_eth"] > 0]
        price_stats = {}
        if prices:
            s = sorted(prices)
            price_stats = {
                "min":    round(min(s), 4),
                "max":    round(max(s), 4),
                "avg":    round(sum(s) / len(s), 4),
                "median": round(s[len(s) // 2], 4),
            }

        return jsonify({
            "success": True,
            "data": {
                "kpis": {
                    "total_products":   len(products),
                    "total_orders":     total_orders,
                    "total_volume_eth": round(total_volume_eth, 4),
                    "delivery_rate":    delivery_rate,
                    "dispute_rate":     dispute_rate,
                    "unique_buyers":    unique_buyers,
                    "unique_sellers":   unique_sellers,
                    "avg_rating":       avg_rating,
                    "total_reviews":    len(reviews),
                },
                "top_products": top_products,
                "categories":   categories,
                "cat_listings": sorted(
                    [{"category": k, "count": v} for k, v in cat_listings.items()],
                    key=lambda x: -x["count"]
                ),
                "top_sellers":  top_sellers,
                "disputes": {
                    "total":      disputed_count,
                    "resolved":   buyer_won_count + seller_won_count,
                    "buyer_won":  buyer_won_count,
                    "seller_won": seller_won_count,
                },
                "rating_distribution": rating_dist,
                "price_stats":  price_stats,
            },
        })

    except Exception as e:
        import traceback
        return jsonify({"success": False, "error": str(e), "trace": traceback.format_exc()}), 500


# ── /api/anomalies — détection vendeurs & acheteurs suspects ──────────────────

@app.route("/api/anomalies")
def get_anomalies():
    try:
        resp = requests.get(f"{NODE_URL}/ai/blockchain-data", timeout=20)
        resp.raise_for_status()
        chain = resp.json()
        if not chain.get("success"):
            return jsonify({"success": False, "error": chain.get("error", "Erreur blockchain")}), 500

        products = chain["data"]["products"]
        orders   = chain["data"]["orders"]
        reviews  = chain["data"]["reviews"]

        from anomaly import detect
        result = detect(products, orders, reviews)

        return jsonify({"success": True, "data": result})

    except Exception as e:
        import traceback
        return jsonify({"success": False, "error": str(e), "trace": traceback.format_exc()}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    print(f"BlockBay ML Service → http://localhost:{port}")
    app.run(debug=True, port=port, use_reloader=False)
