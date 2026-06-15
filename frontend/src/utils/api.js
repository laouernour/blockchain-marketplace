const API_BASE_URL = "http://localhost:5000";

// Récupère le JWT stocké localement
const getToken = () => localStorage.getItem("authToken");

// Headers avec JWT pour les routes protégées
const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Demande un nonce au backend pour une adresse
export const getNonce = async (address) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/nonce?address=${address}`);
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Erreur getNonce:", error);
    return { success: false, error: error.message };
  }
};

// Envoie la signature au backend pour vérification → retourne un JWT
export const verifySignature = async (address, signature) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature }),
    });
    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Erreur verifySignature:", error);
    return { success: false, error: error.message };
  }
};

export const getProductsMetadata = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    const json = await response.json();

    return {
      success: json.success,
      data: json.data,
    };
  } catch (error) {
    console.error("Erreur getProductsMetadata:", error);
    return {
      success: false,
      error: error.message,
      data: [],
    };
  }
};

export const registerAsDeliverer = async (address) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deliverers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAIStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/stats`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getAnomalies = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/anomalies`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};


export const removeDeliverer = async (address) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deliverers/${address}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getDelivererCandidates = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/deliverers`);
    const json = await response.json();
    return json.success ? json.data : [];
  } catch (error) {
    return [];
  }
};


export const getProductSentiments = async (productId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/product-sentiments/${productId}`);
    return await response.json();
  } catch (error) {
    return { success: false, data: [] };
  }
};

export const getRecommendations = async (query, limit = 10) => {
  try {
    const params = new URLSearchParams({ query, limit });
    const response = await fetch(`${API_BASE_URL}/ai/recommend-search?${params}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

export const getProfileRecommendations = async (buyerAddress, limit = 8) => {
  try {
    const params = new URLSearchParams({ buyer: buyerAddress, limit });
    const response = await fetch(`${API_BASE_URL}/ai/recommend-profile?${params}`);
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};

export const analyzeReviewStore = async ({ contractProductId, reviewerAddress, orderId, rawText }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/analyze-review-store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractProductId, reviewerAddress, orderId, rawText }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const saveProductMetadata = async (productData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(productData),
    });

    const json = await response.json();

    return {
      success: json.success,
      data: json.data,
    };
  } catch (error) {
    console.error("Erreur saveProductMetadata:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};