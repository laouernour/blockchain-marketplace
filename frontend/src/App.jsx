import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { parseEther, formatEther } from "ethers";
import Sidebar from "./components/Sidebar";
import MonitoringRecommendation from "./components/MonitoringRecommendation";
import ProfileRecommendation from "./components/ProfileRecommendation";
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
import { saveProductMetadata, getProductsMetadata, getNonce, verifySignature, registerAsDeliverer, removeDeliverer, getDelivererCandidates, getAIStats, getAnomalies, analyzeReviewStore, getRecommendations } from "./utils/api";

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
  const [searchMode, setSearchMode]   = useState("catalog");
  const [recoResults, setRecoResults] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoError, setRecoError]     = useState(null);
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
  const [anomalyFilter, setAnomalyFilter] = useState("all");
  const [anomalyAnalyzedAt, setAnomalyAnalyzedAt] = useState(null);
  const [loadingSellerAnalytics, setLoadingSellerAnalytics] = useState(false);
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
    if (result.success) {
      setAnomalyData(result.data);
      setAnomalyAnalyzedAt(new Date().toLocaleString("fr-FR"));
    } else setAnomalyData(null);
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
    if (userRole === "admin" && activePage !== "admin-dashboard" && activePage !== "ia" && activePage !== "blockchain" && activePage !== "historique" && activePage !== "anomalies" && activePage !== "monitoring") setActivePage("admin-dashboard");
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

  useEffect(() => {
    if (searchMode !== "recommendation" || activePage !== "marketplace") return;
    const q = query.trim();
    if (!q) { setRecoResults([]); setRecoError(null); return; }
    const timer = setTimeout(async () => {
      setRecoLoading(true);
      setRecoError(null);
      try {
        const res = await getRecommendations(q, 10);
        if (res.success) {
          setRecoResults(res.data || []);
        } else {
          setRecoError(res.error || "Erreur de recommandation");
          setRecoResults([]);
        }
      } catch {
        setRecoError("Service de recommandation indisponible");
        setRecoResults([]);
      } finally {
        setRecoLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, searchMode, activePage]);

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
      // Analyse NLP en arrière-plan — non bloquant, n'affecte pas l'avis on-chain
      analyzeReviewStore({
        contractProductId: order.productId,
        reviewerAddress: account,
        orderId: Number(selectedOrderId),
        rawText: reviewComment || "Avis sans commentaire",
      }).catch(err => console.warn("[NLP] Analyse sentiment échouée :", err.message));
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

              <ProfileRecommendation
                account={account}
                products={products}
                isDelivererAccount={isDelivererAccount}
                onPurchaseSuccess={refreshAll}
              />

              <div className="search-mode-toggle">
                <button
                  className={`mode-btn${searchMode === "catalog" ? " active" : ""}`}
                  onClick={() => { setSearchMode("catalog"); setRecoResults([]); setRecoError(null); }}
                >
                  <i className="bi bi-search"></i> Catalogue
                </button>
                <button
                  className={`mode-btn${searchMode === "recommendation" ? " active" : ""}`}
                  onClick={() => setSearchMode("recommendation")}
                >
                  <i className="bi bi-stars"></i> Recommandation système
                </button>
              </div>

              {searchMode === "catalog" && (
                <>
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
                </>
              )}

              {searchMode === "recommendation" && (
                <>
                  {recoLoading ? (
                    <div className="empty-state">
                      <div className="loader"></div>
                      <h3>Recherche des meilleures recommandations...</h3>
                    </div>
                  ) : recoError ? (
                    <div className="products-grid">
                      <div className="reco-error">
                        <i className="bi bi-exclamation-triangle"></i>
                        {" "}{recoError}
                        <button className="ghost-btn" style={{ marginTop: "8px", display: "block" }}
                          onClick={() => { setSearchMode("catalog"); setRecoError(null); }}>
                          Revenir au catalogue
                        </button>
                      </div>
                    </div>
                  ) : !query.trim() ? (
                    <div className="empty-state">
                      <i className="bi bi-stars"></i>
                      <h3>Tape une recherche</h3>
                      <p>Ex : "PC gamer", "cable USB", "chargeur rapide"</p>
                    </div>
                  ) : recoResults.length === 0 ? (
                    <div className="empty-state">
                      <i className="bi bi-search-heart"></i>
                      <h3>Aucun produit pertinent trouvé</h3>
                      <p>Aucun article du catalogue ne correspond à "{query}".</p>
                    </div>
                  ) : (
                    <div className="products-grid">
                      {recoResults.map((reco) => {
                        const chainProduct = products.find(p => p.id === reco.productId) || {};
                        return (
                          <div key={reco.productId} className="reco-card-wrapper">
                            <div className="reco-trust-badge">
                              <span className="reco-trust-score">
                                <i className="bi bi-shield-check"></i>
                                Confiance {Math.round(reco.trustScore * 100)}%
                              </span>
                              <span className="reco-stat">
                                <i className="bi bi-bag-check"></i>
                                {reco.signals.purchases} achat{reco.signals.purchases !== 1 ? "s" : ""}
                              </span>
                              <span className="reco-stat">
                                <i className="bi bi-chat-text"></i>
                                {reco.signals.reviewsCount} avis vérifiés
                              </span>
                              {reco.signals.avgRating && (
                                <span className="reco-stat">
                                  <i className="bi bi-star-fill"></i>
                                  {reco.signals.avgRating}/5
                                </span>
                              )}
                            </div>
                            <ProductCard
                              id={reco.productId}
                              name={reco.name}
                              description={reco.description}
                              category={reco.category}
                              image={chainProduct.metadata?.image || ""}
                              ipfsHash={chainProduct.ipfsHash || ""}
                              price={`${reco.priceEth} ETH`}
                              stock={reco.stock}
                              seller={chainProduct.seller || ""}
                              averageRating={reco.signals.avgRating || 0}
                              account={account}
                              isDelivererAccount={isDelivererAccount}
                              onPurchaseSuccess={refreshAll}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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
                <button className="primary-btn" disabled={loadingSellerAnalytics} onClick={async () => {
                  setLoadingSellerAnalytics(true);
                  await loadSellerOrders(account);
                  setLoadingSellerAnalytics(false);
                }}>
                  <i className={`bi bi-arrow-clockwise${loadingSellerAnalytics ? " spin" : ""}`}></i>
                  {loadingSellerAnalytics ? "Chargement..." : "Actualiser"}
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
                const delivered         = sellerOrders.filter(o => o.delivered);
                const tauxLivraison     = sellerOrders.length > 0 ? (delivered.length / sellerOrders.length * 100).toFixed(1) : "0.0";
                const totalLitiges      = sellerOrders.filter(o => o.disputed || o.disputeResolved).length;
                const litigesResolus    = sellerOrders.filter(o => o.disputeResolved).length;
                const tauxLitigeResolu  = totalLitiges > 0 ? (litigesResolus / totalLitiges * 100).toFixed(1) : "0.0";
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
                      <div><span>Taux de livraison</span><strong>{tauxLivraison}%</strong></div>
                      <div><span>Litiges résolus</span><strong>{tauxLitigeResolu}%</strong></div>
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
                        if (order.disputeResolved && order.buyerWon) statut = "Remboursé";
                        else if (order.disputeResolved && !order.buyerWon) statut = "Payé";
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
                  <h1>Gestion de la plateforme</h1>
                </div>
                <button className="primary-btn" onClick={() => Promise.all([loadProducts(), loadAllOrders(), getDelivererCandidates().then(d => setDelivererCandidates(d))])}>
                  <i className="bi bi-arrow-clockwise"></i> Actualiser
                </button>
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
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Adresse du livreur (0x...)"
                  value={newDelivererAddress}
                  onChange={e => setNewDelivererAddress(e.target.value)}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#fff" }}
                />
                <button className="primary-btn" onClick={async () => {
                  if (!newDelivererAddress.trim()) { toast.error("Adresse obligatoire"); return; }
                  const result = await registerAsDeliverer(newDelivererAddress.trim());
                  if (result.success) {
                    toast.success("Livreur ajouté");
                    setNewDelivererAddress("");
                    getDelivererCandidates().then(data => setDelivererCandidates(data));
                  } else {
                    toast.error(result.error || "Erreur");
                  }
                }}>
                  <i className="bi bi-person-plus"></i> Ajouter
                </button>
              </div>
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
            <section className="page-card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border,#334155)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h1 style={{ margin: "0 0 6px", fontSize: "1.35rem", fontWeight: 700 }}>Données Blockchain</h1>
                    {chainData && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <code style={{ fontSize: "0.75rem", color: "var(--muted)", background: "#ffffff08", padding: "2px 8px", borderRadius: 5 }}>
                          Contrat : {chainData.contractAddress}
                        </code>
                        <code style={{ fontSize: "0.75rem", color: "var(--muted)", background: "#ffffff08", padding: "2px 8px", borderRadius: 5 }}>
                          Admin : {chainData.admin}
                        </code>
                      </div>
                    )}
                  </div>
                  <button className="primary-btn" onClick={loadChainData} disabled={loadingChainData}>
                    <i className={`bi bi-arrow-clockwise${loadingChainData ? " spin" : ""}`}></i>
                    {loadingChainData ? "Lecture..." : "Lire la blockchain"}
                  </button>
                </div>
              </div>

              <div style={{ padding: "24px 32px" }}>

                {!chainData && !loadingChainData && (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#6366f118", border: "1px solid #6366f140", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                      <i className="bi bi-database" style={{ fontSize: "1.6rem", color: "#6366f1" }}></i>
                    </div>
                    <h3 style={{ margin: "0 0 8px" }}>Données non chargées</h3>
                    <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "0.88rem" }}>Clique sur "Lire la blockchain" pour afficher toutes les données du smart contract.</p>
                    <button className="primary-btn" onClick={loadChainData}>
                      <i className="bi bi-database-check"></i> Lire la blockchain
                    </button>
                  </div>
                )}

                {loadingChainData && (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div className="loader" style={{ margin: "0 auto 20px" }}></div>
                    <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>Lecture du smart contract en cours...</p>
                  </div>
                )}

                {chainData && !loadingChainData && (() => {
                  const noAddr = "0x0000000000000000000000000000000000000000";
                  const fmtDate = (ts) => ts > 0 ? new Date(ts * 1000).toLocaleString("fr-FR") : "—";
                  const fmtAddr = (a) => a && a !== noAddr ? `${a.slice(0,6)}…${a.slice(-4)}` : null;
                  const isText = (s) => typeof s === "string" && s.length > 3 && !s.startsWith("Qm") && !s.startsWith("bafy");
                  const sellerOf = (productId) => {
                    const p = chainData.products.find(p => p.id === productId);
                    return p ? p.seller : null;
                  };
                  const storeNameOf = (storeId) => {
                    const s = chainData.stores.find(s => s.id === storeId);
                    return s ? s.name : `#${storeId}`;
                  };

                  const statusCfg = (o) => {
                    if (o.refundApproved)                 return { label: "Retour approuvé",  color: "#a3e635", bg: "#a3e63518" };
                    if (o.refundRequested)                return { label: "Retour demandé",   color: "#fb923c", bg: "#fb923c18" };
                    if (o.disputeResolved && o.buyerWon)  return { label: "Remboursé",        color: "#fb7185", bg: "#fb718518" };
                    if (o.disputeResolved)                return { label: "Litige → Vendeur", color: "#22c55e", bg: "#22c55e18" };
                    if (o.disputed)                       return { label: "En litige",        color: "#fbbf24", bg: "#fbbf2418" };
                    if (o.released)                       return { label: "Payé",             color: "#22c55e", bg: "#22c55e18" };
                    if (o.delivered)                      return { label: "Livré",            color: "#4f8cff", bg: "#4f8cff18" };
                    return                                       { label: "En attente",       color: "#94a3b8", bg: "#94a3b818" };
                  };

                  const tabs = [
                    { id: "stores",   label: "Boutiques",  count: chainData.counts.stores,         icon: "bi-shop",      color: "#38bdf8" },
                    { id: "products", label: "Produits",   count: chainData.counts.products,       icon: "bi-box-seam",  color: "#818cf8" },
                    { id: "orders",   label: "Commandes",  count: chainData.counts.orders,         icon: "bi-receipt",   color: "#4f8cff" },
                    { id: "reviews",  label: "Avis",       count: chainData.counts.reviews,        icon: "bi-star-fill", color: "#fbbf24" },
                    { id: "actors",   label: "Acteurs",    count: chainData.counts.actors ?? 0,    icon: "bi-people",    color: "#34d399" },
                  ];

                  const cell = (content, muted) => (
                    <span style={{ fontSize: "0.8rem", color: muted ? "var(--muted)" : "var(--text,#e2e8f0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {content}
                    </span>
                  );

                  return (
                    <>
                      {/* Compteurs */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
                        {tabs.map(t => (
                          <div key={t.id} style={{ background: "var(--card-bg,#1e293b)", border: "1px solid var(--border,#334155)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                            onClick={() => setChainTab(t.id)}>
                            <i className={`bi ${t.icon}`} style={{ fontSize: "1.2rem", color: t.color }}></i>
                            <div>
                              <strong style={{ fontSize: "1.4rem", color: t.color, lineHeight: 1 }}>{t.count}</strong>
                              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>{t.label}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tabs */}
                      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "var(--card-bg,#1e293b)", border: "1px solid var(--border,#334155)", borderRadius: 10, padding: 4, width: "fit-content" }}>
                        {tabs.map(t => (
                          <button key={t.id} onClick={() => setChainTab(t.id)} style={{
                            background: chainTab === t.id ? "var(--primary,#6366f1)" : "transparent",
                            color: chainTab === t.id ? "#fff" : "var(--muted)",
                            border: "none", borderRadius: 7, padding: "6px 16px",
                            fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 6,
                          }}>
                            <i className={`bi ${t.icon}`}></i> {t.label}
                            <span style={{ background: chainTab === t.id ? "rgba(255,255,255,0.2)" : "var(--border,#334155)", borderRadius: 99, padding: "1px 7px", fontSize: "0.72rem" }}>{t.count}</span>
                          </button>
                        ))}
                      </div>

                      {/* ── BOUTIQUES ── */}
                      {chainTab === "stores" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {/* Header */}
                          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 2fr 2fr", gap: 12, padding: "8px 16px", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <span>ID</span><span>Nom</span><span>Propriétaire</span><span>IPFS Hash</span>
                          </div>
                          {chainData.stores.map(s => (
                            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 2fr 2fr", gap: 12, padding: "12px 16px", background: "var(--card-bg,#1e293b)", border: "1px solid var(--border,#334155)", borderRadius: 8, alignItems: "center" }}>
                              <span style={{ fontWeight: 700, color: "#6366f1", fontSize: "0.82rem" }}>#{s.id}</span>
                              <strong style={{ fontSize: "0.88rem" }}>{s.name}</strong>
                              <code style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{s.owner}</code>
                              {cell(isText(s.ipfsHash) ? s.ipfsHash : (s.ipfsHash || "—"), true)}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── PRODUITS ── */}
                      {chainTab === "products" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 60px 70px 2fr 2fr", gap: 12, padding: "8px 16px", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <span>ID</span><span>Boutique</span><span>Prix</span><span>Stock</span><span>Promo</span><span>Vendeur</span><span>IPFS</span>
                          </div>
                          {chainData.products.map(p => (
                            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr 60px 70px 2fr 2fr", gap: 12, padding: "12px 16px", background: "var(--card-bg,#1e293b)", border: `1px solid ${p.featured ? "#fbbf2440" : "var(--border,#334155)"}`, borderRadius: 8, alignItems: "center" }}>
                              <span style={{ fontWeight: 700, color: "#818cf8", fontSize: "0.82rem" }}>#{p.id}</span>
                              <span style={{ fontSize: "0.82rem" }}>{storeNameOf(p.storeId)}</span>
                              <strong style={{ fontSize: "0.88rem", color: "#22c55e" }}>{p.price} ETH</strong>
                              <span style={{ fontSize: "0.82rem", color: p.stock === 0 ? "#ef4444" : "var(--text)" }}>{p.stock}</span>
                              {p.featured
                                ? <span style={{ background: "#fbbf2418", color: "#fbbf24", borderRadius: 5, padding: "2px 6px", fontSize: "0.7rem", fontWeight: 700 }}>★ PROMO</span>
                                : <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>—</span>
                              }
                              <code style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{p.seller}</code>
                              {cell(isText(p.ipfsHash) ? p.ipfsHash : (p.ipfsHash || "—"), true)}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── COMMANDES ── */}
                      {chainTab === "orders" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "40px 50px 90px 1fr 1fr 1fr 110px 130px 130px", gap: 10, padding: "8px 16px", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <span>ID</span><span>Prod</span><span>Montant</span><span>Acheteur</span><span>Vendeur</span><span>Livreur</span><span>Statut</span><span>Créée le</span><span>Livrée le</span>
                          </div>
                          {chainData.orders.map(o => {
                            const st = statusCfg(o);
                            const vendor = sellerOf(o.productId);
                            return (
                              <div key={o.id} style={{ display: "grid", gridTemplateColumns: "40px 50px 90px 1fr 1fr 1fr 110px 130px 130px", gap: 10, padding: "12px 16px", background: "var(--card-bg,#1e293b)", border: "1px solid var(--border,#334155)", borderRadius: 8, alignItems: "center" }}>
                                <span style={{ fontWeight: 700, color: "#4f8cff", fontSize: "0.82rem" }}>#{o.id}</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>#{o.productId}</span>
                                <strong style={{ fontSize: "0.85rem", color: "#22c55e" }}>{o.amount} ETH</strong>
                                <code style={{ fontSize: "0.72rem", color: "var(--muted)" }} title={o.buyer}>{fmtAddr(o.buyer)}</code>
                                <code style={{ fontSize: "0.72rem", color: "var(--muted)" }} title={vendor}>{vendor ? fmtAddr(vendor) : "—"}</code>
                                <code style={{ fontSize: "0.72rem", color: "var(--muted)" }} title={o.deliverer}>{o.deliverer && o.deliverer !== noAddr ? fmtAddr(o.deliverer) : <em>Non assigné</em>}</code>
                                <span style={{ background: st.bg, color: st.color, borderRadius: 6, padding: "3px 8px", fontSize: "0.72rem", fontWeight: 700, textAlign: "center" }}>{st.label}</span>
                                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{fmtDate(o.createdAt)}</span>
                                <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{fmtDate(o.deliveryTimestamp)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── ACTEURS ── */}
                      {chainTab === "actors" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "3fr 140px 120px 100px", gap: 12, padding: "8px 16px", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            <span>Adresse</span><span>Rôles</span><span>Livreur on-chain</span><span>Blacklisté</span>
                          </div>
                          {(chainData.actors || []).map((a, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 140px 120px 100px", gap: 12, padding: "12px 16px", background: "var(--card-bg,#1e293b)", border: `1px solid ${a.blacklisted ? "#ef444440" : "var(--border,#334155)"}`, borderRadius: 8, alignItems: "center" }}>
                              <code style={{ fontSize: "0.75rem", color: a.blacklisted ? "#ef4444" : "var(--text)", wordBreak: "break-all" }}>{a.address}</code>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {a.roles.map(r => {
                                  const rCfg = { admin: ["#f43f5e","#f43f5e18"], vendeur: ["#818cf8","#818cf818"], acheteur: ["#38bdf8","#38bdf818"], livreur: ["#34d399","#34d39918"] };
                                  const [col, bg] = rCfg[r] || ["#94a3b8","#94a3b818"];
                                  return <span key={r} style={{ background: bg, color: col, borderRadius: 4, padding: "2px 7px", fontSize: "0.68rem", fontWeight: 700 }}>{r.toUpperCase()}</span>;
                                })}
                              </div>
                              <span style={{ fontSize: "0.78rem", color: a.delivererOnChain ? "#34d399" : "var(--muted)" }}>
                                {a.delivererOnChain ? "✓ Oui" : "—"}
                              </span>
                              <span style={{ fontSize: "0.78rem", color: a.blacklisted ? "#ef4444" : "var(--muted)" }}>
                                {a.blacklisted ? "⛔ Oui" : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── AVIS ── */}
                      {chainTab === "reviews" && (
                        chainData.reviews.length === 0 ? (
                          <div className="empty-state"><i className="bi bi-star"></i><h3>Aucun avis enregistré</h3></div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "40px 60px 70px 100px 1fr 2fr", gap: 12, padding: "8px 16px", fontSize: "0.72rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              <span>ID</span><span>Produit</span><span>Commande</span><span>Note</span><span>Auteur</span><span>Commentaire</span>
                            </div>
                            {chainData.reviews.map((r, i) => (
                              <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 60px 70px 100px 1fr 2fr", gap: 12, padding: "12px 16px", background: "var(--card-bg,#1e293b)", border: "1px solid var(--border,#334155)", borderRadius: 8, alignItems: "center" }}>
                                <span style={{ fontWeight: 700, color: "#fbbf24", fontSize: "0.82rem" }}>#{r.id}</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>#{r.productId}</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>#{r.orderId}</span>
                                <span style={{ color: "#fbbf24", fontSize: "0.85rem", letterSpacing: 1 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                                <code style={{ fontSize: "0.72rem", color: "var(--muted)" }} title={r.reviewer}>{fmtAddr(r.reviewer)}</code>
                                <span style={{ fontSize: "0.8rem", color: "var(--text)", fontStyle: isText(r.ipfsHash) ? "normal" : "italic" }}>
                                  {isText(r.ipfsHash) ? r.ipfsHash : (r.ipfsHash ? `IPFS: ${r.ipfsHash.slice(0,20)}…` : "—")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </>
                  );
                })()}
              </div>
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

          {activePage === "anomalies" && userRole === "admin" && (() => {
            const NLP_FEATURES = ["sentiment_moy_recu","sentiment_moy_donne","mismatch_moy_vendeur","mismatch_moy_acheteur"];
            const s = anomalyData?.summary || {};
            const allAnomalies = anomalyData?.anomalies || [];
            const filteredAnomalies = allAnomalies.filter(a => {
              if (anomalyFilter === "sellers") return a.entity === "seller";
              if (anomalyFilter === "buyers")  return a.entity === "buyer";
              if (anomalyFilter === "high")    return a.severity === "high";
              return true;
            });
            const scoreToPercent = (score) => Math.round((Math.abs(Math.min(0, Math.max(-0.5, score))) / 0.5) * 100);
            const riskScore = (score) => Math.round(scoreToPercent(score) * 0.99);

            const severityCfg = {
              high:   { label: "CRITIQUE", bg: "#ef444418", color: "#ef4444", border: "#ef444460" },
              medium: { label: "ÉLEVÉ",    bg: "#fbbf2418", color: "#fbbf24", border: "#fbbf2460" },
            };
            const entityCfg = {
              seller: { label: "Vendeur",  icon: "bi-shop",   color: "#818cf8", bg: "#818cf818" },
              buyer:  { label: "Acheteur", icon: "bi-person", color: "#4f8cff", bg: "#4f8cff18" },
            };

            return (
            <section className="page-card" style={{ padding: 0, overflow: "hidden" }}>

              {/* ── Barre de titre ── */}
              <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border, #334155)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div>
                    <h1 style={{ margin: "0 0 6px", fontSize: "1.35rem", fontWeight: 700 }}>Surveillance comportementale</h1>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted, #94a3b8)" }}>
                      Analyse automatique des comportements on-chain — vendeurs &amp; acheteurs
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    {anomalyAnalyzedAt && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        background: "#22c55e18", border: "1px solid #22c55e40",
                        borderRadius: "8px", padding: "6px 12px",
                        fontSize: "0.78rem", color: "#22c55e",
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
                        Dernière analyse : {anomalyAnalyzedAt}
                      </div>
                    )}
                    <button className="primary-btn" onClick={loadAnomalies} disabled={loadingAnomalies} style={{ whiteSpace: "nowrap" }}>
                      <i className={`bi bi-arrow-clockwise${loadingAnomalies ? " spin" : ""}`}></i>
                      {loadingAnomalies ? "Analyse..." : "Lancer l'analyse"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ padding: "24px 32px" }}>

                {/* État vide */}
                {!anomalyData && !loadingAnomalies && (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%",
                      background: "#6366f118", border: "1px solid #6366f140",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 20px",
                    }}>
                      <i className="bi bi-shield-lock" style={{ fontSize: "1.6rem", color: "#6366f1" }}></i>
                    </div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Aucune analyse en cours</h3>
                    <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "0.88rem" }}>
                      Lancez une analyse pour détecter les comportements atypiques sur la blockchain.
                    </p>
                    <button className="primary-btn" onClick={loadAnomalies}>
                      <i className="bi bi-play-fill"></i> Lancer l'analyse
                    </button>
                  </div>
                )}

                {/* Chargement */}
                {loadingAnomalies && (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div className="loader" style={{ margin: "0 auto 20px" }}></div>
                    <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Analyse en cours</h3>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.88rem" }}>Traitement des données on-chain et analyse comportementale...</p>
                  </div>
                )}

                {anomalyData && !loadingAnomalies && (
                  <>
                    {/* ── Métriques résumé ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "28px" }}>
                      {[
                        { value: allAnomalies.length, label: "Alertes totales",     color: "#f97316", icon: "bi-bell-fill" },
                        { value: s.high ?? 0,         label: "Critiques",           color: "#ef4444", icon: "bi-shield-fill-x" },
                        { value: s.medium ?? 0,       label: "Élevées",             color: "#fbbf24", icon: "bi-shield-fill-exclamation" },
                        { value: s.sellers ?? 0,      label: "Vendeurs suspects",   color: "#818cf8", icon: "bi-shop" },
                        { value: s.buyers ?? 0,       label: "Acheteurs suspects",  color: "#4f8cff", icon: "bi-person" },
                      ].map((m, i) => (
                        <div key={i} style={{
                          background: "var(--card-bg, #1e293b)",
                          border: "1px solid var(--border, #334155)",
                          borderRadius: "10px", padding: "16px",
                          display: "flex", flexDirection: "column", gap: "8px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <i className={`bi ${m.icon}`} style={{ color: m.color, fontSize: "1rem" }}></i>
                            <div style={{
                              width: 8, height: 8, borderRadius: "50%",
                              background: m.value > 0 ? m.color : "#334155",
                            }} />
                          </div>
                          <strong style={{ fontSize: "1.6rem", fontWeight: 700, color: m.value > 0 ? m.color : "var(--text)", lineHeight: 1 }}>{m.value}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.3 }}>{m.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* ── Filtres ── */}
                    <div style={{
                      display: "flex", gap: "2px", marginBottom: "20px",
                      background: "var(--card-bg, #1e293b)",
                      border: "1px solid var(--border, #334155)",
                      borderRadius: "10px", padding: "4px",
                      width: "fit-content",
                    }}>
                      {[
                        { key: "all",     label: "Toutes",   count: allAnomalies.length },
                        { key: "high",    label: "Critiques",count: s.high ?? 0 },
                        { key: "sellers", label: "Vendeurs", count: s.sellers ?? 0 },
                        { key: "buyers",  label: "Acheteurs",count: s.buyers ?? 0 },
                      ].map(tab => (
                        <button key={tab.key} onClick={() => setAnomalyFilter(tab.key)} style={{
                          background: anomalyFilter === tab.key ? "var(--primary, #6366f1)" : "transparent",
                          color: anomalyFilter === tab.key ? "#fff" : "var(--muted, #94a3b8)",
                          border: "none", borderRadius: "7px",
                          padding: "6px 16px", fontSize: "0.8rem", fontWeight: 600,
                          cursor: "pointer", transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: "6px",
                        }}>
                          {tab.label}
                          <span style={{
                            background: anomalyFilter === tab.key ? "rgba(255,255,255,0.2)" : "var(--border, #334155)",
                            borderRadius: "99px", padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700,
                          }}>{tab.count}</span>
                        </button>
                      ))}
                    </div>

                    {/* ── Liste des alertes ── */}
                    {filteredAnomalies.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <i className="bi bi-shield-check" style={{ fontSize: "2rem", color: "#22c55e" }}></i>
                        <p style={{ margin: "12px 0 0", color: "var(--muted)" }}>Aucune alerte dans cette catégorie.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {filteredAnomalies.map((a, idx) => {
                          const isHigh   = a.severity === "high";
                          const isSeller = a.entity === "seller";
                          const sev = severityCfg[a.severity] || severityCfg.medium;
                          const ent = entityCfg[a.entity]    || entityCfg.buyer;
                          const pct = scoreToPercent(a.anomaly_score);
                          const rs  = riskScore(a.anomaly_score);
                          return (
                            <div key={idx} style={{
                              background: "var(--card-bg, #1e293b)",
                              border: `1px solid ${sev.border}`,
                              borderRadius: "10px",
                              overflow: "hidden",
                            }}>
                              {/* Bande couleur top */}
                              <div style={{ height: "3px", background: sev.color, width: "100%" }} />

                              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                {/* Ligne principale */}
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                  {/* Sévérité */}
                                  <span style={{
                                    background: sev.bg, color: sev.color,
                                    border: `1px solid ${sev.border}`,
                                    borderRadius: "6px", padding: "3px 10px",
                                    fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em",
                                  }}>{sev.label}</span>

                                  {/* Entité */}
                                  <span style={{
                                    background: ent.bg, color: ent.color,
                                    borderRadius: "6px", padding: "3px 10px",
                                    fontSize: "0.7rem", fontWeight: 700,
                                    display: "flex", alignItems: "center", gap: "4px",
                                  }}>
                                    <i className={`bi ${ent.icon}`}></i> {ent.label}
                                  </span>

                                  {/* Adresse */}
                                  <code style={{
                                    fontSize: "0.8rem", color: "var(--muted, #94a3b8)",
                                    background: "#ffffff08", borderRadius: "5px",
                                    padding: "2px 8px", flex: 1, minWidth: 0,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  }}>{a.label}</code>

                                  {/* Risk score */}
                                  <div style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    background: sev.bg, border: `1px solid ${sev.border}`,
                                    borderRadius: "8px", padding: "4px 12px",
                                  }}>
                                    <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Risque</span>
                                    <strong style={{ fontSize: "1rem", color: sev.color, fontVariantNumeric: "tabular-nums" }}>{rs}</strong>
                                    <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>/100</span>
                                  </div>
                                </div>

                                {/* Description */}
                                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text, #e2e8f0)", fontWeight: 500 }}>{a.description}</p>

                                {/* Barre de risque */}
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <span style={{ fontSize: "0.7rem", color: "var(--muted)", whiteSpace: "nowrap", minWidth: 80 }}>Score de risque</span>
                                  <div style={{ flex: 1, background: "#ffffff08", borderRadius: "99px", height: "5px", overflow: "hidden" }}>
                                    <div style={{
                                      width: `${pct}%`, height: "100%", borderRadius: "99px",
                                      background: isHigh
                                        ? "linear-gradient(90deg,#f97316,#ef4444)"
                                        : "linear-gradient(90deg,#fbbf24,#f97316)",
                                      transition: "width 0.8s ease",
                                    }} />
                                  </div>
                                  <span style={{ fontSize: "0.7rem", color: sev.color, fontWeight: 700, minWidth: 32, textAlign: "right" }}>{pct}%</span>
                                </div>

                                {/* Métriques détail */}
                                <details>
                                  <summary style={{
                                    cursor: "pointer", fontSize: "0.78rem",
                                    color: "var(--muted, #94a3b8)", userSelect: "none",
                                    display: "flex", alignItems: "center", gap: "6px", listStyle: "none",
                                  }}>
                                    <i className="bi bi-chevron-right" style={{ fontSize: "0.65rem", transition: "transform 0.2s" }}></i>
                                    Indicateurs comportementaux ({Object.keys(a.features || {}).length})
                                  </summary>
                                  <div style={{
                                    marginTop: "12px",
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                                    gap: "6px",
                                  }}>
                                    {Object.entries(a.features || {}).map(([k, v]) => {
                                      const isNLP = NLP_FEATURES.includes(k);
                                      return (
                                        <div key={k} style={{
                                          background: isNLP ? "#7c3aed12" : "#ffffff06",
                                          border: `1px solid ${isNLP ? "#7c3aed40" : "var(--border, #334155)"}`,
                                          borderRadius: "7px", padding: "8px 12px",
                                          display: "flex", justifyContent: "space-between", alignItems: "center",
                                        }}>
                                          <span style={{ fontSize: "0.75rem", color: isNLP ? "#a78bfa" : "var(--muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                                            {isNLP && <i className="bi bi-stars" style={{ fontSize: "0.7rem" }}></i>}
                                            {k}
                                          </span>
                                          <strong style={{ fontSize: "0.82rem", color: isNLP ? "#c4b5fd" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                                            {typeof v === "number" ? v.toFixed(4) : v}
                                          </strong>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
            );
          })()}

          {activePage === "monitoring" && userRole === "admin" && (
            <MonitoringRecommendation />
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
