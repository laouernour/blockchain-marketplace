import { purchaseProduct } from "../utils/web3";
import { parseEther } from "ethers";

function ProductCard({ id, name, price, seller }) {
  const handleBuy = async () => {
    try {
      const priceValue = price.replace(" ETH", "");
      const priceWei = parseEther(priceValue);

      const result = await purchaseProduct(id, priceWei);

      if (result.success) {
        alert("Achat réussi !");
        window.location.reload();
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
      <div className="product-img">📦</div>

      <div className="product-info">
        <h3>{name}</h3>

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