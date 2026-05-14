import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { parseEther, formatEther } from "ethers";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ProductCard from "./components/ProductCard";
import {
  connectWallet as connect,
  signMessage,
  getAllProducts,
  checkWalletConnection,
  createStore,
  addProduct,
  confirmDelivery,
  getBuyerOrders,
  submitReview,
  getReviewsByProduct,
  getTransactionDetails,
  getMyStoreId,
  getSellerOrders,
  claimRefund,
  openDispute,
  releaseFunds,
  resolveDispute,
  getAdminAddress,
} from "./utils/web3";
import { uploadFileToIPFS, uploadJsonToIPFS } from "./utils/ipfs";
import { saveProductMetadata, getProductsMetadata, getNonce, verifySignature } from "./utils/api";

const categories = [
  // Numérique & Blockchain
  "NFT & Art digital",
  "Crypto & Tokens",
  "Domaines Web3",
  "Jeux & Gaming",
  "Logiciels & Licences",
  "Musique & Audio",
  "Vidéo & Cinéma",
  "Photos & Visuels",
  "Ebooks & Formation",
  // Physique
  "Électronique & High-Tech",
  "Informatique & Accessoires",
  "Mode & Vêtements",
  "Chaussures",
  "Montres & Bijoux",
  "Maison & Décoration",
  "Jardin & Extérieur",
  "Sports & Fitness",
  "Jeux & Jouets",
  "Livres & BD",
  "Voitures & Véhicules",
  "Collectionables & Vintage",
  "Alimentation & Épicerie",
  "Santé & Beauté",
  "Art & Artisanat",
  // Services
  "Services & Freelance",
  "Immobilier tokenisé",
  "Certificats & Documents",
  "Autre",
];

function shortAddress(address) {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isTokenValid() {
  const token = localStorage.getItem("authToken");
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function App() {
  const [activePage, setActivePage] = useState("marketplace");
  const [account, setAccount] = useState("");
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [productReviews, setProductReviews] = useState([]);
  const [selectedTxDetails, setSelectedTxDetails] = useState(null);
  const [selectedTxHash, setSelectedTxHash] = useState("");
  const [myStoreId, setMyStoreId] = useState(0);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImageFile, setProductImageFile] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productCategory, setProductCategory] = useState("NFT & Art digital");
  const [customCategory, setCustomCategory] = useState("");
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("Toutes");
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");
  const [sellerOrders, setSellerOrders] = useState([]);
  const [completingProductId, setCompletingProductId] = useState(null);
  const [completeImageFile, setCompleteImageFile] = useState(null);
  const [completeName, setCompleteName] = useState("");
  const [completeDescription, setCompleteDescription] = useState("");
  const [completeCategory, setCompleteCategory] = useState("NFT & Art digital");
  const [backendStatus, setBackendStatus] = useState("checking");
  const [adminAddress, setAdminAddress] = useState("");
  const [disputeOrderId, setDisputeOrderId] = useState(null);
  const [disputeReason, setDisputeReason] = useState("Produit endommagé");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeImageFile, setDisputeImageFile] = useState(null);
  const [disputeDetails, setDisputeDetails] = useState({});

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);

      // Charger blockchain ET SQL en parallèle
      const [sqlResult, chainProducts] = await Promise.all([
        getProductsMetadata(),
        getAllProducts(),
      ]);

      setBackendStatus(sqlResult.success ? "online" : "offline");

      // Construire une map SQL indexée par contract_product_id
      const sqlMap = {};
      if (sqlResult.success && sqlResult.data) {
        sqlResult.data.forEach((p) => {
          if (p.contract_product_id) sqlMap[p.contract_product_id] = p;
        });
      }

      // La blockchain est la source de vérité — on itère dessus
      const formattedProducts = chainProducts.map((p) => {
        const sql = sqlMap[p.id] || {};
        return {
          id: p.id,
          price: p.price,
          stock: p.stock,
          seller: p.seller,
          ipfsHash: p.ipfsHash,
          averageRating: p.averageRating,
          metadata: {
            name: sql.name || `Produit #${p.id}`,
            description: sql.description || "",
            category: sql.category || "",
            image: sql.image_ipfs_hash || "",
          },
        };
      });

      setProducts(formattedProducts);
    } catch (error) {
      console.error("Erreur loadProducts:", error);
      setProducts([]);
      setBackendStatus("offline");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadOrders = async (address) => {
    const addr = address ?? account;
    if (!addr) { setOrders([]); return; }
    const data = await getBuyerOrders(addr);
    setOrders(data);
  };

  const loadSellerOrders = async (address) => {
    if (!address) return;
    const data = await getSellerOrders(address);
    setSellerOrders(data);
    await loadDisputeDetails(data);
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

  const refreshAll = async (addr) => {
    const a = addr ?? account;
    await Promise.all([loadProducts(), loadOrders(a), loadMyStore()]);
  };

  const connectWallet = async () => {
    // 1. Connexion MetaMask
    const connectedAccount = await connect();
    if (!connectedAccount) return;

    // 2. Demande du nonce au backend
    const nonceResult = await getNonce(connectedAccount);
    if (!nonceResult.success) {
      toast.error("Impossible d'obtenir le nonce");
      return;
    }

    // 3. Signature du message par MetaMask
    const signingToast = toast.loading("Signez le message dans MetaMask...");
    const signResult = await signMessage(nonceResult.message);
    toast.dismiss(signingToast);

    if (!signResult.success) {
      toast.error("Signature refusée");
      return;
    }

    // 4. Vérification côté backend → obtention du JWT
    const verifyToast = toast.loading("Vérification de l'identité...");
    const verifyResult = await verifySignature(connectedAccount, signResult.signature);
    toast.dismiss(verifyToast);

    if (!verifyResult.success) {
      toast.error("Authentification échouée : " + verifyResult.error);
      return;
    }

    // 5. Stockage du JWT et mise à jour du state
    localStorage.setItem("authToken", verifyResult.token);
    setAccount(connectedAccount);
    toast.success("Connecté et authentifié");
    await refreshAll(connectedAccount);
    await loadSellerOrders(connectedAccount);
  };

  const disconnectWallet = () => {
    setAccount("");
    setMyStoreId(0);
    setSellerOrders([]);
    localStorage.removeItem("authToken");
    toast("Wallet déconnecté");
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
      toast.error("Hash non disponible pour cette commande");
      return;
    }

    const details = await getTransactionDetails(txHash);

    if (!details) {
      toast.error("Impossible de charger les détails de la transaction");
      return;
    }

    setSelectedTxHash(txHash);
    setSelectedTxDetails(details);
    setActivePage("transactionDetails");
  };

  useEffect(() => {
    const initWallet = async () => {
      const result = await checkWalletConnection();

      if (result.connected) {
        const token = localStorage.getItem("authToken");
        if (token) {
          // Vérifie que le token n'est pas expiré (décodage côté client sans vérification)
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            if (payload.exp * 1000 > Date.now()) {
              setAccount(result.accounts[0]);
            } else {
              localStorage.removeItem("authToken");
            }
          } catch {
            localStorage.removeItem("authToken");
          }
        }
      }
    };

    initWallet();
    refreshAll();
    getAdminAddress().then(a => { if (a) setAdminAddress(a.toLowerCase()); });
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      // Déconnexion forcée — l'utilisateur doit se reconnecter manuellement
      setAccount("");
      setMyStoreId(0);
      setSellerOrders([]);
      setOrders([]);
      localStorage.removeItem("authToken");
      toast("Compte changé — reconnecte ton wallet", { icon: "🔄" });
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const text = query.trim().toLowerCase();

    return products.filter((product) => {
      const metadata = product.metadata || {};

      if (text) {
        const matches = [metadata.name, metadata.description, metadata.category, product.seller, product.id?.toString()]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(text));
        if (!matches) return false;
      }

      if (filterCategory !== "Toutes" && metadata.category !== filterCategory) return false;
      if (filterPriceMin && Number(product.price) < Number(filterPriceMin)) return false;
      if (filterPriceMax && Number(product.price) > Number(filterPriceMax)) return false;

      return true;
    });
  }, [products, query, filterCategory, filterPriceMin, filterPriceMax]);

  const totalValueEth = useMemo(() => {
    return products.reduce((sum, product) => sum + Number(product.price || 0), 0);
  }, [products]);

  const uniqueSellers = useMemo(() => {
    return new Set(products.map((product) => product.seller?.toLowerCase()).filter(Boolean)).size;
  }, [products]);

  const createStoreHandler = async (event) => {
    event.preventDefault();

    if (!account) {
      toast.error("Connecte MetaMask d'abord");
      return;
    }

    if (!isTokenValid()) {
      localStorage.removeItem("authToken");
      setAccount("");
      toast.error("Session expirée — reconnecte ton wallet");
      return;
    }

    if (!storeName.trim()) {
      toast.error("Nom de boutique obligatoire");
      return;
    }

    // Upload des métadonnées boutique sur IPFS
    const ipfsToast = toast.loading("Upload métadonnées boutique sur IPFS...");
    const ipfsResult = await uploadJsonToIPFS({
      name: storeName.trim(),
      description: storeDescription.trim() || "",
      owner: account,
      createdAt: new Date().toISOString(),
    });
    toast.dismiss(ipfsToast);

    if (!ipfsResult.success) {
      toast.error("Erreur upload IPFS : " + ipfsResult.error);
      return;
    }

    const loading = toast.loading("Création boutique sur la blockchain...");
    const result = await createStore(storeName.trim(), ipfsResult.ipfsHash);
    toast.dismiss(loading);

    if (result.success) {
      toast.success("Boutique créée avec métadonnées IPFS");
      setStoreName("");
      setStoreDescription("");
      await loadMyStore();
    } else {
      toast.error(result.error);
    }
  };

  const addProductHandler = async (event) => {
    event.preventDefault();

    if (!account) {
      toast.error("Connecte MetaMask d'abord");
      return;
    }

    if (!isTokenValid()) {
      localStorage.removeItem("authToken");
      setAccount("");
      toast.error("Session expirée — reconnecte ton wallet pour continuer");
      return;
    }

    if (!productName.trim() || !productPrice || !productStock) {
      toast.error("Nom, prix et stock obligatoires");
      return;
    }

    if (!productImageFile) {
      toast.error("Ajoute une vraie image du produit");
      return;
    }

    const selectedCategory = productCategory === "Autre" ? customCategory.trim() : productCategory;

    if (!selectedCategory) {
      toast.error("Catégorie obligatoire");
      return;
    }

    try {
      const uploadToast = toast.loading("Upload image vers IPFS...");
      const uploadResult = await uploadFileToIPFS(productImageFile);
      toast.dismiss(uploadToast);

      if (!uploadResult.success) {
        toast.error(uploadResult.error);
        return;
      }

      const priceWei = parseEther(productPrice).toString();

      const txToast = toast.loading("Ajout produit sur smart contract...");
      const result = await addProduct(priceWei, productStock, uploadResult.ipfsHash, account);
      toast.dismiss(txToast);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      const sqlToast = toast.loading("Enregistrement metadata en base...");
      const sqlResult = await saveProductMetadata({
        contractProductId: result.productId,
        sellerAddress: account,
        name: productName,
        description: productDescription,
        category: selectedCategory,
        imageIpfsHash: uploadResult.ipfsHash,
      });
      toast.dismiss(sqlToast);

      if (!sqlResult.success) {
        toast.error("Image et métadonnées non sauvegardées — reconnecte ton wallet");
      } else {
        toast.success("Produit publié avec succès");
      }

      setProductName("");
      setProductDescription("");
      setProductImageFile(null);
      setProductImagePreview("");
      setProductPrice("");
      setProductStock("");
      setProductCategory("NFT");
      setCustomCategory("");
      await loadProducts();
      setActivePage("marketplace");
    } catch (error) {
      console.error(error);
      toast.error("Erreur ajout produit");
    }
  };

  const completeMetadataHandler = async (event) => {
    event.preventDefault();

    if (!isTokenValid()) {
      localStorage.removeItem("authToken");
      setAccount("");
      toast.error("Session expirée — reconnecte ton wallet");
      return;
    }

    if (!completingProductId || !completeName.trim() || !completeImageFile) {
      toast.error("Nom et image obligatoires");
      return;
    }

    const ipfsToast = toast.loading("Upload image vers IPFS...");
    const uploadResult = await uploadFileToIPFS(completeImageFile);
    toast.dismiss(ipfsToast);

    if (!uploadResult.success) {
      toast.error("Erreur upload image");
      return;
    }

    const saveToast = toast.loading("Sauvegarde des métadonnées...");
    const result = await saveProductMetadata({
      contractProductId: completingProductId,
      sellerAddress: account,
      name: completeName.trim(),
      description: completeDescription.trim(),
      category: completeCategory,
      imageIpfsHash: uploadResult.ipfsHash,
    });
    toast.dismiss(saveToast);

    if (result.success) {
      toast.success("Métadonnées ajoutées");
      setCompletingProductId(null);
      setCompleteName("");
      setCompleteDescription("");
      setCompleteImageFile(null);
      setCompleteCategory("NFT");
      await loadProducts();
    } else {
      toast.error("Erreur : " + (result.error || "inconnue"));
    }
  };

  const openDisputeHandler = async (e) => {
    e.preventDefault();
    if (!disputeOrderId) return;

    let imageIpfsHash = "";
    if (disputeImageFile) {
      const uploadToast = toast.loading("Upload preuve vers IPFS...");
      const uploadResult = await uploadFileToIPFS(disputeImageFile);
      toast.dismiss(uploadToast);
      if (!uploadResult.success) {
        toast.error("Erreur upload image : " + uploadResult.error);
        return;
      }
      imageIpfsHash = uploadResult.ipfsHash;
    }

    const metaToast = toast.loading("Enregistrement du litige sur IPFS...");
    const metaResult = await uploadJsonToIPFS({
      reason: disputeReason,
      description: disputeDescription.trim() || "",
      imageIpfsHash,
      orderId: disputeOrderId,
      timestamp: new Date().toISOString(),
    });
    toast.dismiss(metaToast);

    if (!metaResult.success) {
      toast.error("Erreur IPFS : " + metaResult.error);
      return;
    }

    const loading = toast.loading("Ouverture du litige sur blockchain...");
    const result = await openDispute(disputeOrderId, metaResult.ipfsHash);
    toast.dismiss(loading);

    if (result.success) {
      toast.success("Litige ouvert — l'admin va examiner votre dossier");
      setDisputeOrderId(null);
      setDisputeReason("Produit endommagé");
      setDisputeDescription("");
      setDisputeImageFile(null);
      await loadOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const releaseFundsHandler = async (orderId) => {
    const loading = toast.loading("Libération des fonds...");
    const result = await releaseFunds(orderId);
    toast.dismiss(loading);
    if (result.success) {
      toast.success("Fonds libérés au vendeur");
      await loadSellerOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const resolveDisputeHandler = async (orderId, favorBuyer) => {
    const loading = toast.loading("Résolution du litige...");
    const result = await resolveDispute(orderId, favorBuyer);
    toast.dismiss(loading);
    if (result.success) {
      toast.success(favorBuyer ? "Litige résolu — acheteur remboursé" : "Litige résolu — vendeur payé");
      await loadSellerOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const claimRefundHandler = async (orderId) => {
    const loading = toast.loading("Demande de remboursement...");
    const result = await claimRefund(orderId);
    toast.dismiss(loading);
    if (result.success) {
      toast.success("Remboursement effectué");
      await loadOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const confirmDeliveryHandler = async (orderId) => {
    const loading = toast.loading("Confirmation livraison...");
    const result = await confirmDelivery(orderId);
    toast.dismiss(loading);

    if (result.success) {
      toast.success("Livraison confirmée");
      await loadOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const submitReviewHandler = async (event) => {
    event.preventDefault();

    if (!selectedOrderId) {
      toast.error("Sélectionne une commande");
      return;
    }

    const order = orders.find((item) => item.id === Number(selectedOrderId));

    if (!order) {
      toast.error("Commande introuvable");
      return;
    }

    const loading = toast.loading("Publication avis sur blockchain...");
    const result = await submitReview(selectedOrderId, reviewRating, reviewComment || "Avis sans commentaire");
    toast.dismiss(loading);

    if (result.success) {
      toast.success("Avis publié");
      setReviewComment("");
      await loadReviews(order.productId);
      await loadProducts();
    } else {
      toast.error(result.error);
    }
  };

  const loadDisputeDetails = async (orders) => {
    const disputed = orders.filter(o => o.disputed && o.disputeIpfsHash);
    const details = {};
    await Promise.all(disputed.map(async (o) => {
      try {
        const url = o.disputeIpfsHash.startsWith("ipfs://")
          ? `https://gateway.pinata.cloud/ipfs/${o.disputeIpfsHash.replace("ipfs://", "")}`
          : `https://gateway.pinata.cloud/ipfs/${o.disputeIpfsHash}`;
        const res = await fetch(url);
        details[o.id] = await res.json();
      } catch {
        details[o.id] = null;
      }
    }));
    setDisputeDetails(prev => ({ ...prev, ...details }));
  };

  const navigateTo = (page) => {
    setActivePage(page);
    setSelectedOrderId(null);
    setProductReviews([]);
    setReviewComment("");
    setReviewRating(5);
  };

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={navigateTo}
        productsCount={products.length}
        ordersCount={orders.length}
      />

      <div className="main">
        <Topbar
          account={account}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
          query={query}
          setQuery={setQuery}
        />

        <main className="content">

          {activePage === "marketplace" && (
            <section className="page-card marketplace-page">
              <div className="filters-bar">
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="Toutes">Toutes les catégories</option>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div className="price-range">
                  <input
                    type="number"
                    placeholder="Prix min (ETH)"
                    value={filterPriceMin}
                    onChange={(e) => setFilterPriceMin(e.target.value)}
                    min="0"
                    step="0.001"
                  />
                  <span>—</span>
                  <input
                    type="number"
                    placeholder="Prix max (ETH)"
                    value={filterPriceMax}
                    onChange={(e) => setFilterPriceMax(e.target.value)}
                    min="0"
                    step="0.001"
                  />
                </div>
                {(filterCategory !== "Toutes" || filterPriceMin || filterPriceMax) && (
                  <button className="ghost-btn" onClick={() => { setFilterCategory("Toutes"); setFilterPriceMin(""); setFilterPriceMax(""); }}>
                    <i className="bi bi-x-circle"></i>
                    Réinitialiser
                  </button>
                )}
              </div>

              {loadingProducts ? (
                <div className="empty-state">
                  <div className="loader"></div>
                  <h3>Chargement des produits...</h3>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="empty-state">
                  <i className="bi bi-bag-x"></i>
                  <h3>Aucun produit trouvé</h3>
                  <p>Essaie d’autres filtres ou publie un article depuis l’onglet Vendre.</p>
                </div>
              ) : (
                <div className="products-grid">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.metadata?.name || `Produit on-chain #${product.id}`}
                      description={product.metadata?.description || ""}
                      category={product.metadata?.category || ""}
                      image={product.metadata?.image || ""}
                      ipfsHash={product.ipfsHash}
                      price={`${product.price} ETH`}
                      stock={product.stock}
                      seller={product.seller}
                      averageRating={product.averageRating}
                      account={account}
                      onPurchaseSuccess={refreshAll}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "vendre" && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Publication réelle</span>
                  <h1>Vendre un produit</h1>
                  <p>
                    La boutique et le produit sont envoyés au smart contract. L’image et les infos produit
                    sont liées à IPFS/PostgreSQL.
                  </p>
                </div>
              </div>

              {loadingStore ? (
                <div className="empty-state">
                  <div className="loader"></div>
                  <h3>Chargement de ta boutique...</h3>
                </div>
              ) : myStoreId === 0 ? (
                <form className="form-panel" onSubmit={createStoreHandler}>
                  <h2>Créer une boutique</h2>
                  <p>Les informations seront stockées sur IPFS et référencées dans le smart contract.</p>

                  <label>Nom de la boutique</label>
                  <input
                    type="text"
                    placeholder="Ex: Galerie NFT Paris"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />

                  <label>Description <small style={{ color: "var(--muted)", fontWeight: 400 }}>(optionnelle)</small></label>
                  <textarea
                    rows="3"
                    placeholder="Décris ta boutique en quelques mots..."
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                  />

                  <button className="primary-btn w-100" type="submit">
                    <i className="bi bi-shop"></i>
                    Créer ma boutique
                  </button>
                </form>
              ) : (
                <div className="sell-grid">
                  <form className="form-panel" onSubmit={addProductHandler}>
                    <h2>Ajouter un produit réel</h2>
                    <p>Boutique active : #{myStoreId}</p>

                    <label>Nom du produit</label>
                    <input
                      type="text"
                      placeholder="Nom réel affiché dans la marketplace"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />

                    <label>Description</label>
                    <textarea
                      rows="4"
                      placeholder="Description réelle du produit"
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                    />

                    <label>Catégorie</label>
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                    >
                      {categories.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>

                    {productCategory === "Autre" && (
                      <input
                        type="text"
                        placeholder="Votre catégorie"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                      />
                    )}

                    <div className="form-row">
                      <div>
                        <label>Prix en ETH</label>
                        <input
                          type="number"
                          step="0.0001"
                          placeholder="0.05"
                          value={productPrice}
                          onChange={(e) => setProductPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Stock</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="10"
                          value={productStock}
                          onChange={(e) => setProductStock(e.target.value)}
                        />
                      </div>
                    </div>

                    <label>Image réelle du produit</label>
                    <div className="upload-box">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setProductImageFile(file);
                          setProductImagePreview(file ? URL.createObjectURL(file) : "");
                        }}
                      />
                      <span>
                        <i className="bi bi-cloud-arrow-up"></i>
                        Upload vers IPFS via Pinata
                      </span>
                    </div>

                    <button className="primary-btn w-100" type="submit">
                      <i className="bi bi-plus-circle"></i>
                      Ajouter produit
                    </button>
                  </form>

                  <aside className="preview-panel">
                    <h3>Aperçu avant publication</h3>
                    {productImagePreview ? (
                      <img src={productImagePreview} alt="Aperçu produit" />
                    ) : (
                      <div className="preview-placeholder">
                        <i className="bi bi-image"></i>
                        Image réelle du produit
                      </div>
                    )}

                    <h4>{productName || "Nom du produit"}</h4>
                    <p>{productDescription || "Description du produit."}</p>

                    <div className="real-data-grid">
                      <div>
                        <small>Prix</small>
                        <strong>{productPrice || "0"} ETH</strong>
                      </div>
                      <div>
                        <small>Stock</small>
                        <strong>{productStock || "0"}</strong>
                      </div>
                      <div>
                        <small>Catégorie</small>
                        <strong>{productCategory === "Autre" ? customCategory || "Autre" : productCategory}</strong>
                      </div>
                      <div>
                        <small>Vendeur</small>
                        <strong>{shortAddress(account)}</strong>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </section>
          )}

          {activePage === "transactions" && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Mes achats</span>
                  <h1>Mes commandes</h1>
                  <p>
                    Uniquement vos achats personnels. Confirmez la livraison pour libérer les fonds au vendeur.
                  </p>
                </div>

                {account && (
                  <button className="primary-btn" onClick={() => loadOrders(account)}>
                    <i className="bi bi-arrow-clockwise"></i>
                    Recharger
                  </button>
                )}
              </div>

              {!account ? (
                <div className="empty-state">
                  <i className="bi bi-wallet2"></i>
                  <h3>Connecte ton wallet</h3>
                  <p>Tes commandes s'affichent uniquement quand tu es connecté.</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <i className="bi bi-receipt"></i>
                  <h3>Aucun achat effectué</h3>
                  <p>Achetez un produit depuis la marketplace pour le voir ici.</p>
                </div>
              ) : (
                <div className="table-panel">
                  <div className="table-head" style={{ gridTemplateColumns: "0.6fr 1.2fr 1fr 1fr 2fr" }}>
                    <span>ID</span>
                    <span>Produit</span>
                    <span>Montant</span>
                    <span>Statut</span>
                    <span>Actions</span>
                  </div>

                  {orders
                    .filter(order => order.buyer?.toLowerCase() === account?.toLowerCase())
                    .map((order) => {
                      const now = Math.floor(Date.now() / 1000);
                      const disputeDeadline = order.deliveryTimestamp + 48 * 3600;
                      const inWindow = order.delivered && !order.released && !order.disputed && now < disputeDeadline;
                      const hoursLeft = inWindow ? Math.ceil((disputeDeadline - now) / 3600) : 0;

                      let statut = "En attente";
                      if (order.disputeResolved && order.buyerWon) statut = "Remboursé ✓";
                      else if (order.disputeResolved && !order.buyerWon) statut = "Litige refusé";
                      else if (order.disputed) statut = "En litige";
                      else if (order.released) statut = "Terminé";
                      else if (order.delivered) statut = `Livré · ${hoursLeft}h restantes`;

                      let statutClass = "pending";
                      if (order.disputeResolved && order.buyerWon) statutClass = "refunded";
                      else if (order.disputeResolved && !order.buyerWon) statutClass = "rejected";
                      else if (order.disputed) statutClass = "disputed";
                      else if (order.released) statutClass = "ok";
                      else if (order.delivered) statutClass = "delivered";

                      return (
                        <div className="table-row" key={order.id} style={{ gridTemplateColumns: "0.6fr 1.2fr 1fr 1fr 2fr" }}>
                          <span>#{order.id}</span>
                          <strong>{products.find(p => p.id === order.productId)?.metadata?.name || `Produit #${order.productId}`}</strong>
                          <span>{formatEther(order.amount)} ETH</span>
                          <em className={statutClass}>{statut}</em>
                          <div className="row-actions">
                            {!order.delivered && (
                              <button onClick={() => confirmDeliveryHandler(order.id)}>
                                Confirmer livraison
                              </button>
                            )}
                            {inWindow && !disputeOrderId && (
                              <button className="dispute-btn" onClick={() => setDisputeOrderId(order.id)}>
                                <i className="bi bi-exclamation-triangle"></i>
                                Ouvrir un litige
                              </button>
                            )}
                            {!order.delivered && !order.released && (
                              <button className="refund-btn" onClick={() => claimRefundHandler(order.id)} title="Disponible 7 jours après l'achat">
                                Remboursement
                              </button>
                            )}
                            <button onClick={() => openTransactionDetails(order.id)}>
                              Détails
                            </button>
                            {order.delivered && !order.disputed && (
                              <button
                                onClick={async () => {
                                  setSelectedOrderId(order.id);
                                  await loadReviews(order.productId);
                                }}
                              >
                                Laisser un avis
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {disputeOrderId && (
                <form className="form-panel dispute-form" onSubmit={openDisputeHandler}>
                  <h2><i className="bi bi-exclamation-triangle"></i> Ouvrir un litige — Commande #{disputeOrderId}</h2>
                  <p>Décrivez votre problème. Ces informations seront enregistrées sur IPFS et visibles par l'admin.</p>

                  <label>Raison du litige</label>
                  <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}>
                    <option>Produit endommagé</option>
                    <option>Produit non conforme à la description</option>
                    <option>Produit incomplet / manque des pièces</option>
                    <option>Produit contrefait</option>
                    <option>Vendeur non réactif</option>
                    <option>Autre</option>
                  </select>

                  <label>Description du problème</label>
                  <textarea
                    rows="4"
                    placeholder="Expliquez en détail ce qui s'est passé..."
                    value={disputeDescription}
                    onChange={e => setDisputeDescription(e.target.value)}
                  />

                  <label>Preuve photo <small style={{ color: "var(--muted)", fontWeight: 400 }}>(optionnelle)</small></label>
                  <div className="upload-box">
                    <input type="file" accept="image/*" onChange={e => setDisputeImageFile(e.target.files?.[0] || null)} />
                    <span><i className="bi bi-camera"></i> {disputeImageFile ? disputeImageFile.name : "Ajouter une photo"}</span>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                    <button className="primary-btn dispute-submit-btn" type="submit" style={{ flex: 1 }}>
                      <i className="bi bi-send"></i>
                      Confirmer le litige
                    </button>
                    <button className="ghost-btn" type="button" onClick={() => { setDisputeOrderId(null); setDisputeDescription(""); setDisputeImageFile(null); }}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {selectedOrderId && orders.some(o => o.id === Number(selectedOrderId)) && (
                <form className="form-panel review-panel" onSubmit={submitReviewHandler}>
                  <h2>Laisser un avis</h2>

                  <label>Note</label>
                  <div className="star-picker">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn ${star <= reviewRating ? "active" : ""}`}
                        onClick={() => setReviewRating(star)}
                      >
                        <i className="bi bi-star-fill"></i>
                      </button>
                    ))}
                    <span className="star-label">{reviewRating} / 5</span>
                  </div>

                  <label>Commentaire</label>
                  <textarea
                    rows="3"
                    placeholder="Commentaire d’avis"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />

                  <button className="primary-btn" type="submit">
                    Publier l’avis
                  </button>

                  {productReviews.length > 0 && (
                    <div className="reviews-list">
                      {productReviews.map((review) => (
                        <div key={`${review.productId}-${review.id}`}>
                          <strong>{review.rating}/5</strong>
                          <span>{shortAddress(review.reviewer)}</span>
                          <small>{review.ipfsHash}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              )}
            </section>
          )}

          {activePage === "dashboard" && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Vendeur</span>
                  <h1>Mon Dashboard</h1>
                </div>
                <button className="primary-btn" onClick={() => loadSellerOrders(account)}>
                  <i className="bi bi-arrow-clockwise"></i>
                  Actualiser
                </button>
              </div>

              {!account ? (
                <div className="empty-state">
                  <i className="bi bi-wallet2"></i>
                  <h3>Connecte ton wallet</h3>
                  <p>Le dashboard est disponible une fois connecté.</p>
                </div>
              ) : (
                <>
                  <div className="metrics-grid">
                    <div>
                      <span>Mes produits listés</span>
                      <strong>{products.filter((p) => p.seller?.toLowerCase() === account.toLowerCase()).length}</strong>
                    </div>
                    <div>
                      <span>Ventes effectuées</span>
                      <strong>{sellerOrders.filter((o) => o.delivered).length}</strong>
                    </div>
                    <div>
                      <span>En attente livraison</span>
                      <strong>{sellerOrders.filter((o) => !o.delivered && !o.released).length}</strong>
                    </div>
                    <div>
                      <span>Revenus totaux</span>
                      <strong>
                        {sellerOrders
                          .filter((o) => o.released)
                          .reduce((sum, o) => sum + Number(formatEther(o.amount)), 0)
                          .toFixed(4)} ETH
                      </strong>
                    </div>
                  </div>

                  {/* Produits sans métadonnées → compléter */}
                  {products.filter((p) =>
                    p.seller?.toLowerCase() === account.toLowerCase() &&
                    p.metadata?.name?.startsWith("Produit #")
                  ).length > 0 && (
                    <div className="incomplete-banner">
                      <i className="bi bi-exclamation-triangle"></i>
                      <div>
                        <strong>Produits sans nom ni image</strong>
                        <p>Ces produits existent sur la blockchain mais sans métadonnées. Complète-les ci-dessous.</p>
                      </div>
                    </div>
                  )}

                  {products
                    .filter((p) =>
                      p.seller?.toLowerCase() === account.toLowerCase() &&
                      p.metadata?.name?.startsWith("Produit #")
                    )
                    .map((p) => (
                      <div key={p.id} className="complete-card">
                        <div>
                          <strong>Produit #{p.id}</strong>
                          <span>{p.price} ETH · Stock {p.stock}</span>
                        </div>
                        <button className="primary-btn" onClick={() => {
                          setCompletingProductId(p.id);
                          setCompleteName("");
                          setCompleteDescription("");
                          setCompleteImageFile(null);
                        }}>
                          Ajouter nom & image
                        </button>
                      </div>
                    ))}

                  {completingProductId && (
                    <form className="form-panel" onSubmit={completeMetadataHandler} style={{ marginTop: "16px" }}>
                      <h2>Compléter Produit #{completingProductId}</h2>

                      <label>Nom du produit</label>
                      <input type="text" placeholder="Nom du produit" value={completeName} onChange={(e) => setCompleteName(e.target.value)} />

                      <label>Description</label>
                      <textarea rows="3" placeholder="Description" value={completeDescription} onChange={(e) => setCompleteDescription(e.target.value)} />

                      <label>Catégorie</label>
                      <select value={completeCategory} onChange={(e) => setCompleteCategory(e.target.value)}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>

                      <label>Image du produit</label>
                      <div className="upload-box">
                        <input type="file" accept="image/*" onChange={(e) => setCompleteImageFile(e.target.files?.[0] || null)} />
                        <span><i className="bi bi-cloud-arrow-up"></i> Choisir une image</span>
                      </div>

                      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                        <button className="primary-btn" type="submit" style={{ flex: 1 }}>Sauvegarder</button>
                        <button className="ghost-btn" type="button" onClick={() => setCompletingProductId(null)}>Annuler</button>
                      </div>
                    </form>
                  )}

                  <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>Mes produits</h2>
                  {products.filter((p) => p.seller?.toLowerCase() === account.toLowerCase()).length === 0 ? (
                    <div className="empty-state">
                      <i className="bi bi-box"></i>
                      <h3>Aucun produit publié</h3>
                      <p>Publie ton premier article depuis l'onglet Vendre.</p>
                    </div>
                  ) : (
                    <div className="products-grid">
                      {products
                        .filter((p) => p.seller?.toLowerCase() === account.toLowerCase())
                        .map((product) => (
                          <ProductCard
                            key={product.id}
                            id={product.id}
                            name={product.metadata?.name || `Produit #${product.id}`}
                            description={product.metadata?.description || ""}
                            category={product.metadata?.category || ""}
                            image={product.metadata?.image || ""}
                            ipfsHash={product.ipfsHash}
                            price={`${product.price} ETH`}
                            stock={product.stock}
                            seller={product.seller}
                            averageRating={product.averageRating}
                            account={account}
                            onPurchaseSuccess={refreshAll}
                          />
                        ))}
                    </div>
                  )}

                  <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>Commandes reçues</h2>
                  {sellerOrders.length === 0 ? (
                    <div className="empty-state">
                      <i className="bi bi-receipt"></i>
                      <h3>Aucune commande reçue</h3>
                    </div>
                  ) : (
                    <div className="table-panel">
                      <div className="table-head" style={{ gridTemplateColumns: "0.5fr 1.2fr 1.2fr 0.9fr 1fr 1.2fr" }}>
                        <span>ID</span>
                        <span>Produit</span>
                        <span>Acheteur</span>
                        <span>Montant</span>
                        <span>Statut</span>
                        <span>Action</span>
                      </div>
                      {sellerOrders.map((order) => {
                        const now = Math.floor(Date.now() / 1000);
                        const canRelease = order.delivered && !order.released && !order.disputed
                          && now >= order.deliveryTimestamp + 48 * 3600;
                        let statut = "En attente";
                        if (order.disputed) statut = "En litige";
                        else if (order.released) statut = "Payé";
                        else if (order.delivered) statut = "Livré";
                        return (
                          <div className="table-row" key={order.id} style={{ gridTemplateColumns: "0.5fr 1.2fr 1.2fr 0.9fr 1fr 1.2fr" }}>
                            <span>#{order.id}</span>
                            <strong>{products.find(p => p.id === order.productId)?.metadata?.name || `Produit #${order.productId}`}</strong>
                            <span title={order.buyer}>{shortAddress(order.buyer)}</span>
                            <span>{formatEther(order.amount)} ETH</span>
                            <em className={order.disputed ? "disputed" : order.released ? "ok" : "pending"}>{statut}</em>
                            <div className="row-actions">
                              {canRelease && (
                                <button className="primary-btn" style={{ fontSize: "0.8rem", padding: "6px 12px" }} onClick={() => releaseFundsHandler(order.id)}>
                                  Libérer les fonds
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Panneau admin — litiges en attente */}
                  {adminAddress && account.toLowerCase() === adminAddress && sellerOrders.some(o => o.disputed && !o.released) && (
                    <>
                      <h2 style={{ margin: "28px 0 16px", fontWeight: 900, color: "var(--warning)" }}>
                        <i className="bi bi-shield-exclamation"></i> Litiges à résoudre
                      </h2>
                      <div>
                        {sellerOrders.filter(o => o.disputed && !o.released).map(order => {
                          const details = disputeDetails[order.id];
                          const imageUrl = details?.imageIpfsHash
                            ? `https://gateway.pinata.cloud/ipfs/${details.imageIpfsHash.replace("ipfs://", "")}`
                            : null;
                          return (
                            <div key={order.id} className="dispute-admin-card">
                              <div className="dispute-admin-header">
                                <span className="dispute-id">Commande #{order.id}</span>
                                <strong>{products.find(p => p.id === order.productId)?.metadata?.name || `Produit #${order.productId}`}</strong>
                                <span title={order.buyer}>{shortAddress(order.buyer)}</span>
                                <span className="dispute-amount">{formatEther(order.amount)} ETH</span>
                              </div>

                              {details ? (
                                <div className="dispute-evidence">
                                  <div className="dispute-reason">
                                    <i className="bi bi-exclamation-circle"></i>
                                    <strong>{details.reason}</strong>
                                  </div>
                                  {details.description && (
                                    <p className="dispute-desc">{details.description}</p>
                                  )}
                                  {imageUrl && (
                                    <img src={imageUrl} alt="Preuve" className="dispute-proof-img" />
                                  )}
                                </div>
                              ) : order.disputeIpfsHash ? (
                                <p className="dispute-loading">Chargement des preuves...</p>
                              ) : (
                                <p className="dispute-loading">Aucune preuve fournie</p>
                              )}

                              <div className="dispute-actions">
                                <button className="refund-btn" onClick={() => resolveDisputeHandler(order.id, true)}>
                                  <i className="bi bi-arrow-counterclockwise"></i>
                                  Rembourser acheteur
                                </button>
                                <button className="primary-btn" style={{ fontSize: "0.85rem" }} onClick={() => resolveDisputeHandler(order.id, false)}>
                                  <i className="bi bi-check-circle"></i>
                                  Payer vendeur
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}

          {activePage === "transactionDetails" && selectedTxDetails && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Détails transaction</span>
                  <h1>Transaction réelle</h1>
                  <p>{selectedTxHash}</p>
                </div>

                <button className="ghost-btn" onClick={() => setActivePage("transactions")}>
                  Retour
                </button>
              </div>

              <div className="details-grid">
                {Object.entries(selectedTxDetails).map(([key, value]) => (
                  <div key={key}>
                    <small>{key}</small>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
