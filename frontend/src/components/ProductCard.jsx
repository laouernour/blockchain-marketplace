import { useState } from "react";
import { parseEther } from "ethers";
import toast from "react-hot-toast";
import { purchaseProduct, getReviewsByProduct } from "../utils/web3";

function shortAddress(address) {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
];

function ipfsToUrl(value, gatewayIndex = 0) {
  if (!value) return "";
  const gw = GATEWAYS[gatewayIndex] || GATEWAYS[0];
  if (value.startsWith("ipfs://")) return gw + value.replace("ipfs://", "");
  if (value.startsWith("Qm") || value.startsWith("bafy")) return gw + value;
  return value;
}

function nextGateway(src) {
  for (let i = 0; i < GATEWAYS.length - 1; i++) {
    if (src.startsWith(GATEWAYS[i])) {
      const cid = src.replace(GATEWAYS[i], "");
      return GATEWAYS[i + 1] + cid;
    }
  }
  return "";
}

function StarDisplay({ rating }) {
  return (
    <div className="star-display">
      {[1, 2, 3, 4, 5].map((s) => (
        <i
          key={s}
          className={`bi ${s <= rating ? "bi-star-fill" : "bi-star"}`}
        ></i>
      ))}
    </div>
  );
}

function ProductCard({
  id,
  name,
  price,
  seller,
  stock,
  averageRating,
  image,
  description,
  category,
  ipfsHash,
  account,
  isDelivererAccount,
  onPurchaseSuccess,
}) {
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const imageUrl = ipfsToUrl(image);
  const isOwnProduct = account && seller && account.toLowerCase() === seller.toLowerCase();
  const isSoldOut = Number(stock) <= 0;

  const handleBuy = async () => {
    if (!account) {
      toast.error("Connecte-toi d'abord avec MetaMask");
      return;
    }

    if (isDelivererAccount) {
      toast.error("Compte livreur — les achats sont interdits");
      return;
    }

    if (isSoldOut) {
      toast.error("Stock épuisé");
      return;
    }

    try {
      const priceValue = String(price).replace(" ETH", "");
      const priceWei = parseEther(priceValue);

      const loading = toast.loading("Transaction MetaMask en cours...");
      const result = await purchaseProduct(id, priceWei, account);
      toast.dismiss(loading);

      if (result.success) {
        const existing = JSON.parse(localStorage.getItem("orderTxHashes") || "{}");
        existing[result.orderId] = result.txHash;
        localStorage.setItem("orderTxHashes", JSON.stringify(existing));

        toast.success("Achat confirmé sur la blockchain");
        await onPurchaseSuccess?.();
      } else {
        toast.error(result.error || "Transaction refusée");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur pendant l'achat");
    }
  };

  const handleToggleReviews = async () => {
    if (showReviews) {
      setShowReviews(false);
      return;
    }
    setLoadingReviews(true);
    const data = await getReviewsByProduct(id);
    setReviews(data);
    setLoadingReviews(false);
    setShowReviews(true);
  };

  return (
    <article className={`product-card ${isSoldOut ? "soldout" : ""}`}>
      <div className="product-media">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            onError={(e) => {
              const next = nextGateway(e.target.src);
              if (next) { e.target.src = next; }
              else { e.target.style.display = "none"; }
            }}
          />
        ) : (
          <div className="no-image">
            <i className="bi bi-image"></i>
            <span>Aucune image</span>
          </div>
        )}
      </div>

      <div className="product-content">
        <div className="product-title-row">
          <div>
            <h3>{name}</h3>
            <p>{description || ""}</p>
          </div>

          <div className="rating-pill">
            <i className="bi bi-star-fill"></i>
            {averageRating || 0}
          </div>
        </div>

        <div className="real-data-grid">
          <div>
            <small>Prix</small>
            <strong>{price}</strong>
          </div>
          <div>
            <small>Stock</small>
            <strong>{stock}</strong>
          </div>
          <div>
            <small>Vendeur</small>
            <strong title={seller}>{shortAddress(seller)}</strong>
          </div>
          <div>
            <small>Catégorie</small>
            <strong>{category || "Non définie"}</strong>
          </div>
        </div>

        {isOwnProduct ? (
          <div className="own-product-msg">
            <i className="bi bi-person-check"></i>
            Votre produit — vous ne pouvez pas l'acheter
          </div>
        ) : (
          <button className="buy-btn" onClick={handleBuy} disabled={isSoldOut}>
            <i className="bi bi-bag-check"></i>
            {isSoldOut ? "Stock épuisé" : "Acheter"}
          </button>
        )}

        <button className="reviews-toggle-btn" onClick={handleToggleReviews}>
          <i className={`bi ${showReviews ? "bi-chevron-up" : "bi-chat-square-text"}`}></i>
          {showReviews ? "Masquer les avis" : `Voir les avis${averageRating ? ` · ★ ${averageRating}/5` : ""}`}
        </button>

        {showReviews && (
          <div className="reviews-section">
            {loadingReviews ? (
              <p className="reviews-empty">Chargement...</p>
            ) : reviews.length === 0 ? (
              <p className="reviews-empty">Aucun avis pour ce produit.</p>
            ) : (
              reviews.map((r, i) => (
                <div key={i} className="review-item">
                  <div className="review-header">
                    <StarDisplay rating={r.rating} />
                    <span className="review-author">{shortAddress(r.reviewer)}</span>
                  </div>
                  {r.ipfsHash && r.ipfsHash !== "Avis sans commentaire" && (
                    <p className="review-comment">{r.ipfsHash}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
