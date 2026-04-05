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
export const uploadFileToIPFS = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Erreur lors de l’upload du fichier vers IPFS");
    }

    const data = await response.json();

    return {
      success: true,
      ipfsHash: `ipfs://${data.IpfsHash}`,
    };
  } catch (error) {
    console.error("Erreur uploadFileToIPFS:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};