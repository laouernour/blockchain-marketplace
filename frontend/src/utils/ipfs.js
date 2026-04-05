export const uploadJsonToIPFS = async (jsonData) => {
  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: jsonData,
      }),
    });

    if (!response.ok) {
      throw new Error("Erreur lors de l’upload JSON vers IPFS");
    }

    const data = await response.json();

    return {
      success: true,
      ipfsHash: `ipfs://${data.IpfsHash}`,
    };
  } catch (error) {
    console.error("Erreur uploadJsonToIPFS:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};