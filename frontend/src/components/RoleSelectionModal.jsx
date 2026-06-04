function RoleSelectionModal({ account, onSelect }) {
  return (
    <div className="role-modal-overlay">
      <div className="role-modal">
        <div className="role-modal-header">
          <img src="/src/assets/20c7e988-d3b8-4d99-88e1-db8d25ee18f7.png" alt="BlockBay" className="role-modal-logo" />
          <h2>Bienvenue sur BlockBay</h2>
          <p>Vous êtes connecté avec <code>{account?.slice(0,8)}...{account?.slice(-6)}</code></p>
          <p className="role-modal-sub">Comment souhaitez-vous utiliser la plateforme ?</p>
        </div>

        <div className="role-modal-cards">
          <button className="role-card buyer-card" onClick={() => onSelect("buyer")}>
            <div className="role-card-icon">
              <i className="bi bi-bag-heart"></i>
            </div>
            <h3>Acheteur</h3>
            <p>Parcourez la marketplace, achetez des produits et suivez vos commandes.</p>
            <ul>
              <li><i className="bi bi-check2"></i> Accès à la marketplace</li>
              <li><i className="bi bi-check2"></i> Suivi des commandes</li>
              <li><i className="bi bi-check2"></i> Demande de retour</li>
              <li><i className="bi bi-check2"></i> Historique des transactions</li>
            </ul>
            <span className="role-card-btn">Continuer comme Acheteur</span>
          </button>

          <button className="role-card seller-card" onClick={() => onSelect("seller")}>
            <div className="role-card-icon">
              <i className="bi bi-shop"></i>
            </div>
            <h3>Vendeur</h3>
            <p>Créez votre boutique, publiez des produits et gérez vos ventes.</p>
            <ul>
              <li><i className="bi bi-check2"></i> Création de boutique</li>
              <li><i className="bi bi-check2"></i> Publication de produits</li>
              <li><i className="bi bi-check2"></i> Gestion des commandes</li>
              <li><i className="bi bi-check2"></i> Dashboard analytique</li>
            </ul>
            <span className="role-card-btn">Continuer comme Vendeur</span>
          </button>
        </div>

        <p className="role-modal-note">
          <i className="bi bi-info-circle"></i>
          Votre choix est sauvegardé. Vous pouvez changer de rôle en vous déconnectant.
        </p>
      </div>
    </div>
  );
}

export default RoleSelectionModal;
