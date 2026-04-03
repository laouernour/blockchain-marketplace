import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import "./styles/app.css";
import ProductCard from "./components/ProductCard";
import {
  connectWallet as connect,
  getAllProducts,
  checkWalletConnection,
  createStore,
} from "./utils/web3";

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [account, setAccount] = useState("");
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const connectWallet = async () => {
    const account = await connect();
    if (account) {
      setAccount(account);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    const data = await getAllProducts();
    setProducts(data);
    setLoadingProducts(false);
  };

  const disconnectWallet = () => {
    setAccount("");
  };

  useEffect(() => {
    const initWallet = async () => {
      const result = await checkWalletConnection();

      if (result.connected) {
        setAccount(result.accounts[0]);
      }
    };

    initWallet();
    loadProducts();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount("");
      } else {
        setAccount(accounts[0]);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <div className="main">
        <Topbar
          account={account}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
        />

        <p style={{ padding: "10px 20px", color: "white" }}>
          Statut wallet : {account ? `Connecté (${account})` : "Non connecté"}
        </p>

        <main className="content">
          {activePage === "dashboard" && (
            <section className="page-card">
              <h1>Dashboard</h1>
              <p>
                Vue d’ensemble de la marketplace décentralisée, des ventes,
                des transactions et des avis.
              </p>
            </section>
          )}

          {activePage === "marketplace" && (
            <section className="page-card">
              <h1>Marketplace</h1>

              {loadingProducts ? (
                <p>Chargement des produits...</p>
              ) : products.length === 0 ? (
                <p>Aucun produit disponible.</p>
              ) : (
                <div className="products-grid">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      name={`Produit #${product.id}`}
                      price={`${product.price} ETH`}
                      seller={product.seller}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "vendre" && (
            <section className="page-card">
              <h1>Créer une boutique</h1>

              <button
                onClick={async () => {
                  const result = await createStore(
                    "Ma boutique",
                    "ipfs://test"
                  );

                  if (result.success) {
                    alert("Boutique créée !");
                  } else {
                    alert(result.error);
                  }
                }}
              >
                Créer ma boutique
              </button>
            </section>
          )}

          {activePage === "transactions" && (
            <section className="page-card">
              <h1>Transactions</h1>
              <p>
                Historique des achats, ventes et opérations blockchain.
              </p>
            </section>
          )}

          {activePage === "avis" && (
            <section className="page-card">
              <h1>Avis</h1>
              <p>
                Consultation des notes, commentaires IPFS et réputation vendeur.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;