import hre from "hardhat";

const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

async function main() {
  const { viem } = await hre.network.connect();

  const [seller] = await viem.getWalletClients();
  const marketplace = await viem.getContractAt("Marketplace", CONTRACT_ADDRESS);

  console.log("Seller:", seller.account.address);

  console.log("Creating store...");
  await marketplace.write.createStore(["Ma Boutique", "ipfs://store-test"], {
    account: seller.account,
  });

  const storeId = await marketplace.read.storeOfOwner([seller.account.address]);
  console.log("storeId =", storeId.toString());

  console.log("Adding product...");
  const price = 10n ** 16n; // 0.01 ETH
  const stock = 3n;

  await marketplace.write.addProduct([price, stock, "ipfs://product-test"], {
    account: seller.account,
  });

  const productCount = await marketplace.read.productCount();
  console.log("productCount =", productCount.toString());

  const product = await marketplace.read.products([1n]);
  console.log("product #1 =", product);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});