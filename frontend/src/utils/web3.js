import { BrowserProvider, Contract, formatEther } from "ethers";
import MarketplaceABI from "../abi/Marketplace.json";
import { CONTRACT_ADDRESS } from "../config";

// Connexion wallet
export const connectWallet = async () => {
  if (!window.ethereum) {
    alert("MetaMask non installé");
    return null;
  }

  try {
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
export const getContract = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask non installé");
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new Contract(CONTRACT_ADDRESS, MarketplaceABI.abi, signer);
};

// Charger produits
export const getAllProducts = async () => {
  try {
    const contract = await getContract();
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
    const contract = await getContract();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
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
    const contract = await getContract();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
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

    return {
      success: false,
      error:
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Erreur inconnue",
    };
  }
};
// Ajouter un produit
export const addProduct = async (price, stock, ipfsHash) => {
  try {
    const contract = await getContract();

    const tx = await contract.addProduct(
      BigInt(price),
      BigInt(stock),
      ipfsHash
    );

    await tx.wait();

    return { success: true };
  } catch (error) {
    console.error("Erreur addProduct:", error);

    return {
      success: false,
      error:
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Erreur inconnue",
    };
  }
};
// Acheter un produit
export const purchaseProduct = async (productId, priceWei) => {
  try {
    const contract = await getContract();

    const tx = await contract.purchase(productId, {
      value: BigInt(priceWei),
    });

    await tx.wait();

    const orderCount = await contract.orderCount();

    return {
      success: true,
      txHash: tx.hash,
      orderId: Number(orderCount),
    };
  } catch (error) {
    console.error("Erreur purchaseProduct:", error);

    return {
      success: false,
      error:
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Erreur inconnue",
    };
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

    return {
      success: false,
      error:
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Erreur inconnue",
    };
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

    return {
      success: false,
      error:
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Erreur inconnue",
    };
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