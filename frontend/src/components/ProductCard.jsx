function ProductCard({ name, price, seller }) {
  return (
    <div className="product-card">
      <div className="product-img">📦</div>

      <div className="product-info">
        <h3>{name}</h3>

        <p className="seller">Vendeur: {seller}</p>

        <div className="product-footer">
          <span className="price">{price}</span>
          <button className="buy-btn">Acheter</button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;