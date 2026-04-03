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
        products.push({
          id: Number(p.id),
          seller: p.seller,
          price: formatEther(p.price),
          stock: Number(p.stock),
          ipfsHash: p.ipfsHash,
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

    return { success: true };
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