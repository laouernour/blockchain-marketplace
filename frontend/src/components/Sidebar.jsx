function Sidebar({ activePage, setActivePage, productsCount = 0, ordersCount = 0 }) {
  const items = [
    { id: "marketplace", label: "Marketplace", icon: "bi-shop-window", hint: `${productsCount} articles` },
    { id: "vendre", label: "Vendre", icon: "bi-plus-square", hint: "Publier un article" },
    { id: "dashboard", label: "Dashboard", icon: "bi-grid-1x2", hint: "Mes ventes & produits" },
    { id: "transactions", label: "Mes commandes", icon: "bi-receipt", hint: `${ordersCount} commandes` },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/src/assets/20c7e988-d3b8-4d99-88e1-db8d25ee18f7.png" alt="BlockBay" className="brand-logo" />
        <p className="brand-slogan">Achetez. Vendez. En toute sécurité.</p>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "active" : ""}
            onClick={() => setActivePage(item.id)}
          >
            <i className={`bi ${item.icon}`}></i>
            <span>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
