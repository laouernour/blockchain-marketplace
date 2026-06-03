function Sidebar({ activePage, setActivePage, productsCount = 0, ordersCount = 0, delivererOrdersCount = 0, isDeliverer = false }) {
  const allItems = [
    { id: "marketplace", label: "Marketplace",        icon: "bi-shop-window",    hint: `${productsCount} articles`,     delivererOnly: false },
    { id: "vendre",      label: "Vendre",              icon: "bi-plus-square",    hint: "Publier un article",            delivererOnly: false },
    { id: "dashboard",   label: "Dashboard",           icon: "bi-grid-1x2",       hint: "Mes ventes & produits",         delivererOnly: false },
    { id: "transactions",label: "Mes commandes",       icon: "bi-receipt",        hint: `${ordersCount} commandes`,      delivererOnly: false },
    { id: "livraisons",  label: "Mes livraisons",      icon: "bi-truck",          hint: `${delivererOrdersCount} à livrer`, delivererOnly: true },
    { id: "historique",  label: "Historique",          icon: "bi-clock-history",  hint: "Toutes les transactions",       delivererOnly: false },
    { id: "blockchain",  label: "Données Blockchain",  icon: "bi-database-check", hint: "Smart contract data",           delivererOnly: false },
  ];

  const items = isDeliverer
    ? allItems.filter(i => i.id === "livraisons")
    : allItems.filter(i => !i.delivererOnly);

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/src/assets/20c7e988-d3b8-4d99-88e1-db8d25ee18f7.png" alt="BlockBay" className="brand-logo" />
        <p className="brand-slogan">Achetez. Vendez. En toute sécurité.</p>
      </div>

      {isDeliverer && (
        <div className="role-badge deliverer-badge">
          <i className="bi bi-truck"></i>
          <span>Compte Livreur</span>
        </div>
      )}

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
