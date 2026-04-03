function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">CM</div>

      <button
        className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
        onClick={() => setActivePage("dashboard")}
      >
        Dashboard
      </button>

      <button
        className={`nav-item ${activePage === "marketplace" ? "active" : ""}`}
        onClick={() => setActivePage("marketplace")}
      >
        Marketplace
      </button>

      <button
        className={`nav-item ${activePage === "vendre" ? "active" : ""}`}
        onClick={() => setActivePage("vendre")}
      >
        Vendre
      </button>

      <button
        className={`nav-item ${activePage === "transactions" ? "active" : ""}`}
        onClick={() => setActivePage("transactions")}
      >
        Transactions
      </button>

      <button
        className={`nav-item ${activePage === "avis" ? "active" : ""}`}
        onClick={() => setActivePage("avis")}
      >
        Avis
      </button>
    </aside>
  );
}

export default Sidebar;