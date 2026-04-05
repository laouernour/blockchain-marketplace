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