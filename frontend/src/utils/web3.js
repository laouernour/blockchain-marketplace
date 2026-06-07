import { BrowserProvider, Contract, formatEther } from "ethers";
import MarketplaceABI from "../abi/Marketplace.json";
import { CONTRACT_ADDRESS } from "../config";

function extractError(error) {
  const reason = error?.reason || error?.revert?.args?.[0] || error?.info?.error?.message;
  if (reason) return reason;
  const msg = error?.shortMessage || error?.message || "";
  if (msg.includes("user rejected") || msg.includes("User denied")) return "Transaction annulée";
  if (msg.includes("missing revert data")) return "Transaction refusée";
  if (msg.includes("Internal JSON-RPC")) return "Transaction refusée";
  if (msg.includes("insufficient funds")) return "Fonds insuffisants";
  if (msg.includes("network")) return "Problème de réseau — vérifie que Hardhat est lancé";
  return msg || "Erreur inconnue";
}

// Signer un message avec MetaMask
export const signMessage = async (message) => {
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(message);
    return { success: true, signature };
  } catch (error) {
    console.error("Erreur signMessage:", error);
    return { success: false, error: error.message };
  }
};

// Connexion wallet
const HARDHAT_CHAIN_ID = "0x7a69"; // 31337

const switchToHardhat = async () => {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_CHAIN_ID }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: HARDHAT_CHAIN_ID,
          chainName: "Hardhat Local",
          rpcUrls: ["http://127.0.0.1:8545"],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        }],
      });
    }
  }
};

export const connectWallet = async () => {
  if (!window.ethereum) {
    alert("MetaMask non installé");
    return null;
  }

  try {
    await switchToHardhat();
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    return accounts[0];
  } catch (error) {
    console.error("Erreur connexion wallet:", error);
    return null;
  }
};

// Vérifier connexion existante
export const checkWalletConnection = async () => {
  if (!window.ethereum) {
    return {
      installed: false,
      connected: false,
      accounts: [],
    };
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    return {
      installed: true,
      connected: accounts.length > 0,
      accounts,
    };
  } catch (error) {
    console.error("Erreur vérification wallet:", error);
    return {
      installed: true,
      connected: false,
      accounts: [],
    };
  }
};

// Récupérer contrat
export const getSignerAddress = async () => {
  if (!window.ethereum) return null;
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch {
    return null;
  }
};

export const getContract = async (expectedAddress = null) => {
  if (!window.ethereum) {
    throw new Error("MetaMask non installé");
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  if (expectedAddress) {
    const actual = await signer.getAddress();
    if (actual.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error("ACCOUNT_MISMATCH");
    }
  }

  return new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, signer);
};

// Charger produits (lecture seule, sans signer requis)
export const getAllProducts = async () => {
  try {
    if (!window.ethereum) return [];
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    const count = await contract.productCount();
    const products = [];

    for (let i = 1; i <= Number(count); i++) {
      const p = await contract.products(i);

      if (p.exists) {
        const avgRating = await contract.getAverageRating(i);
        products.push({
          id: Number(p.id),
          seller: p.seller,
          price: formatEther(p.price),
          stock: Number(p.stock),
          ipfsHash: p.ipfsHash,
          averageRating: Number(avgRating),
        });
      }
    }

    return products;
  } catch (error) {
    console.error("Erreur chargement produits:", error);
    return [];
  }
};

// Vérifier si le wallet a déjà une boutique
export const getMyStoreId = async () => {
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, signer);
    const address = await signer.getAddress();
    const storeId = await contract.storeOfOwner(address);
    return Number(storeId);
  } catch (error) {
    console.error("Erreur lecture storeOfOwner:", error);
    return 0;
  }
};

// Créer boutique
export const createStore = async (name, ipfsHash) => {
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, signer);
    const address = await signer.getAddress();

    const existingStoreId = await contract.storeOfOwner(address);

    if (Number(existingStoreId) > 0) {
      return {
        success: false,
        error: `Vous avez déjà une boutique (ID: ${existingStoreId})`,
      };
    }

    const tx = await contract.createStore(name, ipfsHash);
    await tx.wait();

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Erreur createStore:", error);
    return { success: false, error: extractError(error) };
  }
};

// Ajouter un produit
export const addProduct = async (price, stock, ipfsHash, expectedAddress = null) => {
  try {
    const contract = await getContract(expectedAddress);
    const tx = await contract.addProduct(BigInt(price), BigInt(stock), ipfsHash);
    await tx.wait();
    const productId = await contract.productCount();
    return { success: true, productId: Number(productId) };
  } catch (error) {
    console.error("Erreur addProduct:", error);
    if (error.message === "ACCOUNT_MISMATCH") {
      return { success: false, error: "Compte MetaMask changé — déconnecte et reconnecte ton wallet" };
    }
    return { success: false, error: extractError(error) };
  }
};

// Acheter un produit
export const purchaseProduct = async (productId, priceWei, expectedAddress = null) => {
  try {
    const contract = await getContract(expectedAddress);
    const tx = await contract.purchase(productId, { value: BigInt(priceWei) });
    await tx.wait();
    const orderCount = await contract.orderCount();
    return { success: true, txHash: tx.hash, orderId: Number(orderCount) };
  } catch (error) {
    console.error("Erreur purchaseProduct:", error);
    if (error.message === "ACCOUNT_MISMATCH") {
      return { success: false, error: "Compte MetaMask changé — déconnecte et reconnecte ton wallet" };
    }
    return { success: false, error: extractError(error) };
  }
};

// Confirmer la livraison
export const confirmDelivery = async (orderId) => {
  try {
    const contract = await getContract();
    const tx = await contract.confirmDelivery(orderId);
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur confirmDelivery:", error);
    return { success: false, error: extractError(error) };
  }
};
// Lire une commande
export const getOrder = async (orderId) => {
  try {
    const contract = await getContract();
    const order = await contract.orders(orderId);

    return {
      id: Number(order.id),
      productId: Number(order.productId),
      buyer: order.buyer,
      amount: order.amount.toString(),
      delivered: order.delivered,
      released: order.released,
      exists: order.exists,
    };
  } catch (error) {
    console.error("Erreur getOrder:", error);
    return null;
  }
};

// Nombre total de commandes
export const getOrderCount = async () => {
  try {
    const contract = await getContract();
    const count = await contract.orderCount();
    return Number(count);
  } catch (error) {
    console.error("Erreur getOrderCount:", error);
    return 0;
  }
};

function parseOrder(o) {
  return {
    id: Number(o.id),
    productId: Number(o.productId),
    buyer: o.buyer,
    deliverer: o.deliverer || "",
    amount: o.amount.toString(),
    delivered: o.delivered,
    released: o.released,
    disputed: o.disputed,
    disputeResolved: o.disputeResolved,
    buyerWon: o.buyerWon,
    deliveryTimestamp: Number(o.deliveryTimestamp),
    disputeIpfsHash: o.disputeIpfsHash || "",
    refundRequested: o.refundRequested || false,
    refundApproved: o.refundApproved || false,
    exists: o.exists,
  };
}

// Charger les commandes d'un vendeur
export const getSellerOrders = async (sellerAddress) => {
  try {
    if (!window.ethereum) return [];
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    const orderIds = await contract.getOrderIdsBySeller(sellerAddress);
    const orders = [];
    for (const id of orderIds) {
      const o = await contract.orders(id);
      if (o.exists) orders.push(parseOrder(o));
    }
    return orders;
  } catch (error) {
    console.error("Erreur getSellerOrders:", error);
    return [];
  }
};

// Demander un remboursement (après 7 jours sans livraison)
export const claimRefund = async (orderId) => {
  try {
    const contract = await getContract();
    const tx = await contract.claimRefund(BigInt(orderId));
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur claimRefund:", error);
    return { success: false, error: extractError(error) };
  }
};

// Lire le timestamp d'une commande
export const getOrderTimestamp = async (orderId) => {
  try {
    if (!window.ethereum) return 0;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    const ts = await contract.orderTimestamp(BigInt(orderId));
    return Number(ts);
  } catch (error) {
    console.error("Erreur getOrderTimestamp:", error);
    return 0;
  }
};

// Charger toutes les commandes
export const getAllOrders = async () => {
  try {
    const count = await getOrderCount();
    const orders = [];

    for (let i = 1; i <= count; i++) {
      const order = await getOrder(i);

      if (order && order.exists) {
        orders.push(order);
      }
    }

    return orders;
  } catch (error) {
    console.error("Erreur getAllOrders:", error);
    return [];
  }
};

// Charger les commandes d'un acheteur (personnalisé par compte)
export const getBuyerOrders = async (buyerAddress) => {
  try {
    if (!buyerAddress || !window.ethereum) return [];
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    const orderIds = await contract.getOrderIdsByBuyer(buyerAddress);
    const orders = [];
    for (const id of orderIds) {
      const o = await contract.orders(id);
      if (o.exists) orders.push(parseOrder(o));
    }
    return orders;
  } catch (error) {
    console.error("Erreur getBuyerOrders:", error);
    return [];
  }
};

// Assigner un livreur (vendeur uniquement)
export const assignDeliverer = async (orderId, delivererAddress) => {
  try {
    const contract = await getContract();
    const tx = await contract.assignDeliverer(BigInt(orderId), delivererAddress);
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur assignDeliverer:", error);
    if (error.message === "ACCOUNT_MISMATCH") {
      return { success: false, error: "Compte MetaMask changé — déconnecte et reconnecte ton wallet" };
    }
    return { success: false, error: extractError(error) };
  }
};

// Charger les livraisons d'un livreur
export const getDelivererOrders = async (delivererAddress) => {
  try {
    if (!delivererAddress || !window.ethereum) return [];
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    const orderIds = await contract.getOrderIdsByDeliverer(delivererAddress);
    const orders = [];
    for (const id of orderIds) {
      const o = await contract.orders(id);
      if (o.exists) orders.push(parseOrder(o));
    }
    return orders;
  } catch (error) {
    console.error("Erreur getDelivererOrders:", error);
    return [];
  }
};

// Demander un remboursement symétrique (acheteur → vendeur → livreur)
export const requestRefund = async (orderId) => {
  try {
    const contract = await getContract();
    const tx = await contract.requestRefund(BigInt(orderId));
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur requestRefund:", error);
    return { success: false, error: extractError(error) };
  }
};

export const approveRefund = async (orderId) => {
  try {
    const contract = await getContract();
    const tx = await contract.approveRefund(BigInt(orderId));
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur approveRefund:", error);
    return { success: false, error: extractError(error) };
  }
};

export const confirmReturn = async (orderId) => {
  try {
    const contract = await getContract();
    const tx = await contract.confirmReturn(BigInt(orderId));
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur confirmReturn:", error);
    return { success: false, error: extractError(error) };
  }
};

// Ouvrir un litige (acheteur, dans les 48h après confirmation)
export const openDispute = async (orderId, ipfsHash = "") => {
  try {
    const contract = await getContract();
    const tx = await contract.openDispute(BigInt(orderId), ipfsHash);
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur openDispute:", error);
    return { success: false, error: extractError(error) };
  }
};

// Libérer les fonds (après 48h sans litige)
export const releaseFunds = async (orderId) => {
  try {
    const contract = await getContract();
    const tx = await contract.releaseFunds(BigInt(orderId));
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur releaseFunds:", error);
    return { success: false, error: extractError(error) };
  }
};

// Résoudre un litige — admin uniquement
export const resolveDispute = async (orderId, favorBuyer) => {
  try {
    const contract = await getContract();
    const tx = await contract.resolveDispute(BigInt(orderId), favorBuyer);
    await tx.wait();
    return { success: true };
  } catch (error) {
    console.error("Erreur resolveDispute:", error);
    return { success: false, error: extractError(error) };
  }
};

// Toutes les données brutes stockées dans le smart contract
export const getBlockchainData = async () => {
  try {
    if (!window.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);

    const [storeCount, productCount, orderCount, admin] = await Promise.all([
      contract.storeCount(),
      contract.productCount(),
      contract.orderCount(),
      contract.admin(),
    ]);

    // Boutiques
    const stores = [];
    for (let i = 1; i <= Number(storeCount); i++) {
      const s = await contract.stores(i);
      if (s.exists) stores.push({ id: Number(s.id), owner: s.owner, name: s.name, ipfsHash: s.ipfsHash });
    }

    // Produits
    const products = [];
    for (let i = 1; i <= Number(productCount); i++) {
      const p = await contract.products(i);
      if (p.exists) products.push({
        id: Number(p.id), storeId: Number(p.storeId), seller: p.seller,
        price: formatEther(p.price), stock: Number(p.stock), ipfsHash: p.ipfsHash,
      });
    }

    // Commandes
    const orders = [];
    for (let i = 1; i <= Number(orderCount); i++) {
      const o = await contract.orders(i);
      if (o.exists) orders.push({
        id: Number(o.id), productId: Number(o.productId), buyer: o.buyer,
        deliverer: o.deliverer, amount: formatEther(o.amount),
        delivered: o.delivered, released: o.released, disputed: o.disputed,
        disputeResolved: o.disputeResolved, buyerWon: o.buyerWon,
        deliveryTimestamp: Number(o.deliveryTimestamp),
        disputeIpfsHash: o.disputeIpfsHash,
      });
    }

    // Avis (par produit)
    const reviews = [];
    for (const p of products) {
      const count = await contract.getReviewsCount(p.id);
      for (let j = 0; j < Number(count); j++) {
        const r = await contract.getReview(p.id, j);
        reviews.push({
          id: Number(r[0]), orderId: Number(r[1]), productId: Number(r[2]),
          reviewer: r[3], rating: Number(r[4]), ipfsHash: r[5],
        });
      }
    }

    return {
      contractAddress: CONTRACT_ADDRESS,
      admin,
      counts: {
        stores: Number(storeCount),
        products: Number(productCount),
        orders: Number(orderCount),
        reviews: reviews.length,
      },
      stores,
      products,
      orders,
      reviews,
    };
  } catch (error) {
    console.error("Erreur getBlockchainData:", error);
    return null;
  }
};

// Historique de toutes les transactions du contrat (via events)
export const getTransactionHistory = async () => {
  try {
    if (!window.ethereum) return [];
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);

    const eventNames = [
      "OrderCreated",
      "DelivererAssigned",
      "DeliveryConfirmed",
      "FundsReleased",
      "RefundClaimed",
      "DisputeOpened",
      "DisputeResolved",
      "StoreCreated",
      "ProductAdded",
    ];

    const allEvents = [];

    for (const name of eventNames) {
      const events = await contract.queryFilter(name);
      for (const e of events) {
        const block = await provider.getBlock(e.blockNumber);
        const args = {};
        if (e.fragment?.inputs) {
          e.fragment.inputs.forEach((input, i) => {
            const val = e.args[i];
            args[input.name] = typeof val === "bigint" ? val.toString() : val;
          });
        }
        allEvents.push({
          event: name,
          args,
          blockNumber: e.blockNumber,
          txHash: e.transactionHash,
          timestamp: block?.timestamp ? Number(block.timestamp) : 0,
        });
      }
    }

    allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
    return allEvents;
  } catch (error) {
    console.error("Erreur getTransactionHistory:", error);
    return [];
  }
};

// Vérifier si une adresse est enregistrée comme livreur
export const checkIsDeliverer = async (address) => {
  try {
    if (!address || !window.ethereum) return false;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    return await contract.isDeliverer(address);
  } catch {
    return false;
  }
};

export const getStoreOfOwner = async (address) => {
  try {
    if (!address || !window.ethereum) return 0;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    return Number(await contract.storeOfOwner(address));
  } catch {
    return 0;
  }
};

// Détecte le rôle d'une adresse : "deliverer" | "seller" | "buyer"
export const detectUserRole = async (address) => {
  try {
    // 1. Vérifier contrat (livreur assigné à une commande)
    const isDeliv = await checkIsDeliverer(address);
    if (isDeliv) return "deliverer";

    // 2. Vérifier table deliverer_candidates (inscrit comme livreur)
    try {
      const resp = await fetch("http://localhost:5000/deliverers");
      const json = await resp.json();
      if (json.success && json.data.some(d => d.address.toLowerCase() === address.toLowerCase())) {
        return "deliverer";
      }
    } catch { /* backend indisponible */ }

    // 3. Vérifier si vendeur (a une boutique)
    const storeId = await getStoreOfOwner(address);
    if (storeId > 0) return "seller";

    return "buyer";
  } catch {
    return "buyer";
  }
};

// ─── Fonctions Admin ─────────────────────────────────────────────────────────

export const blacklistAddress = async (address) => {
  try {
    const contract = await getContract();
    const tx = await contract.blacklistAddress(address);
    await tx.wait();
    return { success: true };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

export const unblacklistAddress = async (address) => {
  try {
    const contract = await getContract();
    const tx = await contract.unblacklistAddress(address);
    await tx.wait();
    return { success: true };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

export const removeProduct = async (productId) => {
  try {
    const contract = await getContract();
    const tx = await contract.removeProduct(BigInt(productId));
    await tx.wait();
    return { success: true };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

export const featureProduct = async (productId, featured) => {
  try {
    const contract = await getContract();
    const tx = await contract.featureProduct(BigInt(productId), featured);
    await tx.wait();
    return { success: true };
  } catch (error) {
    return { success: false, error: extractError(error) };
  }
};

export const isBlacklisted = async (address) => {
  try {
    if (!window.ethereum) return false;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    return await contract.blacklisted(address);
  } catch {
    return false;
  }
};

// Lire l'adresse admin du contrat
export const getAdminAddress = async () => {
  try {
    if (!window.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, provider);
    return await contract.admin();
  } catch (error) {
    return null;
  }
};
// Ajouter un avis
export const submitReview = async (orderId, rating, ipfsHash) => {
  try {
    const contract = await getContract();

    const tx = await contract.submitReview(
      BigInt(orderId),
      Number(rating),
      ipfsHash
    );

    await tx.wait();

    return { success: true };
  } catch (error) {
    console.error("Erreur submitReview:", error);

    return { success: false, error: extractError(error) };
  }
};
// Nombre d'avis d'un produit
export const getReviewsCount = async (productId) => {
  try {
    const contract = await getContract();
    const count = await contract.getReviewsCount(productId);
    return Number(count);
  } catch (error) {
    console.error("Erreur getReviewsCount:", error);
    return 0;
  }
};

// Lire un avis précis d'un produit
export const getReview = async (productId, index) => {
  try {
    const contract = await getContract();
    const review = await contract.getReview(productId, index);

    return {
      id: Number(review[0]),
      orderId: Number(review[1]),
      productId: Number(review[2]),
      reviewer: review[3],
      rating: Number(review[4]),
      ipfsHash: review[5],
      exists: review[6],
    };
  } catch (error) {
    console.error("Erreur getReview:", error);
    return null;
  }
};

// Charger tous les avis d'un produit
export const getReviewsByProduct = async (productId) => {
  try {
    const count = await getReviewsCount(productId);
    const reviews = [];

    for (let i = 0; i < count; i++) {
      const review = await getReview(productId, i);

      if (review && review.exists) {
        reviews.push(review);
      }
    }

    return reviews;
  } catch (error) {
    console.error("Erreur getReviewsByProduct:", error);
    return [];
  }
};
// Lire les détails d'une transaction locale
export const getTransactionDetails = async (txHash) => {
  try {
    if (!window.ethereum || !txHash || txHash === "Non disponible") {
      return null;
    }

    const provider = new BrowserProvider(window.ethereum);

    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return null;
    }

    const block = await provider.getBlock(tx.blockNumber);

    const gasPrice = tx.gasPrice ?? receipt.gasPrice ?? 0n;
    const gasUsed = receipt.gasUsed ?? 0n;
    const totalGasCostWei = gasUsed * gasPrice;

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: formatEther(tx.value),
      blockNumber: tx.blockNumber,
      gasLimit: tx.gasLimit ? tx.gasLimit.toString() : "N/A",
      gasUsed: gasUsed ? gasUsed.toString() : "N/A",
      gasPriceWei: gasPrice ? gasPrice.toString() : "0",
      gasPriceEth: formatEther(gasPrice),
      totalGasCostEth: formatEther(totalGasCostWei),
      status: receipt.status === 1 ? "Success" : "Failed",
      timestamp: block?.timestamp
        ? new Date(block.timestamp * 1000).toLocaleString()
        : "N/A",
    };
  } catch (error) {
    console.error("Erreur getTransactionDetails:", error);
    return null;
  }
};