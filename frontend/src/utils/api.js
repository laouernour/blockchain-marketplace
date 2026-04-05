export const saveProductMetadata = async (productData) => {
  try {
    const response = await fetch("http://localhost:5000/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      throw new Error("Erreur lors de l’envoi au backend");
    }

    return await response.json();
  } catch (error) {
    console.error("Erreur saveProductMetadata:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
export const getProductsMetadata = async () => {
  try {
    const response = await fetch("http://localhost:5000/products");

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des produits SQL");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erreur getProductsMetadata:", error);
    return {
      success: false,
      error: error.message,
      data: [],
    };
  }
};