function Header({ onConnect, isConnecting, isConnected }) {
  return (
    <header className="hero-card">
      <div>
        <p className="eyebrow">Web3 • Hardhat • Ethers.js</p>
        <h1>Marketplace DApp</h1>
        <p className="hero-text">
          Une interface propre pour gérer les produits, les achats,
          la livraison et les avis.
        </p>
      </div>

      <button
        className="primary-button"
        onClick={onConnect}
        disabled={isConnecting}
      >
        {isConnecting
          ? "Connexion..."
          : isConnected
          ? "Wallet connecté"
          : "Connecter MetaMask"}
      </button>
    </header>
  );
}

export default Header;