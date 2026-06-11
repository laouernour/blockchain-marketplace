import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { parseEther, formatEther } from "ethers";
import Sidebar from "./components/Sidebar";
import RoleSelectionModal from "./components/RoleSelectionModal";
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
  assignDeliverer,
  getDelivererOrders,
  getTransactionHistory,
  getBlockchainData,
  checkIsDeliverer,
  detectUserRole,
  getStoreOfOwner,
  requestRefund,
  approveRefund,
  confirmReturn,
  blacklistAddress,
  unblacklistAddress,
  removeProduct,
  featureProduct,
  isBlacklisted,
} from "./utils/web3";
import { uploadFileToIPFS, uploadJsonToIPFS } from "./utils/ipfs";
import { ADMIN_ADDRESS } from "./config";
import { saveProductMetadata, getProductsMetadata, getNonce, verifySignature, registerAsDeliverer, removeDeliverer, getDelivererCandidates, getAIStats, getAnomalies } from "./utils/api";

const EVENT_META = {
  OrderCreated:       { label: "Achat",              icon: "bi-cart-check",            color: "#4f8cff" },
  DelivererAssigned:  { label: "Livreur assigné",    icon: "bi-person-check",           color: "#fbbf24" },
  DeliveryConfirmed:  { label: "Livraison confirmée",icon: "bi-truck",                  color: "#33d6a6" },
  FundsReleased:      { label: "Fonds libérés",      icon: "bi-check-circle",           color: "#22c55e" },
  RefundClaimed:      { label: "Remboursement",      icon: "bi-arrow-counterclockwise", color: "#fb7185" },
  DisputeOpened:      { label: "Litige ouvert",      icon: "bi-exclamation-triangle",   color: "#f97316" },
  DisputeResolved:    { label: "Litige résolu",      icon: "bi-shield-check",           color: "#a78bfa" },
  StoreCreated:       { label: "Boutique créée",     icon: "bi-shop",                   color: "#38bdf8" },
  ProductAdded:       { label: "Produit ajouté",     icon: "bi-box-seam",               color: "#818cf8" },
  Tous:               { label: "Tous",               icon: "bi-list",                   color: "#94a3b8" },
};

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
  const [adminAddress, setAdminAddress] = useState(ADMIN_ADDRESS.toLowerCase());
  const [disputeOrderId, setDisputeOrderId] = useState(null);
  const [disputeReason, setDisputeReason] = useState("Produit endommagé");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeImageFile, setDisputeImageFile] = useState(null);
  const [disputeDetails, setDisputeDetails] = useState({});
  const [delivererOrders, setDelivererOrders] = useState([]);
  const [assignInputs, setAssignInputs] = useState({});
  const [txHistory, setTxHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("Tous");
  const [chainData, setChainData] = useState(null);
  const [loadingChainData, setLoadingChainData] = useState(false);
  const [chainTab, setChainTab] = useState("overview");
  const [userRole, setUserRole] = useState("buyer"); // "buyer" | "seller" | "deliverer" | "admin"
  const isDelivererAccount = userRole === "deliverer";
  const isSellerAccount    = userRole === "seller";
  const isAdminAccount     = userRole === "admin";
  const [blacklistInput, setBlacklistInput] = useState("");
  const [allOrders, setAllOrders] = useState([]);
  const [delivererCandidates, setDelivererCandidates] = useState([]);
  const [registeredAsCandidate, setRegisteredAsCandidate] = useState(false);
  const [aiStats, setAiStats] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [anomalyData, setAnomalyData] = useState(null);
  const [loadingAnomalies, setLoadingAnomalies] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newDelivererAddress, setNewDelivererAddress] = useState("");

  const getSavedRole = (address) =>
    localStorage.getItem(`blockbay_role_${address.toLowerCase()}`);

  const saveRole = (address, role) =>
    localStorage.setItem(`blockbay_role_${address.toLowerCase()}`, role);

  const applyRole = async (role, address) => {
    setUserRole(role);
    saveRole(address, role);
    setShowRoleModal(false);
    if (role === "seller") {
      await Promise.all([loadProducts(), loadMyStore(), loadSellerOrders(address)]);
      setActivePage("dashboard");
    } else {
      await Promise.all([loadProducts(), loadOrders(address)]);
      setActivePage("marketplace");
    }
  };

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

  const loadDelivererOrders = async (address) => {
    if (!address) return;
    const data = await getDelivererOrders(address);
    setDelivererOrders(data);
  };

  const loadAllOrders = async () => {
    try {
      const data = await getBlockchainData();
      if (data) setAllOrders(data.orders || []);
    } catch { setAllOrders([]); }
  };

  const blacklistHandler = async (address) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast.error("Adresse invalide"); return;
    }
    const loading = toast.loading("Blacklist en cours...");
    const result = await blacklistAddress(address);
    toast.dismiss(loading);
    if (result.success) { toast.success("Adresse blacklistée"); setBlacklistInput(""); }
    else toast.error(result.error);
  };

  const unblacklistHandler = async (address) => {
    const loading = toast.loading("Déblocage en cours...");
    const result = await unblacklistAddress(address);
    toast.dismiss(loading);
    if (result.success) toast.success("Adresse débloquée");
    else toast.error(result.error);
  };

  const removeProductHandler = async (productId) => {
    const loading = toast.loading("Suppression du produit...");
    const result = await removeProduct(productId);
    toast.dismiss(loading);
    if (result.success) { toast.success("Produit supprimé"); await loadProducts(); }
    else toast.error(result.error);
  };

  const featureProductHandler = async (productId, featured) => {
    const result = await featureProduct(productId, featured);
    if (result.success) { toast.success(featured ? "Produit mis en avant" : "Mise en avant retirée"); await loadProducts(); }
    else toast.error(result.error);
  };

  const loadTxHistory = async () => {
    setLoadingHistory(true);
    const data = await getTransactionHistory();
    setTxHistory(data);
    setLoadingHistory(false);
  };

  const loadChainData = async () => {
    setLoadingChainData(true);
    const data = await getBlockchainData();
    setChainData(data);
    setLoadingChainData(false);
  };

  const loadAIStats = async () => {
    setLoadingAI(true);
    const result = await getAIStats();
    if (result.success) setAiStats(result.data);
    else setAiStats(null);
    setLoadingAI(false);
  };

  const loadAnomalies = async () => {
    setLoadingAnomalies(true);
    const result = await getAnomalies();
    if (result.success) setAnomalyData(result.data);
    else setAnomalyData(null);
    setLoadingAnomalies(false);
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
    await Promise.all([loadProducts(), loadOrders(a), loadMyStore(), loadDelivererOrders(a)]);
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

    // Admin : auto-détecté en priorité absolue
    if (connectedAccount.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
      setUserRole("admin");
      saveRole(connectedAccount, "admin");
      setAdminAddress(ADMIN_ADDRESS.toLowerCase());
      await Promise.all([loadProducts(), loadAllOrders()]);
      setActivePage("admin-dashboard");
      return;
    }

    // Livreur : détection automatique
    const isDeliv = await detectUserRole(connectedAccount);
    if (isDeliv === "deliverer") {
      setUserRole("deliverer");
      saveRole(connectedAccount, "deliverer");
      await loadDelivererOrders(connectedAccount);
      setActivePage("livraisons");
      return;
    }

    // Rôle sauvegardé ?
    const saved = getSavedRole(connectedAccount);
    if (saved && (saved === "buyer" || saved === "seller")) {
      await applyRole(saved, connectedAccount);
      return;
    }

    // Aucun rôle → afficher le modal de choix
    await loadProducts();
    setShowRoleModal(true);
  };

  const disconnectWallet = () => {
    setAccount("");
    setMyStoreId(0);
    setSellerOrders([]);
    setDelivererOrders([]);
    setUserRole("buyer");
    setShowRoleModal(false);
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
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            if (payload.exp * 1000 > Date.now()) {
              const addr = result.accounts[0];
              setAccount(addr);

              // 1. Admin auto-détecté (priorité absolue)
              if (addr.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
                setUserRole("admin");
                saveRole(addr, "admin");
                setAdminAddress(ADMIN_ADDRESS.toLowerCase());
                await Promise.all([loadProducts(), loadAllOrders()]);
                setActivePage("admin-dashboard");
                return;
              }

              // 2. Livreur auto-détecté
              const detectedRole = await detectUserRole(addr);
              if (detectedRole === "deliverer") {
                setUserRole("deliverer");
                saveRole(addr, "deliverer");
                await loadDelivererOrders(addr);
                setActivePage("livraisons");
                return;
              }

              // 3. Rôle sauvegardé dans localStorage
              const saved = getSavedRole(addr);
              if (saved === "seller") {
                setUserRole("seller");
                await Promise.all([loadProducts(), loadMyStore(), loadSellerOrders(addr)]);
                setActivePage("dashboard");
              } else if (saved === "buyer") {
                setUserRole("buyer");
                await Promise.all([loadProducts(), loadOrders(addr)]);
                setActivePage("marketplace");
              } else {
                // 4. Aucun rôle sauvegardé → afficher le modal
                await loadProducts();
                setShowRoleModal(true);
              }
            } else {
              localStorage.removeItem("authToken");
            }
          } catch {
            localStorage.removeItem("authToken");
          }
        }
      }

      // Produits visibles même sans connexion
      await loadProducts();
    };

    initWallet();
    getAdminAddress().then(a => { if (a) setAdminAddress(a.toLowerCase()); });
    getDelivererCandidates().then(data => setDelivererCandidates(data));
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      // Déconnexion forcée — l'utilisateur doit se reconnecter manuellement
      setAccount("");
      setMyStoreId(0);
      setSellerOrders([]);
      setOrders([]);
      setDelivererOrders([]);
      setUserRole("buyer");
      localStorage.removeItem("authToken");
      toast("Compte changé — reconnecte ton wallet", { icon: "🔄" });
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  // Quand le compte change, synchroniser le rôle depuis localStorage
  useEffect(() => {
    if (!account) return;
    detectUserRole(account).then(detected => {
      if (detected === "deliverer") {
        setUserRole("deliverer");
        saveRole(account, "deliverer");
        loadDelivererOrders(account);
        return;
      }
      const saved = getSavedRole(account);
      if (saved === "seller") {
        setUserRole("seller");
        loadSellerOrders(account);
      } else if (saved === "buyer") {
        setUserRole("buyer");
      }
    });
  }, [account]);

  // Charger l'historique quand on arrive sur la page "mon-historique"
  useEffect(() => {
    if (activePage === "mon-historique" && account && txHistory.length === 0) {
      loadTxHistory();
    }
  }, [activePage, account]);

  // Charger les anomalies automatiquement à l'entrée sur la page
  useEffect(() => {
    if (activePage === "anomalies" && userRole === "admin") {
      loadAnomalies();
    }
  }, [activePage]);

  // Garde : rediriger vers la bonne page selon le rôle
  useEffect(() => {
    if (!account) return;
    if (userRole === "admin" && activePage !== "admin-dashboard" && activePage !== "ia" && activePage !== "blockchain" && activePage !== "historique" && activePage !== "anomalies") setActivePage("admin-dashboard");
    if (userRole === "deliverer" && activePage !== "livraisons" && activePage !== "mon-historique") setActivePage("livraisons");
    if (userRole === "seller" && (activePage === "marketplace" || activePage === "transactions" || activePage === "ia" || activePage === "historique" || activePage === "blockchain")) setActivePage("dashboard");
    if (userRole === "buyer" && (activePage === "dashboard" || activePage === "vendre" || activePage === "livraisons")) setActivePage("marketplace");
  }, [userRole, activePage, account]);

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

    // Vérification on-chain : les livreurs ne peuvent pas créer de boutique
    if (userRole === "deliverer") {
      setActivePage("livraisons");
      toast.error("Compte livreur — création de boutique interdite");
      return;
    }

    if (!storeName.trim()) {
      toast.error("Nom de boutique obligatoire");
      return;
    }

    // Upload des métadonnées boutique sur IPFS (optionnel — continue si réseau indisponible)
    const ipfsToast = toast.loading("Upload métadonnées boutique sur IPFS...");
    const ipfsResult = await uploadJsonToIPFS({
      name: storeName.trim(),
      description: storeDescription.trim() || "",
      owner: account,
      createdAt: new Date().toISOString(),
    });
    toast.dismiss(ipfsToast);

    const ipfsHash = ipfsResult.success ? ipfsResult.ipfsHash : "";
    if (!ipfsResult.success) {
      toast("IPFS indisponible — boutique créée sans métadonnées IPFS", { icon: "⚠️" });
    }

    const loading = toast.loading("Création boutique sur la blockchain...");
    const result = await createStore(storeName.trim(), ipfsHash);
    toast.dismiss(loading);

    if (result.success) {
      toast.success("Boutique créée !");
      setStoreName("");
      setStoreDescription("");
      await loadMyStore();
      setUserRole("seller");
      setActivePage("dashboard");
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

    if (userRole === "deliverer") {
      setActivePage("livraisons");
      toast.error("Compte livreur — ajout de produit interdit");
      return;
    }
    if (userRole === "buyer") {
      toast.error("Crée une boutique d'abord pour vendre");
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

  const requestRefundHandler = async (orderId) => {
    const loading = toast.loading("Demande de retour en cours...");
    const result = await requestRefund(orderId);
    toast.dismiss(loading);
    if (result.success) {
      toast.success("Demande de retour envoyée au vendeur");
      await loadOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const approveRefundHandler = async (orderId) => {
    const loading = toast.loading("Approbation du retour...");
    const result = await approveRefund(orderId);
    toast.dismiss(loading);
    if (result.success) {
      toast.success("Retour approuvé — le livreur doit confirmer la récupération");
      await loadSellerOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const confirmReturnHandler = async (orderId) => {
    const loading = toast.loading("Confirmation du retour...");
    const result = await confirmReturn(orderId);
    toast.dismiss(loading);
    if (result.success) {
      toast.success("Retour confirmé — acheteur remboursé");
      await loadDelivererOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const confirmDeliveryHandler = async (orderId) => {
    const loading = toast.loading("Confirmation livraison...");
    const result = await confirmDelivery(orderId);
    toast.dismiss(loading);

    if (result.success) {
      toast.success("Livraison confirmée ✓ — l'acheteur a 48h pour ouvrir un litige");
      await loadDelivererOrders(account);
      if (!isDelivererAccount) await loadSellerOrders(account);
    } else {
      toast.error(result.error);
    }
  };

  const registerAsDelivererHandler = async () => {
    if (!account) { toast.error("Connecte ton wallet d'abord"); return; }
    const result = await registerAsDeliverer(account);
    if (result.success) {
      toast.success("Inscrit comme livreur !");
      setUserRole("deliverer");
      setActivePage("livraisons");
      await loadDelivererOrders(account);
    } else {
      toast.error("Erreur : " + result.error);
    }
  };

  const assignDelivererHandler = async (orderId) => {
    const delivererAddress = (assignInputs[orderId] || "").trim();
    if (!delivererAddress) {
      toast.error("Entre une adresse de livreur");
      return;
    }
    const loading = toast.loading("Assignation du livreur...");
    const result = await assignDeliverer(orderId, delivererAddress);
    toast.dismiss(loading);
    if (result.success) {
      toast.success("Livreur assigné avec succès");
      setAssignInputs(prev => { const n = { ...prev }; delete n[orderId]; return n; });
      await loadSellerOrders(account);
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
      {showRoleModal && (
        <RoleSelectionModal
          account={account}
          onSelect={(role) => applyRole(role, account)}
        />
      )}
      <Sidebar
        activePage={activePage}
        setActivePage={navigateTo}
        productsCount={products.length}
        ordersCount={orders.length}
        delivererOrdersCount={delivererOrders.filter(o => !o.delivered).length}
        userRole={userRole}
        account={account}
        adminAddress={adminAddress}
        onRegisterDeliverer={registerAsDelivererHandler}
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

          {activePage === "marketplace" && userRole === "buyer" && (
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
                      isDelivererAccount={isDelivererAccount}
                      onPurchaseSuccess={refreshAll}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "vendre" && userRole === "seller" && (
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

          {activePage === "transactions" && userRole === "buyer" && (
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
                      else if (order.released) statut = "Remboursé ✓";
                      else if (order.refundApproved) statut = "Retour approuvé";
                      else if (order.refundRequested) statut = "Retour demandé";
                      else if (order.delivered) statut = `Livré · ${hoursLeft}h restantes`;

                      let statutClass = "pending";
                      if (order.disputeResolved && order.buyerWon) statutClass = "refunded";
                      else if (order.disputeResolved && !order.buyerWon) statutClass = "rejected";
                      else if (order.disputed) statutClass = "disputed";
                      else if (order.released) statutClass = "refunded";
                      else if (order.refundApproved) statutClass = "delivered";
                      else if (order.refundRequested) statutClass = "pending";
                      else if (order.delivered) statutClass = "delivered";

                      return (
                        <div className="table-row" key={order.id} style={{ gridTemplateColumns: "0.6fr 1.2fr 1fr 1fr 2fr" }}>
                          <span>#{order.id}</span>
                          <strong>{products.find(p => p.id === order.productId)?.metadata?.name || `Produit #${order.productId}`}</strong>
                          <span>{formatEther(order.amount)} ETH</span>
                          <em className={statutClass}>{statut}</em>
                          <div className="row-actions">
                            {inWindow && !disputeOrderId && (
                              <button className="dispute-btn" onClick={() => setDisputeOrderId(order.id)}>
                                <i className="bi bi-exclamation-triangle"></i>
                                Ouvrir un litige
                              </button>
                            )}
                            {!order.released && !order.disputed && !order.refundRequested && (
                              <button className="refund-btn" onClick={() => requestRefundHandler(order.id)}>
                                <i className="bi bi-arrow-return-left"></i>
                                Demander retour
                              </button>
                            )}
                            {!order.delivered && !order.released && !order.refundRequested && (
                              <button className="ghost-btn" style={{fontSize:"0.78rem"}} onClick={() => claimRefundHandler(order.id)} title="Remboursement auto après 7 jours sans livraison">
                                Remb. auto (7j)
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

          {activePage === "seller-analytics" && userRole === "seller" && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Mes analytiques</span>
                  <h1>Performance de mes produits</h1>
                </div>
                <button className="primary-btn" onClick={() => loadSellerOrders(account)}>
                  <i className="bi bi-arrow-clockwise"></i> Actualiser
                </button>
              </div>

              {/* KPIs */}
              <div className="metrics-grid">
                <div>
                  <span>Revenus totaux</span>
                  <strong>
                    {sellerOrders.filter(o => o.released && !(o.disputeResolved && o.buyerWon))
                      .reduce((s, o) => s + Number(formatEther(o.amount)), 0).toFixed(4)} ETH
                  </strong>
                </div>
                <div>
                  <span>Revenus en attente</span>
                  <strong>
                    {sellerOrders.filter(o => !o.released && !o.disputed)
                      .reduce((s, o) => s + Number(formatEther(o.amount)), 0).toFixed(4)} ETH
                  </strong>
                </div>
                <div>
                  <span>Panier moyen</span>
                  <strong>
                    {sellerOrders.length > 0
                      ? (sellerOrders.reduce((s, o) => s + Number(formatEther(o.amount)), 0) / sellerOrders.length).toFixed(4)
                      : "0.0000"} ETH
                  </strong>
                </div>
                <div>
                  <span>Taux de litige</span>
                  <strong>
                    {sellerOrders.length > 0
                      ? ((sellerOrders.filter(o => o.disputed).length / sellerOrders.length) * 100).toFixed(1)
                      : "0.0"}%
                  </strong>
                </div>
              </div>

              {/* KPIs avancés */}
              {(() => {
                const finalized = sellerOrders.filter(o => o.delivered || o.disputed);
                const refunded  = sellerOrders.filter(o => o.disputeResolved && o.buyerWon);
                const cancelled = sellerOrders.filter(o => o.refundApproved);
                const buyerCounts = sellerOrders.reduce((acc, o) => { acc[o.buyer] = (acc[o.buyer] || 0) + 1; return acc; }, {});
                const recurringBuyers = Object.values(buyerCounts).filter(c => c > 1).length;
                const totalBuyers     = Object.keys(buyerCounts).length;
                const tauxRecurrents  = totalBuyers > 0 ? (recurringBuyers / totalBuyers * 100).toFixed(1) : "0.0";
                const tauxRemboursement = finalized.length > 0 ? (refunded.length / finalized.length * 100).toFixed(1) : "0.0";
                const tauxAnnulation    = sellerOrders.length > 0 ? (cancelled.length / sellerOrders.length * 100).toFixed(1) : "0.0";
                const deliveredWithTs   = sellerOrders.filter(o => o.delivered && o.createdAt > 0 && o.deliveryTimestamp > 0);
                const avgDelayDays      = deliveredWithTs.length > 0
                  ? (deliveredWithTs.reduce((s, o) => s + (o.deliveryTimestamp - o.createdAt), 0) / deliveredWithTs.length / 86400).toFixed(1)
                  : null;
                const uniqueBuyers = Object.keys(buyerCounts);
                const clv = uniqueBuyers.length > 0
                  ? (sellerOrders.filter(o => o.released && !(o.disputeResolved && o.buyerWon))
                      .reduce((s, o) => s + Number(formatEther(o.amount)), 0) / uniqueBuyers.length).toFixed(4)
                  : "0.0000";
                return (
                  <>
                    <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>Indicateurs avancés</h2>
                    <div className="metrics-grid">
                      <div><span>Clients récurrents</span><strong>{tauxRecurrents}%</strong></div>
                      <div><span>Taux remboursement</span><strong>{tauxRemboursement}%</strong></div>
                      <div><span>Taux annulation</span><strong>{tauxAnnulation}%</strong></div>
                      <div><span>CLV moyen</span><strong>{clv} ETH</strong></div>
                      {avgDelayDays !== null && (
                        <div><span>Délai livraison moy.</span><strong>{avgDelayDays} j</strong></div>
                      )}
                      <div><span>Acheteurs uniques</span><strong>{totalBuyers}</strong></div>
                    </div>
                  </>
                );
              })()}

              {/* Performance par produit */}
              <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>Performance par produit</h2>
              {products.filter(p => p.seller?.toLowerCase() === account?.toLowerCase()).length === 0 ? (
                <div className="empty-state"><i className="bi bi-box"></i><h3>Aucun produit publié</h3></div>
              ) : (
                <div className="table-panel">
                  <div className="table-head" style={{ gridTemplateColumns: "0.5fr 1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr" }}>
                    <span>ID</span>
                    <span>Produit</span>
                    <span>Prix</span>
                    <span>Stock</span>
                    <span>Ventes</span>
                    <span>Revenus</span>
                    <span>Rotation</span>
                    <span>Note moy.</span>
                  </div>
                  {products.filter(p => p.seller?.toLowerCase() === account?.toLowerCase()).map(p => {
                    const productOrders = sellerOrders.filter(o => o.productId === p.id);
                    const revenue = productOrders.filter(o => o.released && !(o.disputeResolved && o.buyerWon))
                      .reduce((s, o) => s + Number(formatEther(o.amount)), 0);
                    const stockStatus = p.stock === 0 ? "refunded" : p.stock < 3 ? "pending" : "ok";
                    const stockInitial = productOrders.length + p.stock;
                    const rotation = stockInitial > 0 ? ((productOrders.length / stockInitial) * 100).toFixed(0) + "%" : "—";
                    return (
                      <div className="table-row" key={p.id} style={{ gridTemplateColumns: "0.5fr 1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr" }}>
                        <span>#{p.id}</span>
                        <strong>{p.metadata?.name || `Produit #${p.id}`}</strong>
                        <span>{p.price} ETH</span>
                        <em className={stockStatus}>{p.stock === 0 ? "Rupture" : p.stock < 3 ? `${p.stock} ⚠️` : p.stock}</em>
                        <span>{productOrders.length}</span>
                        <span>{revenue.toFixed(4)} ETH</span>
                        <span>{rotation}</span>
                        <span>{p.averageRating > 0 ? `★ ${p.averageRating}/5` : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alertes stock */}
              {products.filter(p => p.seller?.toLowerCase() === account?.toLowerCase() && p.stock === 0).length > 0 && (
                <>
                  <h2 style={{ margin: "28px 0 16px", fontWeight: 900, color: "#ef4444" }}>
                    <i className="bi bi-exclamation-triangle"></i> Produits en rupture
                  </h2>
                  {products.filter(p => p.seller?.toLowerCase() === account?.toLowerCase() && p.stock === 0).map(p => (
                    <div key={p.id} className="incomplete-banner">
                      <i className="bi bi-box-seam"></i>
                      <div>
                        <strong>{p.metadata?.name || `Produit #${p.id}`}</strong>
                        <p>Stock épuisé — pensez à réapprovisionner</p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Répartition commandes */}
              <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>Répartition des commandes</h2>
              <div className="metrics-grid">
                <div><span>En attente livreur</span><strong>{sellerOrders.filter(o => !o.delivered && !o.released && o.deliverer === "0x0000000000000000000000000000000000000000").length}</strong></div>
                <div><span>En cours livraison</span><strong>{sellerOrders.filter(o => !o.delivered && o.deliverer !== "0x0000000000000000000000000000000000000000").length}</strong></div>
                <div><span>Livrées</span><strong>{sellerOrders.filter(o => o.delivered).length}</strong></div>
                <div><span>En litige</span><strong>{sellerOrders.filter(o => o.disputed).length}</strong></div>
              </div>
            </section>
          )}

          {activePage === "dashboard" && userRole === "seller" && (
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
                          .filter((o) => o.released && o.delivered && !(o.disputeResolved && o.buyerWon))
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
                            isDelivererAccount={isDelivererAccount}
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
                      <div className="table-head" style={{ gridTemplateColumns: "0.5fr 1.2fr 1fr 0.8fr 0.9fr 2fr" }}>
                        <span>ID</span>
                        <span>Produit</span>
                        <span>Acheteur</span>
                        <span>Montant</span>
                        <span>Statut</span>
                        <span>Livreur / Action</span>
                      </div>
                      {sellerOrders.map((order) => {
                        const now = Math.floor(Date.now() / 1000);
                        const canRelease = order.delivered && !order.released && !order.disputed
                          && now >= order.deliveryTimestamp + 48 * 3600;
                        let statut = "En attente";
                        if (order.disputed && order.disputeResolved && order.buyerWon) statut = "Remboursé";
                        else if (order.disputed && order.disputeResolved && !order.buyerWon) statut = "Payé";
                        else if (order.disputed) statut = "En litige";
                        else if (order.released && !order.delivered) statut = "Remboursé";
                        else if (order.released) statut = "Payé";
                        else if (order.refundApproved) statut = "Retour approuvé";
                        else if (order.refundRequested) statut = "Retour demandé";
                        else if (order.delivered) statut = "Livré";
                        const hasDeliverer = order.deliverer && order.deliverer !== "0x0000000000000000000000000000000000000000";
                        return (
                          <div className="table-row" key={order.id} style={{ gridTemplateColumns: "0.5fr 1.2fr 1fr 0.8fr 0.9fr 2fr" }}>
                            <span>#{order.id}</span>
                            <strong>{products.find(p => p.id === order.productId)?.metadata?.name || `Produit #${order.productId}`}</strong>
                            <span title={order.buyer}>{shortAddress(order.buyer)}</span>
                            <span>{formatEther(order.amount)} ETH</span>
                            <em className={
                              order.released && !order.delivered ? "refunded" :
                              order.disputeResolved && order.buyerWon ? "refunded" :
                              order.disputed ? "disputed" :
                              order.released ? "ok" : "pending"
                            }>{statut}</em>
                            <div className="row-actions">
                              {canRelease && (
                                <button className="primary-btn" style={{ fontSize: "0.8rem", padding: "6px 12px" }} onClick={() => releaseFundsHandler(order.id)}>
                                  Libérer les fonds
                                </button>
                              )}
                              {order.refundRequested && !order.refundApproved && !order.released && (
                                <button className="refund-btn" style={{ fontSize: "0.8rem", padding: "6px 12px" }} onClick={() => approveRefundHandler(order.id)}>
                                  <i className="bi bi-arrow-return-left"></i>
                                  Approuver retour
                                </button>
                              )}
                              {!order.delivered && !order.released && !order.refundRequested && (
                                hasDeliverer ? (
                                  <span className="deliverer-assigned" title={order.deliverer}>
                                    <i className="bi bi-truck"></i> {shortAddress(order.deliverer)}
                                  </span>
                                ) : (
                                  <div className="assign-deliverer-row">
                                    {delivererCandidates.length > 0 ? (
                                      <select
                                        value={assignInputs[order.id] || ""}
                                        onChange={e => setAssignInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                      >
                                        <option value="">-- Choisir un livreur --</option>
                                        {delivererCandidates.map(d => (
                                          <option key={d.address} value={d.address}>{shortAddress(d.address)} — {d.address}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        placeholder="Adresse du livreur (0x...)"
                                        value={assignInputs[order.id] || ""}
                                        onChange={e => setAssignInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                                      />
                                    )}
                                    <button className="ghost-btn" style={{ fontSize: "0.78rem", padding: "5px 10px" }} onClick={() => assignDelivererHandler(order.id)}>
                                      <i className="bi bi-person-check"></i> Assigner
                                    </button>
                                  </div>
                                )
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

          {activePage === "admin-dashboard" && isAdminAccount && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Administration</span>
                  <h1>Dashboard Admin</h1>
                </div>
                <button className="primary-btn" onClick={() => Promise.all([loadProducts(), loadAllOrders(), getDelivererCandidates().then(d => setDelivererCandidates(d))])}>
                  <i className="bi bi-arrow-clockwise"></i> Actualiser
                </button>
              </div>

              {/* KPIs plateforme */}
              <div className="metrics-grid">
                <div><span>Total produits</span><strong>{products.length}</strong></div>
                <div><span>Total commandes</span><strong>{allOrders.length}</strong></div>
                <div><span>Litiges en cours</span><strong>{allOrders.filter(o => o.disputed && !o.released).length}</strong></div>
                <div><span>Volume total</span><strong>{allOrders.reduce((s, o) => s + Number(o.amount || 0), 0).toFixed(4)} ETH</strong></div>
              </div>

              {/* Litiges à résoudre */}
              <h2 style={{ margin: "28px 0 16px", fontWeight: 900, color: "var(--warning)" }}>
                <i className="bi bi-shield-exclamation"></i> Litiges à résoudre
              </h2>
              {allOrders.filter(o => o.disputed && !o.released).length === 0 ? (
                <div className="empty-state"><i className="bi bi-check-circle"></i><h3>Aucun litige en attente</h3></div>
              ) : (
                allOrders.filter(o => o.disputed && !o.released).map(order => (
                  <div key={order.id} className="dispute-admin-card">
                    <div className="dispute-admin-header">
                      <span className="dispute-id">Commande #{order.id}</span>
                      <span title={order.buyer}>{shortAddress(order.buyer)}</span>
                      <span className="dispute-amount">{Number(order.amount).toFixed(4)} ETH</span>
                    </div>
                    <div className="dispute-actions">
                      <button className="refund-btn" onClick={() => resolveDisputeHandler(order.id, true)}>
                        <i className="bi bi-arrow-counterclockwise"></i> Rembourser acheteur
                      </button>
                      <button className="primary-btn" style={{ fontSize: "0.85rem" }} onClick={() => resolveDisputeHandler(order.id, false)}>
                        <i className="bi bi-check-circle"></i> Payer vendeur
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Gestion produits */}
              <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>
                <i className="bi bi-box-seam"></i> Gestion des produits
              </h2>
              <div className="table-panel">
                <div className="table-head" style={{ gridTemplateColumns: "0.5fr 1.5fr 1fr 1fr 1.5fr" }}>
                  <span>ID</span><span>Nom</span><span>Prix</span><span>Stock</span><span>Actions</span>
                </div>
                {products.map(p => (
                  <div className="table-row" key={p.id} style={{ gridTemplateColumns: "0.5fr 1.5fr 1fr 1fr 1.5fr" }}>
                    <span>#{p.id}</span>
                    <strong>{p.metadata?.name || `Produit #${p.id}`}</strong>
                    <span>{p.price} ETH</span>
                    <span>{p.stock}</span>
                    <div className="row-actions">
                      <button className="ghost-btn" style={{ fontSize: "0.78rem" }} onClick={() => featureProductHandler(p.id, true)}>
                        <i className="bi bi-star"></i> Mettre en avant
                      </button>
                      <button className="refund-btn" style={{ fontSize: "0.78rem" }} onClick={() => removeProductHandler(p.id)}>
                        <i className="bi bi-trash"></i> Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Blacklist */}
              <h2 style={{ margin: "28px 0 16px", fontWeight: 900, color: "#ef4444" }}>
                <i className="bi bi-ban"></i> Blacklist adresse
              </h2>
              <div className="form-panel" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Adresse Ethereum (0x...)"
                  value={blacklistInput}
                  onChange={e => setBlacklistInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="refund-btn" onClick={() => blacklistHandler(blacklistInput)}>
                  <i className="bi bi-ban"></i> Blacklister
                </button>
                <button className="ghost-btn" onClick={() => unblacklistHandler(blacklistInput)}>
                  <i className="bi bi-check-circle"></i> Débloquer
                </button>
              </div>

              {/* Gestion livreurs */}
              <h2 style={{ margin: "28px 0 16px", fontWeight: 900 }}>
                <i className="bi bi-truck"></i> Gestion des livreurs
              </h2>
              {delivererCandidates.length === 0 ? (
                <div className="empty-state"><i className="bi bi-person-x"></i><h3>Aucun livreur inscrit</h3></div>
              ) : (
                <div className="table-panel">
                  <div className="table-head" style={{ gridTemplateColumns: "2fr 1fr" }}>
                    <span>Adresse</span><span>Action</span>
                  </div>
                  {delivererCandidates.map(d => (
                    <div className="table-row" key={d.address} style={{ gridTemplateColumns: "2fr 1fr" }}>
                      <code style={{ fontSize: "0.8rem" }}>{d.address}</code>
                      <button className="refund-btn" style={{ fontSize: "0.78rem" }} onClick={async () => {
                        await removeDeliverer(d.address);
                        getDelivererCandidates().then(data => setDelivererCandidates(data));
                        toast.success("Livreur supprimé");
                      }}>
                        <i className="bi bi-trash"></i> Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "livraisons" && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Livreur</span>
                  <h1>Mes livraisons</h1>
                  <p>Commandes qui vous ont été assignées à livrer. Confirmez sur la blockchain quand vous avez livré.</p>
                </div>
                {account && (
                  <button className="primary-btn" onClick={() => loadDelivererOrders(account)}>
                    <i className="bi bi-arrow-clockwise"></i>
                    Actualiser
                  </button>
                )}
              </div>

              {account && (
                <div className="deliverer-address-box">
                  <span className="deliverer-address-label">
                    <i className="bi bi-wallet2"></i> Mon adresse (à donner au vendeur) :
                  </span>
                  <code className="deliverer-address-value">{account}</code>
                  <button className="ghost-btn" onClick={() => { navigator.clipboard.writeText(account); toast.success("Adresse copiée !"); }}>
                    <i className="bi bi-clipboard"></i> Copier
                  </button>
                </div>
              )}

              {account && !isDelivererAccount && (
                <div className="deliverer-register-banner">
                  <i className="bi bi-truck"></i>
                  <div>
                    <strong>Devenir livreur disponible</strong>
                    <p>Inscris-toi pour apparaître dans la liste des livreurs disponibles. Les vendeurs pourront te sélectionner directement.</p>
                  </div>
                  {registeredAsCandidate ? (
                    <span className="registered-badge"><i className="bi bi-check-circle"></i> Inscrit</span>
                  ) : (
                    <button className="primary-btn" onClick={async () => {
                      const result = await registerAsDeliverer(account);
                      if (result.success) {
                        setRegisteredAsCandidate(true);
                        toast.success("Inscrit comme livreur disponible !");
                        const updated = await getDelivererCandidates();
                        setDelivererCandidates(updated);
                      } else {
                        toast.error("Erreur inscription : " + (result.error || "inconnue"));
                      }
                    }}>
                      <i className="bi bi-person-plus"></i>
                      S'inscrire comme livreur
                    </button>
                  )}
                </div>
              )}

              {!account ? (
                <div className="empty-state">
                  <i className="bi bi-wallet2"></i>
                  <h3>Connecte ton wallet</h3>
                  <p>Tes livraisons s'affichent uniquement quand tu es connecté.</p>
                </div>
              ) : delivererOrders.length === 0 ? (
                <div className="empty-state">
                  <i className="bi bi-truck"></i>
                  <h3>Aucune livraison assignée</h3>
                  <p>Un vendeur doit t'assigner comme livreur pour une commande.</p>
                </div>
              ) : (
                <div className="table-panel">
                  <div className="table-head" style={{ gridTemplateColumns: "0.6fr 1.4fr 1.2fr 1fr 1fr 1.2fr" }}>
                    <span>ID</span>
                    <span>Produit</span>
                    <span>Acheteur</span>
                    <span>Montant</span>
                    <span>Statut</span>
                    <span>Action</span>
                  </div>
                  {delivererOrders.map((order) => {
                    let statut = "À livrer";
                    let statutClass = "pending";
                    if (order.released) { statut = "Terminé"; statutClass = "ok"; }
                    else if (order.disputed) { statut = "En litige"; statutClass = "disputed"; }
                    else if (order.refundApproved) { statut = "Retour à récupérer"; statutClass = "pending"; }
                    else if (order.delivered) { statut = "Livré ✓"; statutClass = "delivered"; }
                    return (
                      <div className="table-row" key={order.id} style={{ gridTemplateColumns: "0.6fr 1.4fr 1.2fr 1fr 1fr 1.4fr" }}>
                        <span>#{order.id}</span>
                        <strong>{products.find(p => p.id === order.productId)?.metadata?.name || `Produit #${order.productId}`}</strong>
                        <span title={order.buyer}>{shortAddress(order.buyer)}</span>
                        <span>{formatEther(order.amount)} ETH</span>
                        <em className={statutClass}>{statut}</em>
                        <div className="row-actions">
                          {!order.delivered && !order.released && !order.refundApproved && (
                            <button className="primary-btn" style={{ fontSize: "0.82rem", padding: "6px 14px" }} onClick={() => confirmDeliveryHandler(order.id)}>
                              <i className="bi bi-check2-circle"></i>
                              Confirmer livraison
                            </button>
                          )}
                          {order.refundApproved && !order.released && (
                            <button className="refund-btn" style={{ fontSize: "0.82rem", padding: "6px 14px" }} onClick={() => confirmReturnHandler(order.id)}>
                              <i className="bi bi-arrow-return-left"></i>
                              Confirmer retour
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activePage === "blockchain" && (userRole === "seller" || userRole === "admin") && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Smart Contract</span>
                  <h1>Données Blockchain</h1>
                  <p>Toutes les données écrites dans le smart contract Ethereum — source de vérité immuable.</p>
                </div>
                <button className="primary-btn" onClick={loadChainData} disabled={loadingChainData}>
                  <i className={`bi bi-arrow-clockwise${loadingChainData ? " spin" : ""}`}></i>
                  {loadingChainData ? "Lecture..." : "Lire la blockchain"}
                </button>
              </div>

              {!chainData && !loadingChainData && (
                <div className="empty-state">
                  <i className="bi bi-database"></i>
                  <h3>Données non chargées</h3>
                  <p>Clique sur "Lire la blockchain" pour afficher toutes les données du smart contract.</p>
                </div>
              )}

              {loadingChainData && (
                <div className="empty-state">
                  <div className="loader"></div>
                  <h3>Lecture du smart contract...</h3>
                  <p>Récupération de toutes les données on-chain.</p>
                </div>
              )}

              {chainData && !loadingChainData && (
                <>
                  {/* Infos contrat */}
                  <div className="chain-contract-info">
                    <div>
                      <small>Adresse du contrat</small>
                      <code>{chainData.contractAddress}</code>
                    </div>
                    <div>
                      <small>Administrateur</small>
                      <code>{chainData.admin}</code>
                    </div>
                  </div>

                  {/* Compteurs */}
                  <div className="chain-stats">
                    <div className="chain-stat">
                      <i className="bi bi-shop" style={{ color: "#38bdf8" }}></i>
                      <strong>{chainData.counts.stores}</strong>
                      <span>Boutiques</span>
                    </div>
                    <div className="chain-stat">
                      <i className="bi bi-box-seam" style={{ color: "#818cf8" }}></i>
                      <strong>{chainData.counts.products}</strong>
                      <span>Produits</span>
                    </div>
                    <div className="chain-stat">
                      <i className="bi bi-receipt" style={{ color: "#4f8cff" }}></i>
                      <strong>{chainData.counts.orders}</strong>
                      <span>Commandes</span>
                    </div>
                    <div className="chain-stat">
                      <i className="bi bi-star-fill" style={{ color: "#fbbf24" }}></i>
                      <strong>{chainData.counts.reviews}</strong>
                      <span>Avis</span>
                    </div>
                  </div>

                  {/* Onglets */}
                  <div className="chain-tabs">
                    {[
                      { id: "overview", label: "Vue d'ensemble" },
                      { id: "stores",   label: `Boutiques (${chainData.counts.stores})` },
                      { id: "products", label: `Produits (${chainData.counts.products})` },
                      { id: "orders",   label: `Commandes (${chainData.counts.orders})` },
                      { id: "reviews",  label: `Avis (${chainData.counts.reviews})` },
                    ].map(t => (
                      <button key={t.id} className={`chain-tab${chainTab === t.id ? " active" : ""}`} onClick={() => setChainTab(t.id)}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Vue d'ensemble */}
                  {chainTab === "overview" && (
                    <div className="chain-overview">
                      <div className="chain-overview-block">
                        <h3><i className="bi bi-shop"></i> Boutiques</h3>
                        {chainData.stores.map(s => (
                          <div key={s.id} className="chain-row">
                            <span className="chain-id">Store #{s.id}</span>
                            <span className="chain-name">{s.name}</span>
                            <code className="chain-addr">{s.owner}</code>
                            <span className="chain-ipfs" title={s.ipfsHash}>{s.ipfsHash ? s.ipfsHash.slice(0,20)+"…" : "—"}</span>
                          </div>
                        ))}
                      </div>
                      <div className="chain-overview-block">
                        <h3><i className="bi bi-box-seam"></i> Produits</h3>
                        {chainData.products.map(p => (
                          <div key={p.id} className="chain-row">
                            <span className="chain-id">Prod #{p.id}</span>
                            <span className="chain-price">{p.price} ETH</span>
                            <span className="chain-stock">Stock: {p.stock}</span>
                            <code className="chain-addr">{p.seller}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Boutiques */}
                  {chainTab === "stores" && (
                    <div className="chain-table">
                      <div className="chain-thead" style={{ gridTemplateColumns: "0.5fr 1.5fr 2.5fr 2fr" }}>
                        <span>ID</span><span>Nom</span><span>Propriétaire</span><span>IPFS Hash</span>
                      </div>
                      {chainData.stores.map(s => (
                        <div key={s.id} className="chain-trow" style={{ gridTemplateColumns: "0.5fr 1.5fr 2.5fr 2fr" }}>
                          <span className="chain-id">#{s.id}</span>
                          <strong>{s.name}</strong>
                          <code>{s.owner}</code>
                          <a href={`https://gateway.pinata.cloud/ipfs/${s.ipfsHash}`} target="_blank" rel="noreferrer" className="chain-ipfs-link">{s.ipfsHash ? s.ipfsHash.slice(0,24)+"…" : "—"}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Produits */}
                  {chainTab === "products" && (
                    <div className="chain-table">
                      <div className="chain-thead" style={{ gridTemplateColumns: "0.5fr 0.6fr 1fr 0.7fr 2.5fr 1.8fr" }}>
                        <span>ID</span><span>Store</span><span>Prix</span><span>Stock</span><span>Vendeur</span><span>IPFS Hash</span>
                      </div>
                      {chainData.products.map(p => (
                        <div key={p.id} className="chain-trow" style={{ gridTemplateColumns: "0.5fr 0.6fr 1fr 0.7fr 2.5fr 1.8fr" }}>
                          <span className="chain-id">#{p.id}</span>
                          <span>#{p.storeId}</span>
                          <strong>{p.price} ETH</strong>
                          <span>{p.stock}</span>
                          <code>{p.seller}</code>
                          <a href={`https://gateway.pinata.cloud/ipfs/${p.ipfsHash}`} target="_blank" rel="noreferrer" className="chain-ipfs-link">{p.ipfsHash ? p.ipfsHash.slice(0,20)+"…" : "—"}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Commandes */}
                  {chainTab === "orders" && (
                    <div className="chain-table">
                      <div className="chain-thead" style={{ gridTemplateColumns: "0.4fr 0.5fr 0.8fr 2fr 2fr 1.6fr 1.8fr" }}>
                        <span>ID</span><span>Prod</span><span>Montant</span><span>Acheteur</span><span>Livreur</span><span>Statut</span><span>Dispute IPFS</span>
                      </div>
                      {chainData.orders.map(o => {
                        let statut = "En attente";
                        let sClass = "pending";
                        if (o.disputeResolved && o.buyerWon) { statut = "Remboursé"; sClass = "refunded"; }
                        else if (o.disputeResolved) { statut = "Litige → Vendeur"; sClass = "ok"; }
                        else if (o.disputed) { statut = "En litige"; sClass = "disputed"; }
                        else if (o.released && !o.delivered) { statut = "Remboursé"; sClass = "refunded"; }
                        else if (o.released) { statut = "Payé"; sClass = "ok"; }
                        else if (o.delivered) { statut = "Livré"; sClass = "delivered"; }
                        const noAddr = "0x0000000000000000000000000000000000000000";
                        return (
                          <div key={o.id} className="chain-trow" style={{ gridTemplateColumns: "0.4fr 0.5fr 0.8fr 2fr 2fr 1.6fr 1.8fr" }}>
                            <span className="chain-id">#{o.id}</span>
                            <span>#{o.productId}</span>
                            <strong>{o.amount} ETH</strong>
                            <code>{o.buyer}</code>
                            <code>{o.deliverer === noAddr ? <em style={{ color: "var(--muted)" }}>Non assigné</em> : o.deliverer}</code>
                            <em className={sClass}>{statut}</em>
                            <span>{o.disputeIpfsHash ? <a href={`https://gateway.pinata.cloud/ipfs/${o.disputeIpfsHash}`} target="_blank" rel="noreferrer" className="chain-ipfs-link">{o.disputeIpfsHash.slice(0,16)}…</a> : "—"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Avis */}
                  {chainTab === "reviews" && (
                    chainData.reviews.length === 0 ? (
                      <div className="empty-state">
                        <i className="bi bi-star"></i>
                        <h3>Aucun avis enregistré</h3>
                      </div>
                    ) : (
                      <div className="chain-table">
                        <div className="chain-thead" style={{ gridTemplateColumns: "0.5fr 0.7fr 0.7fr 0.7fr 2.5fr 2fr" }}>
                          <span>ID</span><span>Produit</span><span>Commande</span><span>Note</span><span>Auteur</span><span>IPFS Hash</span>
                        </div>
                        {chainData.reviews.map((r, i) => (
                          <div key={i} className="chain-trow" style={{ gridTemplateColumns: "0.5fr 0.7fr 0.7fr 0.7fr 2.5fr 2fr" }}>
                            <span className="chain-id">#{r.id}</span>
                            <span>Prod #{r.productId}</span>
                            <span>Cmd #{r.orderId}</span>
                            <strong style={{ color: "#fbbf24" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</strong>
                            <code>{r.reviewer}</code>
                            <a href={`https://gateway.pinata.cloud/ipfs/${r.ipfsHash}`} target="_blank" rel="noreferrer" className="chain-ipfs-link">{r.ipfsHash ? r.ipfsHash.slice(0,20)+"…" : "—"}</a>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </section>
          )}

          {activePage === "mon-historique" && account && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Mon compte</span>
                  <h1>Mes transactions</h1>
                  <p>Toutes les opérations blockchain liées à ton adresse, avec date et heure.</p>
                </div>
                <button className="primary-btn" onClick={loadTxHistory}>
                  <i className="bi bi-arrow-clockwise"></i>
                  Actualiser
                </button>
              </div>

              {loadingHistory ? (
                <div className="empty-state"><div className="loader"></div><h3>Chargement...</h3></div>
              ) : (() => {
                const myTx = txHistory.filter(e => {
                  const addr = account.toLowerCase();
                  return Object.values(e.args || {}).some(v =>
                    typeof v === "string" && v.toLowerCase() === addr
                  );
                });
                if (myTx.length === 0) return (
                  <div className="empty-state">
                    <i className="bi bi-clock-history"></i>
                    <h3>Aucune transaction trouvée</h3>
                    <p>Effectue un achat ou une vente pour voir l'historique ici.</p>
                  </div>
                );
                const evMeta = {
                  OrderCreated:      { label: "Achat",               icon: "bi-cart-check",            color: "#4f8cff" },
                  DelivererAssigned: { label: "Livreur assigné",     icon: "bi-person-check",           color: "#fbbf24" },
                  DeliveryConfirmed: { label: "Livraison confirmée", icon: "bi-truck",                  color: "#33d6a6" },
                  FundsReleased:     { label: "Fonds libérés",       icon: "bi-check-circle",           color: "#22c55e" },
                  RefundClaimed:     { label: "Remboursement auto",  icon: "bi-arrow-counterclockwise", color: "#fb7185" },
                  RefundRequested:   { label: "Retour demandé",      icon: "bi-arrow-return-left",      color: "#fb923c" },
                  RefundApproved:    { label: "Retour approuvé",     icon: "bi-check2-all",             color: "#a3e635" },
                  ReturnConfirmed:   { label: "Retour confirmé",     icon: "bi-box-arrow-in-left",      color: "#34d399" },
                  DisputeOpened:     { label: "Litige ouvert",       icon: "bi-exclamation-triangle",   color: "#f97316" },
                  DisputeResolved:   { label: "Litige résolu",       icon: "bi-shield-check",           color: "#a78bfa" },
                  StoreCreated:      { label: "Boutique créée",      icon: "bi-shop",                   color: "#38bdf8" },
                  ProductAdded:      { label: "Produit ajouté",      icon: "bi-box-seam",               color: "#818cf8" },
                };
                return (
                  <div className="tx-history-list">
                    {myTx.map((e, i) => {
                      const meta = evMeta[e.event] || { label: e.event, icon: "bi-circle", color: "#94a3b8" };
                      const date = e.timestamp
                        ? new Date(e.timestamp * 1000).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
                        : "Date inconnue";
                      return (
                        <div key={i} className="tx-history-item">
                          <div className="tx-icon" style={{ background: meta.color + "22", color: meta.color }}>
                            <i className={`bi ${meta.icon}`}></i>
                          </div>
                          <div className="tx-info">
                            <strong>{meta.label}</strong>
                            <div className="tx-args">
                              {Object.entries(e.args || {}).map(([k, v]) => (
                                <span key={k} className="tx-arg">
                                  <em>{k}</em>: {String(v).length > 20 ? `${String(v).slice(0, 10)}...${String(v).slice(-6)}` : String(v)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="tx-meta">
                            <span className="tx-date"><i className="bi bi-calendar3"></i> {date}</span>
                            <span className="tx-block">Bloc #{e.blockNumber}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          )}

          {activePage === "historique" && (userRole === "seller" || userRole === "admin") && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Traçabilité</span>
                  <h1>Historique des transactions</h1>
                  <p>Toutes les opérations enregistrées sur la blockchain avec date, agent et hash.</p>
                </div>
                <button className="primary-btn" onClick={loadTxHistory} disabled={loadingHistory}>
                  <i className={`bi ${loadingHistory ? "bi-arrow-clockwise spin" : "bi-arrow-clockwise"}`}></i>
                  {loadingHistory ? "Chargement..." : "Charger"}
                </button>
              </div>

              <div className="history-filters">
                {["Tous","OrderCreated","DelivererAssigned","DeliveryConfirmed","FundsReleased","RefundClaimed","DisputeOpened","DisputeResolved","StoreCreated","ProductAdded"].map(f => (
                  <button
                    key={f}
                    className={`history-filter-btn ${historyFilter === f ? "active" : ""}`}
                    onClick={() => setHistoryFilter(f)}
                  >
                    {EVENT_META[f]?.label || f}
                  </button>
                ))}
              </div>

              {loadingHistory ? (
                <div className="empty-state">
                  <div className="loader"></div>
                  <h3>Lecture de la blockchain...</h3>
                </div>
              ) : txHistory.length === 0 ? (
                <div className="empty-state">
                  <i className="bi bi-clock-history"></i>
                  <h3>Aucune transaction chargée</h3>
                  <p>Clique sur "Charger" pour lire l'historique depuis la blockchain.</p>
                </div>
              ) : (
                <div className="history-table">
                  <div className="history-head">
                    <span>Date & Heure</span>
                    <span>Événement</span>
                    <span>Agent principal</span>
                    <span>Réf.</span>
                    <span>Montant</span>
                    <span>Hash</span>
                  </div>
                  {txHistory
                    .filter(tx => historyFilter === "Tous" || tx.event === historyFilter)
                    .map((tx, i) => {
                      const meta = EVENT_META[tx.event] || { label: tx.event, icon: "bi-circle", color: "#94a3b8" };
                      const date = tx.timestamp
                        ? new Date(tx.timestamp * 1000).toLocaleString("fr-FR")
                        : "—";
                      const agent = tx.args.buyer || tx.args.deliverer || tx.args.seller || tx.args.owner || "—";
                      const ref = tx.args.orderId ? `Cmd #${tx.args.orderId}` : tx.args.productId ? `Prod #${tx.args.productId}` : tx.args.storeId ? `Store #${tx.args.storeId}` : "—";
                      const amount = tx.args.amount ? `${formatEther(BigInt(tx.args.amount))} ETH` : "—";
                      const shortHash = tx.txHash ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}` : "—";
                      return (
                        <div className="history-row" key={i}>
                          <span className="history-date">{date}</span>
                          <span className="history-event" style={{ color: meta.color }}>
                            <i className={`bi ${meta.icon}`}></i> {meta.label}
                          </span>
                          <span className="history-agent" title={agent}>{shortAddress(agent)}</span>
                          <span className="history-ref">{ref}</span>
                          <span className="history-amount">{amount}</span>
                          <span className="history-hash" title={tx.txHash}>{shortHash}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {activePage === "ia" && (userRole === "seller" || userRole === "admin") && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Data Mining & ML</span>
                  <h1>IA & Analytique</h1>
                  <p>Analyse en temps réel des données blockchain — produits, commandes, vendeurs, litiges.</p>
                </div>
                <button className="primary-btn" onClick={loadAIStats} disabled={loadingAI}>
                  <i className={`bi bi-arrow-clockwise${loadingAI ? " spin" : ""}`}></i>
                  {loadingAI ? "Analyse..." : "Lancer l'analyse"}
                </button>
              </div>

              {!aiStats && !loadingAI && (
                <div className="empty-state">
                  <i className="bi bi-graph-up-arrow"></i>
                  <h3>Analyse non chargée</h3>
                  <p>Clique sur "Lancer l'analyse" pour lire les données depuis la blockchain.</p>
                </div>
              )}

              {loadingAI && (
                <div className="empty-state">
                  <div className="loader"></div>
                  <h3>Lecture blockchain en cours...</h3>
                  <p>Collecte et analyse des données on-chain.</p>
                </div>
              )}

              {aiStats && !loadingAI && (() => {
                const k = aiStats.kpis || {};
                const topProducts  = aiStats.top_products  || [];
                const categories   = aiStats.categories    || [];
                const catListings  = aiStats.cat_listings  || [];
                const topSellers   = aiStats.top_sellers   || [];
                const disputes     = aiStats.disputes      || {};
                const ratingDist   = aiStats.rating_distribution || {};
                const priceStats   = aiStats.price_stats   || null;
                return (
                <>
                  {/* KPIs globaux */}
                  <div className="ai-kpi-grid">
                    <div className="ai-kpi">
                      <i className="bi bi-box-seam" style={{ color: "#818cf8" }}></i>
                      <strong>{k.total_products ?? "—"}</strong>
                      <span>Produits</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-cart-check" style={{ color: "#4f8cff" }}></i>
                      <strong>{k.total_orders ?? "—"}</strong>
                      <span>Commandes</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-currency-exchange" style={{ color: "#33d6a6" }}></i>
                      <strong>{k.total_volume_eth ?? "—"} ETH</strong>
                      <span>Volume total</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-truck" style={{ color: "#fbbf24" }}></i>
                      <strong>{k.delivery_rate ?? "—"}%</strong>
                      <span>Taux livraison</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-exclamation-triangle" style={{ color: "#f87171" }}></i>
                      <strong>{k.dispute_rate ?? "—"}%</strong>
                      <span>Taux litiges</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-people" style={{ color: "#a78bfa" }}></i>
                      <strong>{k.unique_buyers ?? "—"}</strong>
                      <span>Acheteurs uniques</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-shop" style={{ color: "#60a5fa" }}></i>
                      <strong>{k.unique_sellers ?? "—"}</strong>
                      <span>Vendeurs actifs</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-star-fill" style={{ color: "#fbbf24" }}></i>
                      <strong>{k.avg_rating > 0 ? `${k.avg_rating}/5` : "—"}</strong>
                      <span>Note moyenne</span>
                    </div>
                  </div>

                  {/* KPIs financiers & clients avancés */}
                  <h2 style={{ margin: "28px 0 14px", fontWeight: 900 }}>Indicateurs avancés</h2>
                  <div className="ai-kpi-grid">
                    <div className="ai-kpi">
                      <i className="bi bi-graph-up" style={{ color: "#33d6a6" }}></i>
                      <strong>{k.ca_brut ?? "—"} ETH</strong>
                      <span>CA brut</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-graph-up-arrow" style={{ color: "#4f8cff" }}></i>
                      <strong>{k.ca_net ?? "—"} ETH</strong>
                      <span>CA net</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-basket" style={{ color: "#a78bfa" }}></i>
                      <strong>{k.aov ?? "—"} ETH</strong>
                      <span>Panier moyen (AOV)</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-person-check" style={{ color: "#fbbf24" }}></i>
                      <strong>{k.returning_rate ?? "—"}%</strong>
                      <span>Clients récurrents</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-repeat" style={{ color: "#818cf8" }}></i>
                      <strong>{k.avg_orders_per_buyer ?? "—"}</strong>
                      <span>Cmds moy./client</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-award" style={{ color: "#f472b6" }}></i>
                      <strong>{k.clv_moyen ?? "—"} ETH</strong>
                      <span>CLV moyen</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-check-circle" style={{ color: "#33d6a6" }}></i>
                      <strong>{k.released_orders ?? "—"}</strong>
                      <span>Commandes payées</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-truck" style={{ color: "#60a5fa" }}></i>
                      <strong>{k.in_transit ?? "—"}</strong>
                      <span>En transit</span>
                    </div>
                    <div className="ai-kpi">
                      <i className="bi bi-arrow-counterclockwise" style={{ color: "#f87171" }}></i>
                      <strong>{k.refunded_orders ?? "—"} · {k.refunded_volume_eth ?? "—"} ETH</strong>
                      <span>Remboursements</span>
                    </div>
                    {k.avg_delivery_days !== null && k.avg_delivery_days !== undefined && (
                      <div className="ai-kpi">
                        <i className="bi bi-clock-history" style={{ color: "#fbbf24" }}></i>
                        <strong>{k.avg_delivery_days} j</strong>
                        <span>Délai livraison moy.</span>
                      </div>
                    )}
                  </div>

                  <div className="ai-panels">
                    {/* Top produits les plus vendus */}
                    <div className="ai-panel">
                      <h2><i className="bi bi-fire"></i> Top produits les plus vendus</h2>
                      {topProducts.length === 0 ? (
                        <p style={{ color: "var(--muted)" }}>Aucune commande enregistrée.</p>
                      ) : (
                        <div className="ai-bar-chart">
                          {(() => {
                            const max = Math.max(...topProducts.map(p => p.orders), 1);
                            return topProducts.filter(p => p.orders > 0).map((p, i) => (
                              <div className="ai-bar-row" key={p.id}>
                                <span className="ai-bar-label" title={p.name}>
                                  {p.name.length > 20 ? p.name.slice(0, 18) + "…" : p.name}
                                </span>
                                <div className="ai-bar-track">
                                  <div className="ai-bar-fill" style={{
                                    width: `${(p.orders / max) * 100}%`,
                                    background: `hsl(${260 + i * 18}, 70%, 55%)`,
                                  }} />
                                </div>
                                <span className="ai-bar-value">{p.orders} vente{p.orders > 1 ? "s" : ""} · {p.volume_eth} ETH</span>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Catégories par ventes réelles */}
                    <div className="ai-panel">
                      <h2><i className="bi bi-pie-chart"></i> Catégories les plus vendues</h2>
                      {categories.length === 0 ? (
                        <p style={{ color: "var(--muted)" }}>Aucune vente par catégorie.</p>
                      ) : (
                        <div className="ai-bar-chart">
                          {(() => {
                            const max = Math.max(...categories.map(c => c.orders), 1);
                            return categories.map((cat, i) => (
                              <div className="ai-bar-row" key={cat.category}>
                                <span className="ai-bar-label" title={cat.category}>
                                  {cat.category.length > 20 ? cat.category.slice(0, 18) + "…" : cat.category}
                                </span>
                                <div className="ai-bar-track">
                                  <div className="ai-bar-fill" style={{
                                    width: `${(cat.orders / max) * 100}%`,
                                    background: `hsl(${180 + i * 22}, 65%, 50%)`,
                                  }} />
                                </div>
                                <span className="ai-bar-value">{cat.orders} · {cat.volume_eth} ETH</span>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Top vendeurs par volume ETH */}
                    <div className="ai-panel">
                      <h2><i className="bi bi-trophy"></i> Top vendeurs (volume ETH)</h2>
                      {topSellers.length === 0 ? (
                        <p style={{ color: "var(--muted)" }}>Aucune vente enregistrée.</p>
                      ) : (
                        <div className="ai-sellers-list">
                          {topSellers.map((s, i) => (
                            <div className="ai-seller-row" key={s.address}>
                              <span className="ai-rank">#{i + 1}</span>
                              <code className="ai-seller-addr" title={s.address}>
                                {s.address.slice(0, 6)}…{s.address.slice(-4)}
                              </code>
                              <div className="ai-seller-bar-track">
                                <div className="ai-seller-bar-fill" style={{
                                  width: `${(s.volume_eth / (topSellers[0].volume_eth || 1)) * 100}%`,
                                }} />
                              </div>
                              <span className="ai-seller-count">{s.volume_eth} ETH · {s.orders} cmd</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Litiges */}
                    <div className="ai-panel">
                      <h2><i className="bi bi-shield-exclamation"></i> Litiges & résolutions</h2>
                      <div className="ai-kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="ai-kpi" style={{ padding: "14px" }}>
                          <strong style={{ color: "#f87171" }}>{disputes.total ?? 0}</strong>
                          <span>Litiges ouverts</span>
                        </div>
                        <div className="ai-kpi" style={{ padding: "14px" }}>
                          <strong style={{ color: "#4ade80" }}>{disputes.resolved ?? 0}</strong>
                          <span>Résolus</span>
                        </div>
                        <div className="ai-kpi" style={{ padding: "14px" }}>
                          <strong style={{ color: "#60a5fa" }}>{disputes.buyer_won ?? 0}</strong>
                          <span>Acheteur gagne</span>
                        </div>
                        <div className="ai-kpi" style={{ padding: "14px" }}>
                          <strong style={{ color: "#a78bfa" }}>{disputes.seller_won ?? 0}</strong>
                          <span>Vendeur gagne</span>
                        </div>
                      </div>
                    </div>

                    {/* Distribution des notes */}
                    {k.total_reviews > 0 && (
                      <div className="ai-panel">
                        <h2><i className="bi bi-star"></i> Distribution des avis ({k.total_reviews} avis)</h2>
                        <div className="ai-bar-chart">
                          {[5, 4, 3, 2, 1].map(star => (
                            <div className="ai-bar-row" key={star}>
                              <span className="ai-bar-label">{"★".repeat(star)}</span>
                              <div className="ai-bar-track">
                                <div className="ai-bar-fill" style={{
                                  width: `${((ratingDist[star] || 0) / k.total_reviews) * 100}%`,
                                  background: star >= 4 ? "#4ade80" : star === 3 ? "#fbbf24" : "#f87171",
                                }} />
                              </div>
                              <span className="ai-bar-value">{ratingDist[star] || 0}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prix des produits */}
                    {priceStats && (
                      <div className="ai-panel">
                        <h2><i className="bi bi-cash-stack"></i> Statistiques de prix</h2>
                        <div className="ai-kpi-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div className="ai-kpi" style={{ padding: "14px" }}>
                            <strong>{priceStats.min} ETH</strong><span>Prix min</span>
                          </div>
                          <div className="ai-kpi" style={{ padding: "14px" }}>
                            <strong>{priceStats.max} ETH</strong><span>Prix max</span>
                          </div>
                          <div className="ai-kpi" style={{ padding: "14px" }}>
                            <strong>{priceStats.avg} ETH</strong><span>Prix moyen</span>
                          </div>
                          <div className="ai-kpi" style={{ padding: "14px" }}>
                            <strong>{priceStats.median} ETH</strong><span>Médiane</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
                );
              })()}
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
          {activePage === "admin" && account.toLowerCase() === adminAddress && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Administration</span>
                  <h1>Gestion des livreurs</h1>
                  <p>Définissez les comptes autorisés à effectuer des livraisons sur la plateforme.</p>
                </div>
              </div>

              <div className="form-panel" style={{ maxWidth: 520 }}>
                <h2>Ajouter un livreur</h2>
                <label>Adresse du compte livreur</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newDelivererAddress}
                  onChange={e => setNewDelivererAddress(e.target.value)}
                />
                <button className="primary-btn w-100" onClick={async () => {
                  if (!newDelivererAddress.trim()) { toast.error("Adresse obligatoire"); return; }
                  const result = await registerAsDeliverer(newDelivererAddress.trim());
                  if (result.success) {
                    toast.success("Livreur ajouté");
                    setNewDelivererAddress("");
                    const updated = await getDelivererCandidates();
                    setDelivererCandidates(updated);
                  } else {
                    toast.error(result.error || "Erreur");
                  }
                }}>
                  <i className="bi bi-person-plus"></i> Ajouter
                </button>
              </div>

              <div style={{ marginTop: 32 }}>
                <h2 style={{ marginBottom: 16 }}>Livreurs enregistrés ({delivererCandidates.length})</h2>
                {delivererCandidates.length === 0 ? (
                  <div className="empty-state">
                    <i className="bi bi-truck"></i>
                    <h3>Aucun livreur enregistré</h3>
                  </div>
                ) : (
                  <div className="table-panel">
                    <div className="table-head" style={{ gridTemplateColumns: "1fr auto" }}>
                      <span>Adresse</span>
                      <span>Action</span>
                    </div>
                    {delivererCandidates.map(d => (
                      <div className="table-row" key={d.address} style={{ gridTemplateColumns: "1fr auto" }}>
                        <code style={{ fontSize: "0.85rem" }}>{d.address}</code>
                        <button className="refund-btn" style={{ fontSize: "0.8rem", padding: "5px 12px" }} onClick={async () => {
                          const result = await removeDeliverer(d.address);
                          if (result.success) {
                            toast.success("Livreur supprimé");
                            const updated = await getDelivererCandidates();
                            setDelivererCandidates(updated);
                          } else {
                            toast.error(result.error || "Erreur");
                          }
                        }}>
                          <i className="bi bi-trash"></i> Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activePage === "anomalies" && userRole === "admin" && (
            <section className="page-card">
              <div className="page-head">
                <div>
                  <span className="eyebrow">Isolation Forest · ML</span>
                  <h1>Détection d'anomalies</h1>
                  <p>Détection automatique de comportements suspects chez les vendeurs et acheteurs via modèles Isolation Forest.</p>
                </div>
                <button className="primary-btn" onClick={loadAnomalies} disabled={loadingAnomalies}>
                  <i className={`bi bi-arrow-clockwise${loadingAnomalies ? " spin" : ""}`}></i>
                  {loadingAnomalies ? "Analyse..." : "Lancer la détection"}
                </button>
              </div>

              {!anomalyData && !loadingAnomalies && (
                <div className="empty-state">
                  <i className="bi bi-shield-exclamation"></i>
                  <h3>Aucune analyse lancée</h3>
                  <p>Clique sur "Lancer la détection" pour analyser les données blockchain.</p>
                </div>
              )}

              {loadingAnomalies && (
                <div className="empty-state">
                  <div className="loader"></div>
                  <h3>Analyse en cours...</h3>
                  <p>Les modèles ML analysent les comportements on-chain.</p>
                </div>
              )}

              {anomalyData && !loadingAnomalies && (() => {
                const s = anomalyData.summary || {};
                const anomalies = anomalyData.anomalies || [];
                return (
                  <>
                    {/* Résumé */}
                    <div className="ai-kpi-grid" style={{ marginBottom: "28px" }}>
                      <div className="ai-kpi">
                        <i className="bi bi-exclamation-triangle-fill" style={{ color: "#f97316" }}></i>
                        <strong>{s.total ?? 0}</strong>
                        <span>Anomalies totales</span>
                      </div>
                      <div className="ai-kpi">
                        <i className="bi bi-shop" style={{ color: "#818cf8" }}></i>
                        <strong>{s.sellers ?? 0}</strong>
                        <span>Vendeurs suspects</span>
                      </div>
                      <div className="ai-kpi">
                        <i className="bi bi-person" style={{ color: "#4f8cff" }}></i>
                        <strong>{s.buyers ?? 0}</strong>
                        <span>Acheteurs suspects</span>
                      </div>
                      <div className="ai-kpi">
                        <i className="bi bi-shield-fill-x" style={{ color: "#ef4444" }}></i>
                        <strong>{s.high ?? 0}</strong>
                        <span>Haute sévérité</span>
                      </div>
                      <div className="ai-kpi">
                        <i className="bi bi-shield-fill-exclamation" style={{ color: "#fbbf24" }}></i>
                        <strong>{s.medium ?? 0}</strong>
                        <span>Sévérité moyenne</span>
                      </div>
                    </div>

                    {anomalies.length === 0 ? (
                      <div className="empty-state">
                        <i className="bi bi-shield-check" style={{ color: "#22c55e" }}></i>
                        <h3>Aucune anomalie détectée</h3>
                        <p>Tous les vendeurs et acheteurs présentent un comportement normal.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {anomalies.map((a, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "var(--card-bg, #1e293b)",
                              border: `1px solid ${a.severity === "high" ? "#ef4444" : "#fbbf24"}`,
                              borderRadius: "10px",
                              padding: "16px 20px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                              <span style={{
                                background: a.severity === "high" ? "#ef444422" : "#fbbf2422",
                                color:      a.severity === "high" ? "#ef4444"   : "#fbbf24",
                                borderRadius: "6px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700,
                              }}>
                                {a.severity === "high" ? "HAUTE" : "MOYENNE"}
                              </span>
                              <span style={{
                                background: a.entity === "seller" ? "#818cf822" : "#4f8cff22",
                                color:      a.entity === "seller" ? "#818cf8"   : "#4f8cff",
                                borderRadius: "6px", padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700,
                              }}>
                                <i className={`bi ${a.entity === "seller" ? "bi-shop" : "bi-person"}`}></i>{" "}
                                {a.entity === "seller" ? "Vendeur" : "Acheteur"}
                              </span>
                              <code style={{ fontSize: "0.85rem", color: "var(--muted, #94a3b8)" }}>{a.label}</code>
                              <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--muted, #94a3b8)" }}>
                                score : {a.anomaly_score}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: "0.9rem" }}>{a.description}</p>
                            <details style={{ fontSize: "0.82rem", color: "var(--muted, #94a3b8)" }}>
                              <summary style={{ cursor: "pointer" }}>Détails des métriques</summary>
                              <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {Object.entries(a.features || {}).map(([k, v]) => (
                                  <span key={k} style={{
                                    background: "#ffffff0a", borderRadius: "6px",
                                    padding: "3px 10px", fontSize: "0.78rem",
                                  }}>
                                    <strong>{k}</strong>: {typeof v === "number" ? v.toFixed(4) : v}
                                  </span>
                                ))}
                              </div>
                            </details>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
