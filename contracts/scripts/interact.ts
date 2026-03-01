import hre from "hardhat";

const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

async function main() {
  const { viem } = await hre.network.connect();

  // 1) Récupérer deux comptes (vendeur et acheteur)
  const [seller, buyer] = await viem.getWalletClients();

  // 2) Lire l'ABI/bytecode et se connecter au contrat déployé
  const marketplace = await viem.getContractAt("Marketplace", CONTRACT_ADDRESS);

  // --- ADD PRODUCT (vendeur) ---
  // prix: 0.01 ETH en wei
  const price = 10n ** 16n; // 0.01 ETH
  const stock = 3n;
  const ipfsHash = "ipfs://QmExampleHash";

  console.log("Adding product as seller:", seller.account.address);
  await marketplace.write.addProduct([price, stock, ipfsHash], { account: seller.account });

  const productCount = await marketplace.read.productCount();
  console.log("productCount =", productCount.toString());

  // --- PURCHASE (acheteur) ---
  console.log("Purchasing as buyer:", buyer.account.address);
  await marketplace.write.purchase([1n], { account: buyer.account, value: price });

  const orderCount = await marketplace.read.orderCount();
  console.log("orderCount =", orderCount.toString());

  // --- CONFIRM DELIVERY (acheteur) ---
  console.log("Confirming delivery for order #1");
  await marketplace.write.confirmDelivery([1n], { account: buyer.account });

  // --- SUBMIT REVIEW (acheteur) ---
  console.log("Submitting review for order #1");
  await marketplace.write.submitReview([1n, 5, "ipfs://QmReviewHash"], { account: buyer.account });

  const reviewsCount = await marketplace.read.getReviewsCount([1n]);
  console.log("reviewsCount for product #1 =", reviewsCount.toString());

  console.log("✅ Done!");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});