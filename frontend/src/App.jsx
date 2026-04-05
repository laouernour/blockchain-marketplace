import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import "./styles/app.css";
import ProductCard from "./components/ProductCard";
import { parseEther, formatEther } from "ethers";
import {
  connectWallet as connect,
  getAllProducts,
  checkWalletConnection,
  createStore,
  addProduct,
  confirmDelivery,
  getAllOrders,
  submitReview,
  getReviewsByProduct,
  getTransactionDetails,
  getMyStoreId,
} from "./utils/web3";

import { uploadJsonToIPFS } from "./utils/ipfs";
import { saveProductMetadata } from "./utils/api";

function App() {
  const [activePage, setActivePage] = useState("marketplace");
  const [account, setAccount] = useState("");
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewProductId, setReviewProductId] = useState(null);
  const [productReviews, setProductReviews] = useState([]);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImage, setProductImage] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [storeIpfsHash, setStoreIpfsHash] = useState("");
  const [selectedTxDetails, setSelectedTxDetails] = useState(null);
  const [selectedTxHash, setSelectedTxHash] = useState("");
  const [myStoreId, setMyStoreId] = useState(0);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  

  const connectWallet = async () => {
  const account = await connect();
  if (account) {
    setAccount(account);
    await loadMyStore();
  }
};
  const loadProducts = async () => {
  try {
    setLoadingProducts(true);

    const data = await getAllProducts();

    const productsWithMetadata = await Promise.all(
      data.map(async (product) => {
        const metadata = await getIpfsJson(product.ipfsHash);

        return {
          ...product,
          metadata,
        };
      })
    );

    setProducts(productsWithMetadata);
  } catch (error) {
    console.error("Erreur loadProducts:", error);
    setProducts([]);
  } finally {
    setLoadingProducts(false);
  }
};

  const getIpfsJson = async (ipfsHash) => {
  try {
    if (!ipfsHash || !ipfsHash.startsWith("ipfs://")) {
      return null;
    }

    const cleanHash = ipfsHash.replace("ipfs://", "");
    const response = await fetch(`https://ipfs.io/ipfs/${cleanHash}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur lecture IPFS:", error);
    return null;
  }
};


const loadOrders = async () => {
  const data = await getAllOrders();
  setOrders(data);
};

const loadMyStore = async () => {
  try {
    setLoadingStore(true);
    const storeId = await getMyStoreId();
    setMyStoreId(storeId);
  } catch (error) {
    console.error("Erreur loadMyStore:", error);
    setMyStoreId(0);
  } finally {
    setLoadingStore(false);
  }
};

const getStoredTxHash = (orderId) => {
  const hashes = JSON.parse(localStorage.getItem("orderTxHashes") || "{}");
  return hashes[orderId] || "Non disponible";
};

const loadReviews = async (productId) => {
  const data = await getReviewsByProduct(productId);
  setProductReviews(data);
};

const openTransactionDetails = async (orderId) => {
  const txHash = getStoredTxHash(orderId);

  if (!txHash || txHash === "Non disponible") {
    alert("Hash non disponible pour cette commande");
    return;
  }

  const details = await getTransactionDetails(txHash);

  if (!details) {
    alert("Impossible de charger les détails de la transaction");
    return;
  }

  setSelectedTxHash(txHash);
  setSelectedTxDetails(details);
  setActivePage("transactionDetails");
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
  loadOrders();
  loadMyStore();
}, []);
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
  if (accounts.length === 0) {
    setAccount("");
    setMyStoreId(0);
  } else {
    setAccount(accounts[0]);
    await loadMyStore();
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
  id={product.id}
  name={product.metadata?.name || `Produit #${product.id}`}
  description={product.metadata?.description || ""}
  image={product.metadata?.image || ""}
  price={`${product.price} ETH`}
  seller={product.seller}
  averageRating={product.averageRating}
  onPurchaseSuccess={async () => {
    await loadProducts();
    await loadOrders();
  }}
/>
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "vendre" && (
  <section className="page-card">
    <h1>Vendre</h1>

    {loadingStore ? (
      <p>Chargement de la boutique...</p>
    ) : myStoreId === 0 ? (
      <div>
        <h2>Créer une boutique</h2>
        <p>Vous n’avez pas encore de boutique.</p>
        <input
          type="text"
          placeholder="Nom de la boutique"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          style={{ display: "block", marginBottom: "10px", width: "100%" }}
       />

<input
  type="text"
  placeholder="IPFS Hash de la boutique"
  value={storeIpfsHash}
  onChange={(e) => setStoreIpfsHash(e.target.value)}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
/>

        <button
          onClick={async () => {
  if (!storeName.trim()) {
    alert("Nom de boutique invalide");
    return;
  }

  if (!storeIpfsHash.trim()) {
    alert("IPFS Hash invalide");
    return;
  }

  const result = await createStore(storeName, storeIpfsHash);

  if (result.success) {
    alert("Boutique créée !");
    setStoreName("");
    setStoreIpfsHash("");
    await loadMyStore();
  } else {
    alert(result.error);
  }
}}
        >
          Créer ma boutique
        </button>
      </div>
    ) : (
      <div>
        <p>Votre boutique existe déjà (ID : {myStoreId})</p>

        <hr style={{ margin: "20px 0" }} />

        <h2>Ajouter un produit</h2>

  <input
  type="text"
  placeholder="Nom du produit"
  value={productName}
  onChange={(e) => setProductName(e.target.value)}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
/>

<textarea
  placeholder="Description du produit"
  value={productDescription}
  onChange={(e) => setProductDescription(e.target.value)}
  rows={4}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
/>

<select
  value={productCategory}
  onChange={(e) => setProductCategory(e.target.value)}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
>
  <option value="">Choisir une catégorie</option>

  <option value="mode">Mode</option>
  <option value="electronique">Électronique</option>
  <option value="maison">Maison & Décoration</option>
  <option value="sport">Sport & Loisirs</option>
  <option value="beaute">Beauté & Santé</option>
  <option value="automobile">Automobile</option>
  <option value="jeux">Jeux & Gaming</option>
  <option value="livres">Livres & Éducation</option>
  <option value="alimentaire">Alimentaire</option>
  <option value="autre">Autre</option>
</select>

{productCategory === "autre" && (
  <input
    type="text"
    placeholder="Entrer une catégorie personnalisée"
    value={customCategory}
    onChange={(e) => setCustomCategory(e.target.value)}
    style={{ display: "block", marginBottom: "10px", width: "100%" }}
  />
)}

<input
  type="text"
  placeholder="Image URL"
  value={productImage}
  onChange={(e) => setProductImage(e.target.value)}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
/>

<input
  type="text"
  placeholder="Prix en ETH (ex: 0.01)"
  value={productPrice}
  onChange={(e) => setProductPrice(e.target.value)}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
/>

<input
  type="number"
  min="1"
  placeholder="Stock"
  value={productStock}
  onChange={(e) => setProductStock(e.target.value)}
  style={{ display: "block", marginBottom: "10px", width: "100%" }}
/>

        <button
  onClick={async () => {
    if (!productName.trim()) {
      alert("Nom du produit invalide");
      return;
    }

    if (!productDescription.trim()) {
      alert("Description invalide");
      return;
    }

    if (!productCategory) {
      alert("Veuillez choisir une catégorie");
      return;
    }

    if (productCategory === "autre") {
      if (!customCategory.trim()) {
        alert("Veuillez entrer une catégorie personnalisée");
        return;
      }

      const regex = /^[A-Za-zÀ-ÿ\s]+$/;

      if (!regex.test(customCategory)) {
        alert("La catégorie doit contenir uniquement des lettres");
        return;
      }
    }

    if (!productImage.trim()) {
      alert("Image invalide");
      return;
    }

    if (!productPrice || isNaN(productPrice)) {
      alert("Prix invalide");
      return;
    }

    if (Number(productStock) <= 0) {
      alert("Stock invalide");
      return;
    }
const finalCategory =
  productCategory === "autre" ? customCategory.trim() : productCategory;

console.log("Catégorie finale :", finalCategory);

  // 1. Construire JSON produit
  const productMetadata = {
    name: productName,
    description: productDescription,
    image: productImage,
  };

  // 2. Upload IPFS
  const uploadResult = await uploadJsonToIPFS(productMetadata);

  if (!uploadResult.success) {
    alert(uploadResult.error || "Erreur upload IPFS");
    return;
  }

  console.log("IPFS HASH:", uploadResult.ipfsHash);

  // 3. Convertir prix
  const priceInWei = parseEther(productPrice);

  // 4. Envoyer au smart contract
  const result = await addProduct(
  priceInWei.toString(),
  productStock,
  uploadResult.ipfsHash
);

if (result.success) {
  console.log("Envoi au backend...");

  const backendResult = await saveProductMetadata({
    contractProductId: result.productId || null,
    sellerAddress: account,
    name: productName,
    description: productDescription,
    category: finalCategory,
    imageIpfsHash: uploadResult.ipfsHash,
  });

  console.log("Réponse backend :", backendResult);

  alert("Produit ajouté !");

  setProductName("");
  setProductDescription("");
  setProductImage("");
  setProductPrice("");
  setProductStock("");
  setProductCategory("");
  setCustomCategory("");

  await loadProducts();
} else {
  alert(result.error);
}
}}
        >
          Ajouter le produit
        </button>
      </div>
    )}
  </section>
)}

                    {activePage === "transactions" && (
  <section className="page-card">
    <h1>Transactions</h1>

    {orders.length === 0 ? (
      <p>Aucune commande trouvée.</p>
    ) : (
      <div>
        {orders.map((order) => (
          <div
            key={order.id}
            style={{
              border: "1px solid #444",
              borderRadius: "10px",
              padding: "15px",
              marginBottom: "15px",
            }}
          >
            <h3>Commande #{order.id}</h3>
<p>Produit ID : {order.productId}</p>
<p>Acheteur : {order.buyer}</p>
<p>Montant : {formatEther(order.amount)} ETH</p>
<p>Réseau : Hardhat local</p>
<p>Hash : {getStoredTxHash(order.id)}</p>

<button
  onClick={() => openTransactionDetails(order.id)}
  style={{ marginBottom: "10px" }}
>
  Voir détails transaction
</button>

<p>Livrée : {order.delivered ? "Oui" : "Non"}</p>
<p>Fonds libérés : {order.released ? "Oui" : "Non"}</p>

            {!order.released && (
              <button
                onClick={async () => {
                  const result = await confirmDelivery(order.id);

                  if (result.success) {
                    alert("Livraison confirmée !");
                    loadOrders();
                  } else {
                    alert(result.error);
                  }
                }}
              >
                Confirmer la livraison
              </button>
            )}

            {order.released && (
              <button
                onClick={async () => {
                  setSelectedOrderId(order.id);
                  setReviewProductId(order.productId);
                  await loadReviews(order.productId);
                  setActivePage("avis");
                }}
              >
                Laisser un avis
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </section>
)}

{activePage === "avis" && (
  <section className="page-card">
    <h1>Laisser un avis</h1>

    {!selectedOrderId ? (
      <p>Sélectionne une commande depuis "Transactions"</p>
    ) : (
      <div>
        <p>Commande #{selectedOrderId}</p>
        <p>Produit ID : {reviewProductId}</p>

        <label>Note :</label>
        <select
          value={reviewRating}
          onChange={(e) => setReviewRating(e.target.value)}
        >
          <option value="1">1 ⭐</option>
          <option value="2">2 ⭐</option>
          <option value="3">3 ⭐</option>
          <option value="4">4 ⭐</option>
          <option value="5">5 ⭐</option>
        </select>

        <br />
        <br />

        <label>Commentaire :</label>
        <br />
        <textarea
          value={reviewComment}
          onChange={(e) => setReviewComment(e.target.value)}
          placeholder="Ton avis..."
          rows={4}
          style={{ width: "100%" }}
        />

        <br />
        <br />

        <button
          onClick={async () => {
            const result = await submitReview(
              selectedOrderId,
              Number(reviewRating),
              reviewComment || "ipfs://review"
            );

            if (result.success) {
              alert("Avis ajouté !");
              await loadReviews(reviewProductId);
              setSelectedOrderId(null);
              setReviewProductId(null);
              setReviewComment("");
              setReviewRating(5);
            } else {
              alert(result.error);
            }
          }}
        >
          Envoyer l’avis
        </button>

        <hr style={{ margin: "20px 0" }} />

        <h2>Avis du produit</h2>

        <p><strong>Produit ID :</strong> {reviewProductId}</p>

        {productReviews.length === 0 ? (
          <p>Aucun avis pour ce produit.</p>
        ) : (
          <div>
            {productReviews.map((review) => (
              <div
                key={review.id}
                style={{
                  border: "1px solid #444",
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "10px",
                }}
              >
                <p>Commande #{review.orderId}</p>
                <p>Produit #{review.productId}</p>
                <p>Note : {"⭐".repeat(review.rating)} ({review.rating}/5)</p>
                <p>Commentaire : {review.ipfsHash}</p>
                <p>Auteur : {review.reviewer}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </section>
)}

{activePage === "transactionDetails" && (
  <section className="page-card">
    <h1>Détails de la transaction</h1>

    {!selectedTxDetails ? (
      <p>Aucune transaction sélectionnée.</p>
    ) : (
      <div>
        <p><strong>Réseau :</strong> Hardhat local</p>

        <hr style={{ margin: "20px 0" }} />

        <p><strong>Hash :</strong> {selectedTxDetails.hash}</p>

        <p><strong>Statut :</strong> {selectedTxDetails.status}</p>

        <p><strong>From :</strong> {selectedTxDetails.from}</p>

        <p><strong>To (Contrat) :</strong> {selectedTxDetails.to}</p>

        <p><strong>Montant :</strong> {selectedTxDetails.value} ETH</p>

        <p><strong>Bloc :</strong> {selectedTxDetails.blockNumber}</p>

        <p><strong>Timestamp :</strong> {selectedTxDetails.timestamp}</p>

        <p><strong>Gas limit :</strong> {selectedTxDetails.gasLimit}</p>

        <p><strong>Gas utilisé :</strong> {selectedTxDetails.gasUsed}</p>

        <p><strong>Prix du gas :</strong> {selectedTxDetails.gasPriceEth} ETH</p>

        <p>
          <strong>Coût total gas :</strong>{" "}
          {selectedTxDetails.totalGasCostEth} ETH
        </p>

        <br />

        <button onClick={() => setActivePage("transactions")}>
          Retour
        </button>
      </div>
    )}
  </section>
)}

        </main>
      </div>
    </div>
  );
}

export default App;