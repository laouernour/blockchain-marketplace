function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">CM</div>

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
    </aside>
  );
}

export default Sidebar;