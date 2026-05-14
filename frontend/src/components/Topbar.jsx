function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Topbar({ account, onConnect, onDisconnect, query, setQuery }) {
  return (
    <header className="topbar">
      <div>
        <h2>BlockBay</h2>
      </div>

      <div className="topbar-right">
        <div className="search-box">
          <i className="bi bi-search"></i>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher produit, catégorie, vendeur..."
          />
        </div>

        {!account ? (
          <button className="primary-btn" onClick={onConnect}>
            <i className="bi bi-wallet2"></i>
            Connecter
          </button>
        ) : (
          <>
            <div className="wallet-pill">
              <i className="bi bi-wallet2"></i>
              {shortAddress(account)}
            </div>
            <button className="ghost-btn" onClick={onDisconnect}>
              Déconnecter
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default Topbar;
