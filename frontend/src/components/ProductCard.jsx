import { purchaseProduct } from "../utils/web3";
import { parseEther } from "ethers";

function ProductCard({
  id,
  name,
  price,
  seller,
  averageRating,
  image,
  description,
  onPurchaseSuccess,
}) {
  const imageUrl = image?.startsWith("ipfs://")
    ? `https://ipfs.io/ipfs/${image.replace("ipfs://", "")}`
    : image;

  const handleBuy = async () => {
    try {
      const priceValue = price.replace(" ETH", "");
      const priceWei = parseEther(priceValue);

      const result = await purchaseProduct(id, priceWei);

      if (result.success) {
        const existing = JSON.parse(localStorage.getItem("orderTxHashes") || "{}");

        existing[result.orderId] = result.txHash;

        localStorage.setItem("orderTxHashes", JSON.stringify(existing));

        alert("Achat réussi !");
        if (onPurchaseSuccess) {
           await onPurchaseSuccess();
        }
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error(error);
      alert("Erreur achat");
    }
  };

  return (
    <div className="product-card">
      <div className="product-img">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            style={{
              width: "100%",
              height: "180px",
              objectFit: "cover",
              borderRadius: "10px",
            }}
          />
        ) : (
          "📦"
        )}
      </div>

      <div className="product-info">
        <h3>{name}</h3>

        <p style={{ margin: "8px 0", color: "#ccc" }}>
          {description || "Aucune description disponible."}
        </p>

        <p>⭐ {averageRating || 0} / 5</p>

        <p className="seller">Vendeur: {seller}</p>

        <div className="product-footer">
          <span className="price">{price}</span>
          <button className="buy-btn" onClick={handleBuy}>
            Acheter
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;