function Topbar({ account, onConnect, onDisconnect }) {
  return (
    <header className="topbar">
      <h2 className="topbar-title">ChainMarket</h2>

      <div style={{ display: "flex", gap: "10px" }}>
        {!account ? (
          <button className="wallet-btn" onClick={onConnect}>
            Connect Wallet
          </button>
        ) : (
          <>
            <button className="wallet-btn">{account}</button>
            <button className="wallet-btn" onClick={onDisconnect}>
              Déconnecter
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default Topbar;