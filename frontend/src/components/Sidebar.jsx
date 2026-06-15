function Sidebar({ activePage, setActivePage, productsCount = 0, ordersCount = 0, delivererOrdersCount = 0, userRole = "buyer", account = "", adminAddress = "", onRegisterDeliverer }) {
  const isAdmin = account && adminAddress && account.toLowerCase() === adminAddress.toLowerCase();

  const buyerItems = [
    { id: "marketplace",    label: "Marketplace",      icon: "bi-shop-window",   hint: `${productsCount} articles` },
    { id: "transactions",   label: "Mes commandes",    icon: "bi-receipt",       hint: `${ordersCount} commandes` },
    { id: "mon-historique", label: "Mes transactions", icon: "bi-clock-history", hint: "Historique complet" },
  ];

  const sellerItems = [
    { id: "dashboard",          label: "Dashboard",          icon: "bi-grid-1x2",       hint: "Mes ventes & produits" },
    { id: "seller-analytics",   label: "Mes analytiques",    icon: "bi-graph-up-arrow", hint: "Performance de mes produits" },
    { id: "vendre",             label: "Vendre",             icon: "bi-plus-square",    hint: "Publier un article" },
    { id: "mon-historique",     label: "Mes transactions",   icon: "bi-clock-history",  hint: "Historique complet" },
  ];

  const delivererItems = [
    { id: "livraisons",     label: "Mes livraisons",   icon: "bi-truck",         hint: `${delivererOrdersCount} à confirmer` },
    { id: "mon-historique", label: "Mes transactions", icon: "bi-clock-history", hint: "Historique complet" },
  ];

  const adminItems = [
    { id: "admin-dashboard", label: "Gestion plateforme",   icon: "bi-shield-lock",        hint: "Litiges, produits, livreurs" },
    { id: "ia",              label: "IA & Analytique",      icon: "bi-graph-up-arrow",     hint: "Data mining & ML" },
    { id: "anomalies",       label: "Détection d'anomalies",icon: "bi-shield-exclamation", hint: "IA sécurité" },
    { id: "blockchain",      label: "Données Blockchain",   icon: "bi-database-check",     hint: "Smart contract data" },
    { id: "historique",      label: "Historique global",    icon: "bi-list-columns",       hint: "Toutes les transactions" },
    { id: "monitoring",      label: "Monitoring Reco IA",   icon: "bi-speedometer2",       hint: "Démo scores & NLP" },
  ];

  const items =
    userRole === "admin"     ? adminItems     :
    userRole === "deliverer" ? delivererItems :
    userRole === "seller"    ? sellerItems    :
    buyerItems;

  const roleLabel =
    isAdmin          ? { text: "Administrateur",  icon: "bi-shield-lock", cls: "admin-badge"     } :
    userRole === "deliverer" ? { text: "Compte Livreur",  icon: "bi-truck",       cls: "deliverer-badge" } :
    userRole === "seller"    ? { text: "Compte Vendeur",  icon: "bi-shop",        cls: "seller-badge"    } :
                               { text: "Compte Acheteur", icon: "bi-person",      cls: "buyer-badge"     };

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/src/assets/20c7e988-d3b8-4d99-88e1-db8d25ee18f7.png" alt="BlockBay" className="brand-logo" />
        <p className="brand-slogan">Achetez. Vendez. En toute sécurité.</p>
      </div>

      {account ? (
        <>
          <div className={`role-badge ${roleLabel.cls}`}>
            <i className={`bi ${roleLabel.icon}`}></i>
            <span>{roleLabel.text}</span>
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

        </>
      ) : (
        <div style={{ padding: "24px 16px", color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
          <i className="bi bi-wallet2" style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}></i>
          Connecte ton wallet pour accéder à la plateforme
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
